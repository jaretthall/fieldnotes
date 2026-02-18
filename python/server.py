"""
FieldNotes – real-time transcription back-end.

This script is spawned as a child process by the Electron main process.
It exposes a WebSocket server on an ephemeral port, prints that port number
to stdout on the first line so Electron can pass it to the renderer, and
then streams partial + final transcription segments back to every connected
client.

Protocol (JSON over WebSocket):
  Client → Server:
    { "type": "start", "model": "tiny.en" }
    { "type": "audio", "data": "<base64-encoded 16-bit PCM, 16 kHz, mono>" }
    { "type": "stop" }

  Server → Client:
    { "type": "partial",  "text": "...", "id": <int> }
    { "type": "final",    "text": "...", "id": <int>, "start": <float>, "end": <float> }
    { "type": "status",   "ready": bool, "model": str, "error": str|null }
    { "type": "error",    "message": "..." }
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import sys
from typing import Any

import numpy as np
import websockets
from websockets.server import WebSocketServerProtocol

# ---------------------------------------------------------------------------
# Logging – write to stderr so stdout stays clean for the port announcement
# ---------------------------------------------------------------------------
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [whisper-server] %(levelname)s %(message)s",
)
log = logging.getLogger("whisper-server")

# ---------------------------------------------------------------------------
# Configuration (overridable via environment variables set by Electron)
# ---------------------------------------------------------------------------
DEFAULT_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "tiny.en")
SAMPLE_RATE = 16_000       # samples per second (required by faster-whisper)
CHUNK_SAMPLES = 512        # samples per audio chunk from client
VAD_THRESHOLD = 0.5        # Silero VAD speech probability threshold
SILENCE_CHUNKS = 8         # ~256 ms of silence before emitting a "final"

# ---------------------------------------------------------------------------
# Lazy model registry  (model_size → WhisperModel)
# ---------------------------------------------------------------------------
_models: dict[str, Any] = {}


def _load_model(model_size: str) -> Any:
    """Load and cache a faster-whisper model."""
    if model_size not in _models:
        log.info("Loading faster-whisper model: %s", model_size)
        from faster_whisper import WhisperModel  # type: ignore[import-untyped]
        _models[model_size] = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            num_workers=1,
        )
        log.info("Model ready: %s", model_size)
    return _models[model_size]


# ---------------------------------------------------------------------------
# Silero VAD wrapper
# ---------------------------------------------------------------------------
class VadState:
    """Thin wrapper around the Silero VAD model keeping rolling per-client state."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._utils: Any | None = None

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        try:
            import torch  # type: ignore[import-untyped]
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=False,
            )
            self._model = model
            self._utils = utils
            log.info("Silero VAD ready")
        except Exception as exc:
            log.warning("Silero VAD unavailable, falling back to amplitude: %s", exc)

    def is_speech(self, pcm_float32: np.ndarray) -> bool:
        """Return True if the chunk likely contains speech."""
        self._ensure_loaded()
        if self._model is None:
            # Fallback: simple RMS threshold
            rms = float(np.sqrt(np.mean(pcm_float32 ** 2)))
            return rms > 0.01

        try:
            import torch  # type: ignore[import-untyped]
            tensor = torch.from_numpy(pcm_float32).unsqueeze(0)  # (1, N)
            prob = float(self._model(tensor, SAMPLE_RATE).item())
            return prob >= VAD_THRESHOLD
        except Exception:
            rms = float(np.sqrt(np.mean(pcm_float32 ** 2)))
            return rms > 0.01


