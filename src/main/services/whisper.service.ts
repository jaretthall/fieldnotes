import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn, spawnSync } from 'child_process';
import { createWriteStream } from 'fs';
import { get as httpsGet } from 'https';
import type { TranscriptSegment, WhisperInstallResult, WhisperStatus } from '../../../shared/types';

const AUDIO_DEBUG = process.env.FIELDNOTES_AUDIO_DEBUG === '1';

function audioLog(msg: string, meta?: Record<string, unknown>): void {
  const prefix = '[Audio]';
  if (meta && Object.keys(meta).length > 0) {
    console.log(prefix, msg, JSON.stringify(meta));
  } else {
    console.log(prefix, msg);
  }
}

function audioDebug(msg: string, meta?: Record<string, unknown>): void {
  if (AUDIO_DEBUG) audioLog(msg, meta);
}

interface StoredWhisperConfig {
  cliPath?: string;
  modelPath?: string;
}

function getWhisperInstallRoot(): string {
  const root = join(app.getPath('userData'), 'whisper');
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

function getStoredConfigPath(): string {
  return join(getWhisperInstallRoot(), 'config.json');
}

function readStoredWhisperConfig(): StoredWhisperConfig {
  const configPath = getStoredConfigPath();
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as StoredWhisperConfig;
  } catch {
    return {};
  }
}

function writeStoredWhisperConfig(config: StoredWhisperConfig): void {
  writeFileSync(getStoredConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function hasWhisperOnPath(): boolean {
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('where', ['whisper-cli'], { windowsHide: true });
      return result.status === 0;
    }
    const result = spawnSync('which', ['whisper-cli']);
    return result.status === 0;
  } catch {
    return false;
  }
}

function findFileRecursive(rootDir: string, fileName: string): string | null {
  if (!existsSync(rootDir)) return null;
  const entries = readdirSync(rootDir);
  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    try {
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        const nested = findFileRecursive(fullPath, fileName);
        if (nested) return nested;
      } else if (entry.toLowerCase() === fileName.toLowerCase()) {
        return fullPath;
      }
    } catch {
      // Ignore unreadable entries.
    }
  }
  return null;
}

function downloadFile(url: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(targetPath);
    const req = httpsGet(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        typeof res.headers.location === 'string'
      ) {
        file.close();
        unlinkSync(targetPath);
        downloadFile(res.headers.location, targetPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        unlinkSync(targetPath);
        reject(new Error(`Download failed (${res.statusCode ?? 'unknown'}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    req.on('error', (err) => {
      file.close();
      if (existsSync(targetPath)) unlinkSync(targetPath);
      reject(err);
    });
  });
}

function extractZipWindows(zipPath: string, destinationDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destinationDir}" -Force`;
    const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `Expand-Archive exited with code ${code}`));
    });
  });
}

function resolveWhisperBinaryPathSafe(): { path: string; found: boolean } {
  const envPath = process.env.WHISPER_CPP_PATH;
  if (envPath && existsSync(envPath)) return { path: envPath, found: true };
  const storedPath = readStoredWhisperConfig().cliPath;
  if (storedPath && existsSync(storedPath)) return { path: storedPath, found: true };
  if (hasWhisperOnPath()) return { path: 'whisper-cli', found: true };
  return { path: 'whisper-cli', found: false };
}

function resolveWhisperModelPathSafe(): { path: string; found: boolean } {
  const envPath = process.env.WHISPER_MODEL_PATH;
  if (envPath && existsSync(envPath)) return { path: envPath, found: true };
  const storedPath = readStoredWhisperConfig().modelPath;
  if (storedPath && existsSync(storedPath)) return { path: storedPath, found: true };

  const bundledModel = join(app.getAppPath(), 'resources', 'models', 'ggml-base.en.bin');
  if (existsSync(bundledModel)) return { path: bundledModel, found: true };

  const userModel = join(app.getPath('userData'), 'models', 'ggml-base.en.bin');
  if (existsSync(userModel)) return { path: userModel, found: true };

  return { path: userModel, found: false };
}

export function checkWhisperStatus(): WhisperStatus {
  const cli = resolveWhisperBinaryPathSafe();
  const model = resolveWhisperModelPathSafe();

  let remediation = '';
  if (!cli.found && !model.found) {
    remediation = 'Set WHISPER_CPP_PATH and WHISPER_MODEL_PATH, or add whisper-cli to PATH and place ggml-base.en.bin in resources/models/.';
  } else if (!cli.found) {
    remediation = 'Set WHISPER_CPP_PATH to whisper-cli.exe or add whisper-cli to PATH.';
  } else if (!model.found) {
    remediation = 'Set WHISPER_MODEL_PATH or place ggml-base.en.bin in resources/models/ or <userData>/models/.';
  }

  return {
    ready: cli.found && model.found,
    cliFound: cli.found,
    modelFound: model.found,
    cliPath: cli.path,
    modelPath: model.found ? model.path : null,
    remediation,
  };
}

