/**
 * IPC handlers for the real-time transcription back-end.
 *
 * Channels exposed to the renderer (via preload whitelist):
 *   realtime:getStatus        → PythonState
 *   realtime:start            → PythonState  (starts server if not running)
 *   realtime:stop             → void
 *   realtime:installBackend   → InstallResult  (installs Python deps)
 *   realtime:isInstalled      → boolean
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  getState,
  startPythonServer,
  stopPythonServer,
  installPythonBackend,
  isPythonBackendInstalled,
  onStateChange,
} from '../services/python-manager';

export function registerRealtimeAudioHandlers(): void {
  // Push state updates to the renderer via a named event
  onStateChange((state) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('realtime:stateChanged', state);
    });
  });

  ipcMain.handle('realtime:getStatus', () => {
    return getState();
  });

  ipcMain.handle('realtime:isInstalled', () => {
    return isPythonBackendInstalled();
  });

  ipcMain.handle('realtime:start', async () => {
    try {
      return await startPythonServer();
    } catch (err) {
      return { ...getState(), error: (err as Error).message };
    }
  });

  ipcMain.handle('realtime:stop', () => {
    stopPythonServer();
  });

  ipcMain.handle('realtime:installBackend', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await installPythonBackend((progress) => {
      win?.webContents.send('realtime:installProgress', progress);
    });
    return result;
  });
}