# ---------------------------------------------------------------------------
# Per-connection transcription session
# ---------------------------------------------------------------------------
class TranscriptionSession:
    """
    Holds all mutable state for one WebSocket client session.
    Audio chunks are accumulated in a rolling buffer; when enough silence
    arrives we transcribe whatever is in the speech buffer and emit results.
    """

    def __init__(self, model_size: str) -> None:
        self.model_size = model_size
        self.vad = VadState()
        self._speech_buf: list[np.ndarray] = []   # confirmed speech chunks
        self._pending_buf: list[np.ndarray] = []  # chunks in potential silence gap
        self._silence_count = 0
        self._segment_id = 0
        self._partial_buf: list[np.ndarray] = []  # for streaming partial results
        self._partial_samples = 0
        self._partial_flush_samples = SAMPLE_RATE * 2  # emit partial every ~2 s of speech

    # ------------------------------------------------------------------
    def push_chunk(self, pcm_int16: bytes) -> None:
        """Accept a raw 16-bit PCM chunk and classify it via VAD."""
        samples = np.frombuffer(pcm_int16, dtype=np.int16).astype(np.float32) / 32768.0
        if self.vad.is_speech(samples):
            self._speech_buf.extend(self._pending_buf)
            self._pending_buf = []
            self._speech_buf.append(samples)
            self._silence_count = 0
        else:
            if self._speech_buf:
                self._pending_buf.append(samples)
                self._silence_count += 1
            # If there's nothing yet, just drop silence

    # ------------------------------------------------------------------
    def has_pending_final(self) -> bool:
        """True when enough silence has accumulated after speech."""
        return self._silence_count >= SILENCE_CHUNKS and len(self._speech_buf) > 0

    # ------------------------------------------------------------------
    def flush_final(self) -> str | None:
        """Transcribe accumulated speech and clear the buffer."""
        if not self._speech_buf:
            return None
        audio = np.concatenate(self._speech_buf)
        self._speech_buf = []
        self._pending_buf = []
        self._silence_count = 0
        return self._transcribe(audio)

    # ------------------------------------------------------------------
    def flush_partial(self) -> str | None:
        """Transcribe the last 2 s of speech for a streaming partial."""
        if not self._speech_buf:
            return None
        window = self._speech_buf[-min(len(self._speech_buf), int(SAMPLE_RATE * 2 / CHUNK_SAMPLES)):]
        audio = np.concatenate(window)
        return self._transcribe(audio)

    # ------------------------------------------------------------------
    def _transcribe(self, audio: np.ndarray) -> str:
        model = _load_model(self.model_size)
        segments, _ = model.transcribe(
            audio,
            language="en",
            beam_size=1,
            best_of=1,
            temperature=0.0,
            vad_filter=False,   # we handle VAD ourselves
            word_timestamps=False,
        )
        return " ".join(s.text.strip() for s in segments).strip()

    # ------------------------------------------------------------------
    def next_id(self) -> int:
        self._segment_id += 1
        return self._segment_id


# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------
async def handle_client(ws: WebSocketServerProtocol) -> None:
    client_id = ws.id if hasattr(ws, "id") else id(ws)
    log.info("Client connected: %s", client_id)
    session: TranscriptionSession | None = None
    flush_task: asyncio.Task[None] | None = None

    async def _periodic_flush() -> None:
        """Background task: check for pending finals and emit partials."""
        while True:
            await asyncio.sleep(0.5)
            if session is None:
                continue
            if session.has_pending_final():
                text = session.flush_final()
                if text:
                    await ws.send(json.dumps({
                        "type": "final",
                        "text": text,
                        "id": session.next_id(),
                    }))
            else:
                partial = session.flush_partial()
                if partial:
                    await ws.send(json.dumps({
                        "type": "partial",
                        "text": partial,
                        "id": session._segment_id,
                    }))

    try:
        async for raw in ws:
            try:
                msg: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue

            msg_type = msg.get("type", "")

            if msg_type == "start":
                model_size = msg.get("model", DEFAULT_MODEL_SIZE)
                session = TranscriptionSession(model_size)
                # Pre-load model in background
                asyncio.get_event_loop().run_in_executor(None, _load_model, model_size)
                flush_task = asyncio.create_task(_periodic_flush())
                await ws.send(json.dumps({
                    "type": "status",
                    "ready": True,
                    "model": model_size,
                    "error": None,
                }))
                log.info("Session started with model: %s", model_size)

            elif msg_type == "audio":
                if session is None:
                    await ws.send(json.dumps({"type": "error", "message": "Send 'start' first"}))
                    continue
                raw_b64: str = msg.get("data", "")
                pcm_bytes = base64.b64decode(raw_b64)
                session.push_chunk(pcm_bytes)

            elif msg_type == "stop":
                if session is not None:
                    if flush_task:
                        flush_task.cancel()
                        flush_task = None
                    text = session.flush_final()
                    if text:
                        await ws.send(json.dumps({
                            "type": "final",
                            "text": text,
                            "id": session.next_id(),
                        }))
                session = None
                await ws.send(json.dumps({"type": "status", "ready": False, "model": None, "error": None}))

            else:
                await ws.send(json.dumps({"type": "error", "message": f"Unknown message type: {msg_type}"}))

    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError as exc:
        log.warning("Connection closed with error: %s", exc)
    finally:
        if flush_task:
            flush_task.cancel()
        log.info("Client disconnected: %s", client_id)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    # Bind on an OS-assigned ephemeral port
    server = await websockets.serve(handle_client, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]  # type: ignore[index]

    # CRITICAL: first stdout line must be just the port number so Electron
    # can parse it reliably.
    print(port, flush=True)
    log.info("faster-whisper WebSocket server listening on ws://127.0.0.1:%d", port)

    # Keep running until the process is killed (by Electron)
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
