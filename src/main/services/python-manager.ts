/**
 * PythonManager
 *
 * Manages the lifecycle of the faster-whisper Python back-end process.
 *
 * Responsibilities:
 *   1. Locate the correct Python executable (venv inside userData, then system).
 *   2. Spawn the WebSocket server script and read the port from its first stdout line.
 *   3. Keep the process alive; restart if it crashes unexpectedly.
 *   4. Expose the WebSocket URL and status to the rest of the main process.
 *   5. Provide an `installBackend()` method that creates a venv and installs
 *      the Python requirements (runs install.py).
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PythonStatus =
  | 'not_installed'   // venv not present
  | 'starting'        // process spawning, port not yet known
  | 'ready'           // process running, port known
  | 'error'           // process exited unexpectedly
  | 'installing';     // install.py is running

export interface PythonState {
  status: PythonStatus;
  port: number | null;
  wsUrl: string | null;
  error: string | null;
}

export type InstallProgress = {
  percent: number;
  message: string;
};

export type InstallResult =
  | { success: true; state: PythonState }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _process: ChildProcess | null = null;
let _port: number | null = null;
let _status: PythonStatus = 'not_installed';
let _error: string | null = null;
let _portResolve: ((port: number) => void) | null = null;
let _portReject: ((err: Error) => void) | null = null;
const _listeners: Array<(state: PythonState) => void> = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPythonRoot(): string {
  const dir = join(app.getPath('userData'), 'python-runtime');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getVenvPythonPath(): string {
  const venv = join(getPythonRoot(), 'venv');
  if (process.platform === 'win32') {
    return join(venv, 'Scripts', 'python.exe');
  }
  return join(venv, 'bin', 'python');
}

function getServerScriptPath(): string {
  // In production, the python/ dir is bundled next to the app
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'server.py');
  }
  // In dev, it's in the repo root
  return join(app.getAppPath(), '..', 'python', 'server.py');
}

function getInstallScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'install.py');
  }
  return join(app.getAppPath(), '..', 'python', 'install.py');
}

function resolveSystemPython(): string {
  // Fallback: try 'python' (Windows) then 'python3' (Unix)
  return process.platform === 'win32' ? 'python' : 'python3';
}

function notify(): void {
  const state = getState();
  _listeners.forEach((fn) => fn(state));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getState(): PythonState {
  return {
    status: _status,
    port: _port,
    wsUrl: _port ? `ws://127.0.0.1:${_port}` : null,
    error: _error,
  };
}

export function onStateChange(fn: (state: PythonState) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/**
 * Start the Python WebSocket server. Safe to call multiple times;
 * if already running, returns the current state immediately.
 */
export async function startPythonServer(): Promise<PythonState> {
  if (_status === 'ready' && _process) {
    return getState();
  }

  const venvPython = getVenvPythonPath();
  const hasPython = existsSync(venvPython);

  const pythonExe = hasPython ? venvPython : resolveSystemPython();

  _status = 'starting';
  _error = null;
  _port = null;
  notify();

  const serverScript = getServerScriptPath();

  return new Promise<PythonState>((resolve, reject) => {
    _portResolve = (port: number) => {
      _port = port;
      _status = 'ready';
      notify();
      resolve(getState());
    };
    _portReject = (err: Error) => {
      _status = 'error';
      _error = err.message;
      notify();
      reject(err);
    };

    _process = spawn(pythonExe, [serverScript], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let firstLine = true;

    _process.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (firstLine) {
        firstLine = false;
        const port = parseInt(text, 10);
        if (!isNaN(port) && port > 0) {
          _portResolve?.(port);
          _portResolve = null;
          _portReject = null;
        } else {
          _portReject?.(new Error(`Unexpected server output: ${text}`));
          _portResolve = null;
          _portReject = null;
        }
      }
    });

    _process.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trimEnd();
      if (line) console.error('[PythonManager]', line);
    });

    _process.on('exit', (code, signal) => {
      console.warn(`[PythonManager] Process exited – code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      if (_portReject) {
        _portReject(new Error(`Python server exited before port was announced (code ${code})`));
        _portResolve = null;
        _portReject = null;
      }
      _process = null;
      _port = null;
      if (_status !== 'installing') {
        _status = 'error';
        _error = `Server exited (code ${code})`;
        notify();
      }
    });

    _process.on('error', (err: NodeJS.ErrnoException) => {
      const msg =
        err.code === 'ENOENT'
          ? `Python not found (tried: ${pythonExe}). Install Python 3.9+ or use the installer.`
          : err.message;
      console.error('[PythonManager]', msg);
      if (_portReject) {
        _portReject(new Error(msg));
        _portResolve = null;
        _portReject = null;
      }
      _status = 'error';
      _error = msg;
      notify();
    });
  });
}

/** Stop the Python server process cleanly. */
export function stopPythonServer(): void {
  if (_process) {
    _process.kill();
    _process = null;
  }
  _port = null;
  _status = 'not_installed';
  notify();
}

/**
 * Run install.py to create a venv and install Python dependencies.
 * Reports progress via the optional `onProgress` callback.
 */
export async function installPythonBackend(
  onProgress?: (p: InstallProgress) => void,
): Promise<InstallResult> {
  const installScript = getInstallScriptPath();
  const targetDir = getPythonRoot();

  _status = 'installing';
  _error = null;
  notify();

  // Use whatever Python is on the system PATH to run the install script
  const systemPython = resolveSystemPython();

  return new Promise<InstallResult>((resolve) => {
    const proc = spawn(
      systemPython,
      [installScript, '--target', targetDir],
      {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line === 'DONE') {
          _status = 'not_installed'; // will become 'starting' when server is started
          notify();
          resolve({ success: true, state: getState() });
        } else if (line.startsWith('ERROR:')) {
          const msg = line.slice('ERROR:'.length);
          _status = 'error';
          _error = msg;
          notify();
          resolve({ success: false, error: msg });
        } else if (line.startsWith('PROGRESS:')) {
          const rest = line.slice('PROGRESS:'.length); // "pct:message"
          const colon = rest.indexOf(':');
          if (colon !== -1) {
            const percent = parseInt(rest.slice(0, colon), 10);
            const message = rest.slice(colon + 1);
            onProgress?.({ percent, message });
          }
        }
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[PythonManager:install]', chunk.toString().trimEnd());
    });

    proc.on('exit', (code) => {
      if (code !== 0 && _status === 'installing') {
        const msg = `install.py exited with code ${code}`;
        _status = 'error';
        _error = msg;
        notify();
        resolve({ success: false, error: msg });
      }
    });

    proc.on('error', (err) => {
      const msg = err.message;
      _status = 'error';
      _error = msg;
      notify();
      resolve({ success: false, error: msg });
    });
  });
}

/** True if the Python venv is already installed. */
export function isPythonBackendInstalled(): boolean {
  return existsSync(getVenvPythonPath());
}
