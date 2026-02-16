const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // OpenClaw related
  getEmails: () => ipcRenderer.invoke('openclaw:getEmails'),
  getDailyBriefing: () => ipcRenderer.invoke('openclaw:getDailyBriefing'),
  executeCommand: (command) => ipcRenderer.invoke('openclaw:executeCommand', command),

  // Deepgram voice recognition
  deepgram: {
    startListening: () => ipcRenderer.invoke('deepgram:startListening'),
    stopListening: () => ipcRenderer.invoke('deepgram:stopListening'),
    sendAudio: (audioData) => ipcRenderer.invoke('deepgram:sendAudio', audioData),
    textToSpeech: (text) => ipcRenderer.invoke('deepgram:textToSpeech', text),

    // Event listening - returns a cancellation function
    onConnected: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:connected', handler);
      return () => ipcRenderer.removeListener('deepgram:connected', handler);
    },
    onTranscript: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('deepgram:transcript', handler);
      return () => ipcRenderer.removeListener('deepgram:transcript', handler);
    },
    onError: (callback) => {
      const handler = (event, error) => callback(error);
      ipcRenderer.on('deepgram:error', handler);
      return () => ipcRenderer.removeListener('deepgram:error', handler);
    },
    onClosed: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:closed', handler);
      return () => ipcRenderer.removeListener('deepgram:closed', handler);
    },
    onUtteranceEnd: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('deepgram:utteranceEnd', handler);
      return () => ipcRenderer.removeListener('deepgram:utteranceEnd', handler);
    },

    // Streaming TTS audio chunk event
    onAudioChunk: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('tts:audioChunk', handler);
      return () => ipcRenderer.removeListener('tts:audioChunk', handler);
    },

    // First sentence event (used for immediate display on the frontend)
    onFirstSentence: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('clawdbot:firstSentence', handler);
      return () => ipcRenderer.removeListener('clawdbot:firstSentence', handler);
    },

    // Cleanup all listeners
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('deepgram:connected');
      ipcRenderer.removeAllListeners('deepgram:transcript');
      ipcRenderer.removeAllListeners('deepgram:error');
      ipcRenderer.removeAllListeners('deepgram:closed');
      ipcRenderer.removeAllListeners('deepgram:utteranceEnd');
      ipcRenderer.removeAllListeners('tts:audioChunk');
      ipcRenderer.removeAllListeners('clawdbot:firstSentence');
    }
  },

  // TTS voice selection
  tts: {
    setVoice: (voiceId) => ipcRenderer.invoke('tts:setVoice', voiceId),
    getVoice: () => ipcRenderer.invoke('tts:getVoice'),
    stop: () => ipcRenderer.invoke('tts:stop')  // Stop TTS playback
  },

  // Async task management
  task: {
    create: (message) => ipcRenderer.invoke('task:create', message),
    get: (taskId) => ipcRenderer.invoke('task:get', taskId),
    getAll: () => ipcRenderer.invoke('task:getAll'),
    cancel: (taskId) => ipcRenderer.invoke('task:cancel', taskId),

    // Task completed event
    onCompleted: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('task-completed', handler);
      return () => ipcRenderer.removeListener('task-completed', handler);
    },

    // Task failed event
    onFailed: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('task-failed', handler);
      return () => ipcRenderer.removeListener('task-failed', handler);
    }
  },

  // Window control
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  restoreWindow: () => ipcRenderer.send('window:restore'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onMiniMode: (callback) => {
    const handler = (event, isMini) => callback(isMini);
    ipcRenderer.on('window:miniMode', handler);
    return () => ipcRenderer.removeListener('window:miniMode', handler);
  },

  // File operations
  file: {
    // Show file in Finder/Explorer
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath)
  }
});