export async function installWhisperRuntime(): Promise<WhisperInstallResult> {
  if (process.platform !== 'win32') {
    const status = checkWhisperStatus();
    return {
      installed: false,
      cliPath: status.cliFound ? status.cliPath : null,
      modelPath: status.modelPath,
      message: 'Automatic Whisper install is currently supported on Windows only.',
      status,
    };
  }

  const statusBefore = checkWhisperStatus();
  if (statusBefore.ready) {
    return {
      installed: true,
      cliPath: statusBefore.cliPath,
      modelPath: statusBefore.modelPath,
      message: 'Whisper is already configured.',
      status: statusBefore,
    };
  }

  const root = getWhisperInstallRoot();
  const downloadsDir = join(root, 'downloads');
  const binDir = join(root, 'bin');
  const modelsDir = join(root, 'models');
  if (!existsSync(downloadsDir)) mkdirSync(downloadsDir, { recursive: true });
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
  if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });

  const zipPath = join(downloadsDir, 'whisper-bin-x64.zip');
  const modelPath = join(modelsDir, 'ggml-base.en.bin');
  const whisperZipUrl = 'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip';
  const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

  audioLog('whisper_install_start', { zipPath, modelPath });

  if (!existsSync(zipPath)) {
    await downloadFile(whisperZipUrl, zipPath);
  }
  await extractZipWindows(zipPath, binDir);

  if (!existsSync(modelPath)) {
    await downloadFile(modelUrl, modelPath);
  }

  const cliPath = findFileRecursive(binDir, 'whisper-cli.exe');
  if (!cliPath) {
    throw new Error('Could not find whisper-cli.exe after extraction.');
  }

  writeStoredWhisperConfig({ cliPath, modelPath });
  process.env.WHISPER_CPP_PATH = cliPath;
  process.env.WHISPER_MODEL_PATH = modelPath;

  const statusAfter = checkWhisperStatus();
  if (!statusAfter.ready) {
    throw new Error(statusAfter.remediation || 'Whisper installation did not complete successfully.');
  }

  audioLog('whisper_install_done', { cliPath, modelPath });

  return {
    installed: true,
    cliPath,
    modelPath,
    message: 'Whisper installed successfully.',
    status: statusAfter,
  };
}

interface WhisperCommandConfig {
  binaryPath: string;
  modelPath: string;
}

function assertSupportedAudioFormat(audioPath: string): void {
  const lower = audioPath.toLowerCase();
  const supported = ['.flac', '.mp3', '.ogg', '.wav'];
  if (supported.some((ext) => lower.endsWith(ext))) return;
  audioLog('whisper_exec_failed', {
    reason: 'unsupported_audio_format',
    audioPath,
    remediation: 'Record as OGG/WAV or transcode before Whisper.',
  });
  throw new Error('Whisper CLI does not support this audio format. Please use OGG or WAV recording.');
}

function resolveWhisperBinaryPath(): string {
  const { path, found } = resolveWhisperBinaryPathSafe();
  if (!found) {
    audioLog('whisper_cli_missing', { remediation: 'Set WHISPER_CPP_PATH or add whisper-cli to PATH.' });
    throw new Error(`Whisper CLI not found at ${path}. Set WHISPER_CPP_PATH or add whisper-cli to PATH.`);
  }
  return path;
}

function resolveWhisperModelPath(): string {
  const { path, found } = resolveWhisperModelPathSafe();
  if (!found) {
    audioLog('whisper_model_missing', { remediation: 'Set WHISPER_MODEL_PATH or place ggml-base.en.bin in resources/models/.' });
    throw new Error('Whisper model not found. Set WHISPER_MODEL_PATH or place ggml-base.en.bin in resources/models/.');
  }
  return path;
}

function getWhisperConfig(): WhisperCommandConfig {
  return {
    binaryPath: resolveWhisperBinaryPath(),
    modelPath: resolveWhisperModelPath(),
  };
}

function runWhisperCli(audioPath: string, outBasePath: string, recordingId: string): Promise<void> {
  const { binaryPath, modelPath } = getWhisperConfig();
  const args = [
    '-m', modelPath,
    '-f', audioPath,
    '-l', 'en',
    '-otxt',
    '-of', outBasePath,
    '-np',
  ];

  audioLog('whisper_start', { recordingId, binaryPath, modelPath, audioPath });
  const startMs = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      audioDebug('whisper_stderr', { recordingId, chunk: chunk.toString().slice(0, 200) });
    });

    child.on('error', (err) => {
      audioLog('whisper_cli_missing', { recordingId, error: err.message, remediation: 'Set WHISPER_CPP_PATH or add whisper-cli to PATH.' });
      reject(new Error(`Failed to launch whisper-cli: ${err.message}`));
    });

    child.on('close', (code) => {
      const elapsed = Date.now() - startMs;
      audioLog('whisper_exit', { recordingId, code: code ?? -1, elapsedMs: elapsed });

      if (code === 0) {
        resolve();
        return;
      }
      audioLog('whisper_exec_failed', { recordingId, code, stderr: stderr.slice(0, 500), remediation: 'Check Whisper CLI and model compatibility.' });
      reject(new Error(stderr || `whisper-cli exited with code ${code}`));
    });
  });
}

export async function transcribeWithWhisper(
  audioPath: string,
  recordingId: string
): Promise<{ text: string; segments: TranscriptSegment[] }> {
  assertSupportedAudioFormat(audioPath);
  const outBasePath = `${audioPath}-transcript`;
  await runWhisperCli(audioPath, outBasePath, recordingId);

  const txtPath = `${outBasePath}.txt`;
  if (!existsSync(txtPath)) {
    audioLog('whisper_exec_failed', { recordingId, reason: 'output_not_created', remediation: 'Verify Whisper CLI produces .txt output.' });
    throw new Error('Whisper transcription output was not created.');
  }

  const text = readFileSync(txtPath, 'utf-8').trim();
  audioLog('whisper_done', { recordingId, transcriptLength: text.length });
  return {
    text,
    segments: [],
  };
}
