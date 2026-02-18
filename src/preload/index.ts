import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed API to the renderer process
contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: unknown[]) => {
    // Whitelist of allowed channels
    const validChannels = [
      'entries:create', 'entries:update', 'entries:delete',
      'entries:getById', 'entries:list',
      'audio:startRecording', 'audio:stopRecording', 'audio:transcribe', 'audio:checkWhisperStatus', 'audio:installWhisperRuntime',
      'ai:categorize', 'ai:generateTitle', 'ai:generateSummary',
      'ai:checkOllamaStatus',
      'settings:get', 'settings:update',
      'search:fullText', 'search:byTag', 'search:byDateRange', 'search:byMood',
      'pathways:list', 'pathways:activate', 'pathways:deactivate', 'pathways:getActive',
      'pathways:getCurrentPrompt', 'pathways:completeDay'
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }

    throw new Error(`Invalid IPC channel: ${channel}`);
  }
});
