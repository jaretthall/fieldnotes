# Whisper Transcription Setup

Fieldnotes records real audio and transcribes it locally via `whisper.cpp` CLI.

## Recommended setup (in-app, one click)

1. Open **Settings** in the left sidebar.
2. Go to **Voice Transcription**.
3. Click **Install Whisper**.
4. Wait for completion, then click **Recheck**.

This installs Whisper CLI and model into your Fieldnotes user data folder automatically.

## What the app expects

- **Whisper CLI** — `whisper-cli` (or `whisper-cli.exe` on Windows) on your PATH, or set `WHISPER_CPP_PATH` to the executable.
- **Model file** — `ggml-base.en.bin` available via one of:
  - `WHISPER_MODEL_PATH` env var
  - `resources/models/ggml-base.en.bin` (bundled)
  - `<userData>/models/ggml-base.en.bin`

## Windows setup

### 1. Build or download whisper.cpp

- **Option A (build):** Clone [whisper.cpp](https://github.com/ggerganov/whisper.cpp), build with CMake. The CLI will be at e.g. `build/bin/Release/whisper-cli.exe`.
- **Option B (binaries):** Download a pre-built release from the [releases page](https://github.com/ggerganov/whisper.cpp/releases) if available.

### 2. Download the model

- Get `ggml-base.en.bin` from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp) or the whisper.cpp repo’s `models/` directory.
- Place it somewhere stable, e.g. `C:\tools\whisper.cpp\models\ggml-base.en.bin`.

### 3. Set environment variables

**Current session only (PowerShell):**

```powershell
$env:WHISPER_CPP_PATH="C:\tools\whisper.cpp\build\bin\Release\whisper-cli.exe"
$env:WHISPER_MODEL_PATH="C:\tools\whisper.cpp\models\ggml-base.en.bin"
pnpm dev
```

**Persist for future sessions (user level):**

```powershell
[System.Environment]::SetEnvironmentVariable('WHISPER_CPP_PATH', 'C:\tools\whisper.cpp\build\bin\Release\whisper-cli.exe', 'User')
[System.Environment]::SetEnvironmentVariable('WHISPER_MODEL_PATH', 'C:\tools\whisper.cpp\models\ggml-base.en.bin', 'User')
```

Restart your terminal and run `pnpm dev`.

### 4. Verify

When Whisper is configured correctly, you should see logs like:

```
[Audio] start_requested {"recordingId":"...","path":"..."}
[Audio] file_saved {"recordingId":"...","sizeBytes":...}
[Audio] whisper_start {"recordingId":"..."}
[Audio] whisper_exit {"recordingId":"...","code":0}
[Audio] whisper_done {"recordingId":"...","transcriptLength":...}
```

## Debug mode

Set `FIELDNOTES_AUDIO_DEBUG=1` for extra verbose audio/Whisper logs:

```powershell
$env:FIELDNOTES_AUDIO_DEBUG="1"
pnpm dev
```

## Fallback when Whisper is not configured

- Audio is still saved under `<userData>/audio/`.
- Entries are created with placeholder text: `[Voice entry — transcription unavailable. Audio saved.]`
- The mic overlay shows: “Whisper not configured. Audio will still save.”

## Notes

- Recordings are stored as `.webm` (Opus). If your Whisper build does not support `.webm`, convert to WAV first or use a build with ffmpeg support.
