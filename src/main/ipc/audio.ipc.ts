import { ipcMain } from 'electron';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { transcribeWithWhisper, checkWhisperStatus, installWhisperRuntime } from '../services/whisper.service';

let currentRecordingPath: string | null = null;
let currentRecordingId: string | null = null;
let recordingStartTime: number | null = null;

const AUDIO_DEBUG = process.env.FIELDNOTES_AUDIO_DEBUG === '1';

function audioLog(msg: string, meta?: Record<string, unknown>): void {
  const prefix = '[Audio]';
  if (meta && Object.keys(meta).length > 0) {
    console.log(prefix, msg, JSON.stringify(meta));
  } else {
    console.log(prefix, msg);
  }
}

function getAudioDir(): string {
  const audioDir = join(app.getPath('userData'), 'audio');
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true });
  }
  return audioDir;
}

export function registerAudioHandlers(): void {
  // Start recording — prepare file path and recordingId for correlation
  ipcMain.handle('audio:startRecording', async (_event, preferredExtension?: 'wav' | 'ogg' | 'webm') => {
    const recordingId = uuidv7().slice(0, 8);
    const audioDir = getAudioDir();
    const validExts = ['wav', 'ogg', 'webm'];
    const extension = preferredExtension && validExts.includes(preferredExtension) ? preferredExtension : 'wav';
    const filename = `recording-${uuidv7()}.${extension}`;
    currentRecordingPath = join(audioDir, filename);
    currentRecordingId = recordingId;
    recordingStartTime = Date.now();

    audioLog('start_requested', { recordingId, path: currentRecordingPath, extension });

    return { tempPath: currentRecordingPath, recordingId };
  });

  // Stop recording — finalize audio file
  ipcMain.handle('audio:stopRecording', async (_event, audioData: ArrayBuffer, recordingId: string) => {
    const audioPath = currentRecordingPath;
    const startTime = recordingStartTime;

    if (!audioPath) {
      audioLog('audio_save', { error: 'no_active_recording', remediation: 'Call audio:startRecording before stop.' });
      throw new Error('No active recording');
    }

    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    if (!audioData || audioData.byteLength === 0) {
      audioLog('audio_save', { recordingId, error: 'no_audio_data', remediation: 'Ensure MediaRecorder produced chunks.' });
      throw new Error('No audio data received from recorder');
    }

    const byteLength = audioData.byteLength;
    writeFileSync(audioPath, Buffer.from(audioData));

    currentRecordingPath = null;
    currentRecordingId = null;
    recordingStartTime = null;

    audioLog('file_saved', { recordingId, path: audioPath, sizeBytes: byteLength, durationSec: duration });

    return { audioPath, duration };
  });

  // Transcribe audio via local whisper.cpp CLI
  ipcMain.handle('audio:transcribe', async (_event, audioPath: string, recordingId: string) => {
    audioLog('transcribe_requested', { recordingId, audioPath });
    return transcribeWithWhisper(audioPath, recordingId);
  });

  // Preflight check for Whisper CLI and model
  ipcMain.handle('audio:checkWhisperStatus', async () => {
    return checkWhisperStatus();
  });

  // One-click install of Whisper runtime (CLI + model)
  ipcMain.handle('audio:installWhisperRuntime', async () => {
    audioLog('whisper_install_requested');
    try {
      return await installWhisperRuntime();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      audioLog('whisper_install_failed', { error: message });
      throw new Error(`Whisper install failed: ${message}`);
    }
  });
}
