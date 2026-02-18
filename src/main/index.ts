import { app, BrowserWindow, shell, session } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initializeDatabase, closeDatabase } from './db';
import { registerEntryHandlers } from './ipc/entries.ipc';
import { registerAudioHandlers } from './ipc/audio.ipc';
import { registerAIHandlers } from './ipc/ai.ipc';
import { registerSearchHandlers } from './ipc/search.ipc';
import { registerPathwayHandlers } from './ipc/pathways.ipc';
import { registerSettingsHandlers } from './ipc/settings.ipc';
import { registerRealtimeAudioHandlers } from './ipc/realtime-audio.ipc';
import { startPythonServer, stopPythonServer, isPythonBackendInstalled } from './services/python-manager';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#F7F5F0', // parchment
    titleBarStyle: 'hiddenInset',
    title: 'FieldNotes',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // In dev, load from vite dev server; in prod, load the built file
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    const url = devUrl.endsWith('/') ? devUrl : `${devUrl}/`;
    console.log('[Electron] Loading renderer from:', url);
    mainWindow.loadURL(url);
    // Set ELECTRON_OPEN_DEVTOOLS=1 to auto-open DevTools (for debugging CSS/Network)
    if (process.env['ELECTRON_OPEN_DEVTOOLS'] === '1') {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.openDevTools();
      });
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.fieldnotes.app');

  // In dev, allow all resources so styles and HMR work (localhost only)
  if (is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith('http://localhost:') || details.url.startsWith('http://127.0.0.1:')) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; font-src * data:;"],
          },
        });
        return;
      }
      callback({ responseHeaders: details.responseHeaders });
    });
  }

  // Initialize database
  initializeDatabase();

  // Register IPC handlers
  registerEntryHandlers();
  registerAudioHandlers();
  registerAIHandlers();
  registerSearchHandlers();
  registerPathwayHandlers();
  registerSettingsHandlers();
  registerRealtimeAudioHandlers();

  // Auto-start the Python server if the backend is already installed
  if (isPythonBackendInstalled()) {
    startPythonServer().catch((err) => {
      console.warn('[Main] Python server auto-start failed:', err.message);
    });
  }

  // Default open or close DevTools by F12 in dev and ignore in prod
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonServer();
  closeDatabase();
});
