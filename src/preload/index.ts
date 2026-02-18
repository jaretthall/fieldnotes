import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed API to the renderer process
contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = [
      'entries:create', 'entries:update', 'entries:delete',
      'entries:getById', 'entries:list',
      'audio:startRecording', 'audio:stopRecording', 'audio:transcribe', 'audio:checkWhisperStatus', 'audio:installWhisperRuntime',
      'ai:categorize', 'ai:generateTitle', 'ai:generateSummary',
      'ai:checkOllamaStatus',
      'settings:get', 'settings:update',
      'search:fullText', 'search:byTag', 'search:byDateRange', 'search:byMood',
      'pathways:list', 'pathways:activate', 'pathways:deactivate', 'pathways:getActive',
      'pathways:getCurrentPrompt', 'pathways:completeDay',
      // Real-time transcription
      'realtime:getStatus', 'realtime:isInstalled',
      'realtime:start', 'realtime:stop',
      'realtime:installBackend',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }

    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  // One-way push events from the main process to the renderer
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validPushChannels = [
      'realtime:stateChanged',
      'realtime:installProgress',
    ];
    if (validPushChannels.includes(channel)) {
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }
    throw new Error(`Invalid push channel: ${channel}`);
  },
});
