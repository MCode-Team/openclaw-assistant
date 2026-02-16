const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const WebSocket = require('ws');
require('dotenv').config();

// Catch EPIPE errors to prevent crashes during background execution
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // Ignore EPIPE error
    return;
  }
  throw err;
});

process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // Ignore EPIPE error
    return;
  }
  throw err;
});

let mainWindow;

// ===== Task Manager =====
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
  }

  // Create async task
  createTask(message) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const task = {
      id: taskId,
      message: message,
      status: 'pending',
      createdAt: Date.now(),
      result: null,
      error: null
    };

    this.tasks.set(taskId, task);
    this.taskQueue.push(taskId);

    console.log(`[TaskManager] Creating task: ${taskId} - "${message}"`);

    // Start processing queue
    this.processQueue();

    return taskId;
  }

  // Process task queue
  async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const taskId = this.taskQueue.shift();

    await this.executeTask(taskId);

    this.isProcessing = false;

    // Continue to next task
    if (this.taskQueue.length > 0) {
      this.processQueue();
    }
  }

  // Execute task
  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    console.log(`[TaskManager] Starting task execution: ${taskId}`);
    task.status = 'running';
    task.startedAt = Date.now();

    try {
      // Call Clawdbot
      const result = await chatWithClawdbot(task.message);

      task.status = 'completed';
      task.result = result;
      task.completedAt = Date.now();
      task.duration = task.completedAt - task.startedAt;

      console.log(`[TaskManager] Task completed: ${taskId} (Duration: ${task.duration}ms)`);

      // Notify frontend
      this.notifyTaskCompleted(task);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = Date.now();

      console.error(`[TaskManager] Task failed: ${taskId} - ${error.message}`);

      // Notify frontend of failure
      this.notifyTaskFailed(task);
    }
  }

  // Notify frontend of task completion
  notifyTaskCompleted(task) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-completed', {
        taskId: task.id,
        result: task.result,
        duration: task.duration
      });

      // Show system notification
      if (Notification.isSupported()) {
        new Notification({
          title: 'Task Completed',
          body: task.result.substring(0, 100) + (task.result.length > 100 ? '...' : ''),
          silent: false
        }).show();
      }
    }
  }

  // Notify frontend of task failure
  notifyTaskFailed(task) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-failed', {
        taskId: task.id,
        error: task.error
      });
    }
  }

  // Get task status
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  // Get all tasks
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  // Cancel task
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'cancelled';
      // Remove from queue
      const index = this.taskQueue.indexOf(taskId);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
      }
      console.log(`[TaskManager] Task cancelled: ${taskId}`);
      return true;
    }
    return false;
  }
}

const taskManager = new TaskManager();
let deepgramClient = null;
let deepgramLive = null;
let currentSender = null;

// ===== Clawdbot WebSocket Configuration =====
const CLAWDBOT_PORT = process.env.CLAWDBOT_PORT || 18789;
const CLAWDBOT_TOKEN = process.env.CLAWDBOT_TOKEN || '6d4c9e5c78347a57af8f13136c162033f49229840cbe3c69';
const CLAWDBOT_WS_URL = `ws://localhost:${CLAWDBOT_PORT}`;

let clawdbotWs = null;
let clawdbotConnected = false;
let clawdbotRequestId = 0;
let clawdbotPendingRequests = new Map();

// ===== Sentence Splitter =====
class SentenceSplitter {
  constructor(onSentence) {
    this.buffer = '';
    this.onSentence = onSentence;
    // Sentence enders: Chinese and English
    this.sentenceEnders = /[。！？.!?]\s*/g;
  }

  // Add text stream
  addText(text) {
    this.buffer += text;
    this.flush();
  }

  // Try to extract complete sentence
  flush() {
    let match;
    const regex = new RegExp(this.sentenceEnders.source, 'g');
    while ((match = regex.exec(this.buffer)) !== null) {
      const endIndex = match.index + match[0].length;
      const sentence = this.buffer.substring(0, endIndex).trim();
      this.buffer = this.buffer.substring(endIndex);

      if (sentence.length > 0) {
        this.onSentence(sentence);
      }
    }
  }

  // Force flush remaining buffer (called when stream ends)
  finish() {
    if (this.buffer.trim().length > 0) {
      this.onSentence(this.buffer.trim());
      this.buffer = '';
    }
  }

  // Reset
  reset() {
    this.buffer = '';
  }
}

// ===== TTS Audio Queue Manager =====
class TTSQueueManager {
  constructor() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = false;
  }

  // Reset queue
  reset() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = true;
  }

  // Start new session
  startSession() {
    this.audioQueue = [];
    this.isProcessing = false;
    this.currentSentenceId = 0;
    this.isStopped = false;
  }

  // Add sentence to queue
  async enqueueSentence(sentence) {
    if (this.isStopped) return;

    const sentenceId = ++this.currentSentenceId;
    console.log(`[TTS Queue] Enqueuing sentence #${sentenceId}: "${sentence.substring(0, 30)}..."`);

    this.audioQueue.push({ sentence, sentenceId });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process queue
  async processQueue() {
    if (this.isProcessing || this.audioQueue.length === 0) return;

    this.isProcessing = true;

    while (this.audioQueue.length > 0 && !this.isStopped) {
      const item = this.audioQueue.shift();

      try {
        // Call TTS to generate audio
        const audioData = await callMiniMaxTTS(item.sentence);

        if (audioData && mainWindow && !mainWindow.isDestroyed()) {
          // Send audio chunk to frontend
          mainWindow.webContents.send('tts:audioChunk', {
            sentenceId: item.sentenceId,
            audio: audioData,
            text: item.sentence,
            isLast: this.audioQueue.length === 0
          });
        }
      } catch (error) {
        console.error(`[TTS Queue] Sentence #${item.sentenceId} generation failed:`, error);
      }
    }

    this.isProcessing = false;
  }
}

const ttsQueueManager = new TTSQueueManager();
let sentenceCounter = 0;

// ===== Clawdbot WebSocket Connection =====
function connectClawdbot() {
  if (clawdbotWs && clawdbotWs.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log(`[Clawdbot] Connecting to ${CLAWDBOT_WS_URL}...`);
    clawdbotWs = new WebSocket(CLAWDBOT_WS_URL);

    const timeout = setTimeout(() => {
      reject(new Error('Clawdbot connection timeout'));
    }, 10000);

    clawdbotWs.on('open', () => {
      console.log('[Clawdbot] WebSocket connected, waiting for handshake...');
    });

    clawdbotWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle connection challenge
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          console.log('[Clawdbot] Received connection challenge, sending authentication...');
          clawdbotWs.send(JSON.stringify({
            type: 'req',
            id: 'connect-1',
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'gateway-client',
                version: '1.0.0',
                platform: 'electron',
                mode: 'backend'
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write'],
              auth: { token: CLAWDBOT_TOKEN }
            }
          }));
        }

        // Handle response
        if (msg.type === 'res') {
          if (msg.id === 'connect-1') {
            if (msg.ok) {
              clearTimeout(timeout);
              clawdbotConnected = true;
              console.log('[Clawdbot] Authentication successful ✓');
              resolve();
            } else {
              clearTimeout(timeout);
              reject(new Error(msg.error?.message || 'Authentication failed'));
            }
          } else {
            // Handle responses for other requests
            const pending = clawdbotPendingRequests.get(msg.id);
            if (pending) {
              clawdbotPendingRequests.delete(msg.id);
              if (msg.ok) {
                pending.resolve(msg.payload);
              } else {
                pending.reject(new Error(msg.error?.message || 'Request failed'));
              }
            }
          }
        }

        // Handle chat events (streaming response)
        if (msg.type === 'event' && msg.event === 'chat') {
          const pending = clawdbotPendingRequests.get('chat-stream');
          if (pending && msg.payload) {
            if (msg.payload.done) {
              clawdbotPendingRequests.delete('chat-stream');
              pending.resolve(pending.fullText || '');
            } else if (msg.payload.text) {
              pending.fullText = (pending.fullText || '') + msg.payload.text;
            }
          }
        }
      } catch (e) {
        console.error('[Clawdbot] Message parsing error:', e);
      }
    });

    clawdbotWs.on('error', (err) => {
      console.error('[Clawdbot] WebSocket error:', err.message);
      clawdbotConnected = false;
    });

    clawdbotWs.on('close', () => {
      console.log('[Clawdbot] WebSocket disconnected');
      clawdbotConnected = false;
      clawdbotWs = null;
    });
  });
}

// Send Clawdbot request
function clawdbotRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!clawdbotWs || clawdbotWs.readyState !== WebSocket.OPEN) {
      reject(new Error('Clawdbot not connected'));
      return;
    }

    const id = `req-${++clawdbotRequestId}`;
    clawdbotPendingRequests.set(id, { resolve, reject });

    clawdbotWs.send(JSON.stringify({
      type: 'req',
      id,
      method,
      params
    }));

    // Timeout handling
    setTimeout(() => {
      if (clawdbotPendingRequests.has(id)) {
        clawdbotPendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Send chat message to Clawdbot (supports streaming sentence distribution)
async function chatWithClawdbot(message) {
  try {
    await connectClawdbot();

    console.log(`[Clawdbot] Sending message: "${message}"`);

    // Generate unique idempotencyKey
    const idempotencyKey = `openclaw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send message and wait for completion
    const chatReqId = `chat-${++clawdbotRequestId}`;
    let accumulatedText = '';

    // Reset sentence counter and TTS queue
    sentenceCounter = 0;
    ttsQueueManager.startSession();

    // Create sentence splitter
    const splitter = new SentenceSplitter((sentence) => {
      const currentSentenceId = ++sentenceCounter;
      console.log(`[Clawdbot] Sentence #${currentSentenceId}: "${sentence}"`);

      // Send the first sentence to the frontend immediately for display
      if (currentSentenceId === 1 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clawdbot:firstSentence', { text: sentence });
      }

      // Add sentence to TTS queue
      ttsQueueManager.enqueueSentence(sentence);
    });

    return new Promise((resolve, reject) => {
      // Complex tasks (search, tool calls, etc.) might take longer, timeout set to 180 seconds
      const timeout = setTimeout(() => {
        if (clawdbotWs) {
          clawdbotWs.removeListener('message', chatHandler);
        }
        // When timed out but there is accumulated text, return what has been received
        if (accumulatedText.length > 0) {
          console.log('[Clawdbot] Response timeout, returning accumulated text:', accumulatedText.substring(0, 200));
          splitter.finish(); // Flush remaining text
          resolve(accumulatedText);
        } else {
          reject(new Error('Clawdbot response timeout'));
        }
      }, 180000);

      // Listen for messages
      const chatHandler = (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Detailed log: Record all Clawdbot messages (debug)
          if (msg.type === 'event') {
            console.log(`[Clawdbot] Event: ${msg.event}, payload keys: ${Object.keys(msg.payload || {}).join(',')}, state: ${msg.payload?.state || '-'}`);
          } else if (msg.type === 'res' && msg.id !== 'connect-1') {
            console.log(`[Clawdbot] Response: id=${msg.id}, ok=${msg.ok}`);
          }

          // 1. Process direct response of chat.send request (error detection)
          if (msg.type === 'res' && msg.id === chatReqId) {
            if (!msg.ok) {
              console.error('[Clawdbot] chat.send request rejected:', msg.error?.message || JSON.stringify(msg.error));
              clawdbotWs.removeListener('message', chatHandler);
              clearTimeout(timeout);
              reject(new Error(msg.error?.message || 'chat.send request failed'));
              return;
            }
            console.log('[Clawdbot] chat.send request accepted');
          }

          // 2. Listen for chat streaming events (accumulated text + sentence splitting)
          if (msg.type === 'event' && msg.event === 'chat') {
            const payload = msg.payload || {};

            // Accumulate streaming text
            if (payload.text) {
              accumulatedText += payload.text;
              // Feed new text to splitter
              splitter.addText(payload.text);
            }

            // Check completion status
            if (payload.state === 'final' || payload.done === true) {
              console.log('[Clawdbot] Received chat final event');
              clawdbotWs.removeListener('message', chatHandler);

              // Flush splitter remaining text
              splitter.finish();

              // If text has been accumulated via streaming, use it directly
              if (accumulatedText.length > 0) {
                clearTimeout(timeout);
                console.log('[Clawdbot] AI Response (Streaming):', accumulatedText.substring(0, 200));
                resolve(accumulatedText);
                return;
              }

              // Otherwise, retrieve from history
              clawdbotRequest('chat.history', {
                sessionKey: 'agent:main:main',
                limit: 2
              }).then(history => {
                clearTimeout(timeout);
                if (history?.messages) {
                  const lastAssistant = history.messages.find(m => m.role === 'assistant');
                  if (lastAssistant && lastAssistant.content) {
                    const textContent = lastAssistant.content.find(c => c.type === 'text');
                    if (textContent) {
                      console.log('[Clawdbot] AI Response (History):', textContent.text.substring(0, 200));
                      resolve(textContent.text);
                      return;
                    }
                  }
                }
                resolve('Received, but no response content found.');
              }).catch(err => {
                clearTimeout(timeout);
                reject(err);
              });
            }
          }

          // 3. Listen for all other events (Clawdbot might return results through different event names)
          if (msg.type === 'event' && msg.event !== 'chat' && msg.event !== 'connect.challenge') {
            const payload = msg.payload || {};
            // Try to extract text from any event
            if (payload.text && typeof payload.text === 'string') {
              console.log(`[Clawdbot] Received text from event "${msg.event}": ${payload.text.substring(0, 100)}`);
              accumulatedText += payload.text;
              splitter.addText(payload.text);
            }
            if (payload.message && typeof payload.message === 'string') {
              console.log(`[Clawdbot] Received message from event "${msg.event}": ${payload.message.substring(0, 100)}`);
              if (!accumulatedText) accumulatedText = payload.message;
            }
            if (payload.result && typeof payload.result === 'string') {
              console.log(`[Clawdbot] Received result from event "${msg.event}": ${payload.result.substring(0, 100)}`);
              if (!accumulatedText) accumulatedText = payload.result;
            }
          }
        } catch (e) {
          // Ignore parsing error
        }
      };

      clawdbotWs.on('message', chatHandler);

      // Send message
      clawdbotWs.send(JSON.stringify({
        type: 'req',
        id: chatReqId,
        method: 'chat.send',
        params: {
          sessionKey: 'agent:main:main',
          idempotencyKey: idempotencyKey,
          message: message
        }
      }));
    });
  } catch (error) {
    console.error('[Clawdbot] Chat failed:', error.message);
    throw error;
  }
}

// ===== Window Creation =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 330,
    height: 550,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== Command Processing (via Clawdbot) =====
ipcMain.handle('openclaw:executeCommand', async (event, command) => {
  console.log('[CMD] Received command:', command);

  try {
    const reply = await chatWithClawdbot(command);
    console.log(`[CMD] Clawdbot reply: ${reply}`);
    return { type: 'chat', data: null, message: reply };
  } catch (error) {
    console.error('[CMD] Clawdbot call failed:', error.message);
    // Fallback: return user-friendly message
    return {
      type: 'chat',
      data: null,
      message: 'Clawdbot is temporarily unavailable. Please make sure the clawdbot service is running.'
    };
  }
});

// ===== Async Task Management =====
ipcMain.handle('task:create', async (event, message) => {
  const taskId = taskManager.createTask(message);
  return { success: true, taskId };
});

ipcMain.handle('task:get', async (event, taskId) => {
  const task = taskManager.getTask(taskId);
  return task || null;
});

ipcMain.handle('task:getAll', async (event) => {
  return taskManager.getAllTasks();
});

ipcMain.handle('task:cancel', async (event, taskId) => {
  const success = taskManager.cancelTask(taskId);
  return { success };
});

// ===== Deepgram STT =====
let deepgramKeepAlive = null;
let isListeningActive = false; // Whether in active listening state (for connection optimization)

ipcMain.handle('deepgram:startListening', async (event) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
      return { success: false, error: 'Please configure DEEPGRAM_API_KEY in the .env file first' };
    }

    currentSender = event.sender;

    // Reuse existing connection (if still active)
    if (deepgramLive) {
      try {
        const readyState = deepgramLive.getReadyState();
        if (readyState === 1) { // WebSocket.OPEN
          console.log('[STT] Reusing existing Deepgram connection ✓');
          isListeningActive = true; // Activate listening state
          return { success: true };
        }
      } catch (e) { /* Connection failed, re-creating */ }
      // Connection closed or abnormal, re-creating after cleanup
      if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
      try { deepgramLive.finish(); } catch (e) { }
      deepgramLive = null;
    }

    console.log(`[STT] Deepgram API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

    // Create new connection
    deepgramClient = createClient(apiKey);

    console.log('[STT] Establishing Deepgram WebSocket connection...');

    deepgramLive = deepgramClient.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1200,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      endpointing: 300
    });

    // Connection timeout check (error if not established within 10s)
    const connectTimeout = setTimeout(() => {
      if (deepgramLive) {
        const rs = deepgramLive.getReadyState();
        if (rs !== 1) {
          console.error(`[STT] Deepgram connection timeout (readyState=${rs}), possible invalid API Key`);
          if (currentSender && !currentSender.isDestroyed()) {
            currentSender.send('deepgram:error', 'Deepgram connection timeout, please check if the API Key is valid');
          }
          try { deepgramLive.finish(); } catch (e) { }
          deepgramLive = null;
        }
      }
    }, 10000);

    deepgramLive.on(LiveTranscriptionEvents.Open, () => {
      clearTimeout(connectTimeout);
      console.log('[STT] Deepgram connection established ✓');
      // KeepAlive: Send heartbeat every 8 seconds to prevent idle disconnection
      deepgramKeepAlive = setInterval(() => {
        if (deepgramLive) {
          try { deepgramLive.keepAlive(); } catch (e) { }
        }
      }, 8000);
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:connected');
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Transcript, (data) => {
      // Important: Only process transcription results in active state (connection optimization)
      if (!isListeningActive) {
        return;
      }

      if (!data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) return;

      const transcript = data.channel.alternatives[0].transcript;
      const isFinal = data.is_final;

      if (transcript && transcript.trim().length > 0) {
        console.log(`[STT] ${isFinal ? '✓ Final' : '... Interim'}: "${transcript}"`);
        if (currentSender && !currentSender.isDestroyed()) {
          currentSender.send('deepgram:transcript', { transcript, isFinal });
        }
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      // Only notify frontend in active state (connection optimization)
      if (!isListeningActive) return;

      console.log('[STT] UtteranceEnd - User stopped speaking');
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:utteranceEnd');
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
      clearTimeout(connectTimeout);
      console.error('[STT] Deepgram error:', error);
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:error', error.message || String(error));
      }
    });

    deepgramLive.on(LiveTranscriptionEvents.Close, () => {
      clearTimeout(connectTimeout);
      if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
      console.log('[STT] Deepgram connection closed');
      isListeningActive = false; // Reset state
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('deepgram:closed');
      }
    });

    isListeningActive = true; // Activate listening state
    return { success: true };
  } catch (error) {
    console.error('[STT] Startup failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deepgram:stopListening', async () => {
  // Connection optimization: Don't disconnect, just pause listening state
  isListeningActive = false;
  console.log('[STT] Storage stopped (Paused state, connection maintained)');
  return { success: true };
});

ipcMain.handle('deepgram:sendAudio', async (event, audioData) => {
  try {
    // Only send audio data in active listening state
    if (deepgramLive && audioData && isListeningActive) {
      const readyState = deepgramLive.getReadyState();
      if (readyState === 1) {
        const buffer = Buffer.from(audioData);
        deepgramLive.send(buffer);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ===== MiniMax TTS =====
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'speech-02-turbo';

// Currently selected voice (can be dynamically modified by the frontend)
let currentVoiceId = process.env.MINIMAX_VOICE_ID || 'Lovely_Girl';

// Core TTS function (extracted for use by TTSQueueManager)
async function callMiniMaxTTS(text) {
  if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
    throw new Error('MiniMax API Key or Group ID not configured');
  }

  console.log(`[TTS] MiniMax generating speech (Voice: ${currentVoiceId}): "${text.substring(0, 50)}..."`);

  const response = await fetch(
    `https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        text: text,
        stream: false,
        voice_setting: {
          voice_id: currentVoiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          format: 'mp3',
          bitrate: 128000
        },
        language_boost: 'Chinese'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'MiniMax returned an error');
  }

  if (!data.data || !data.data.audio) {
    throw new Error('No audio data');
  }

  // MiniMax returns hex-encoded audio, convert to base64
  const audioBuffer = Buffer.from(data.data.audio, 'hex');
  console.log(`[TTS] MiniMax generated audio: ${audioBuffer.length} bytes`);

  if (audioBuffer.length < 100) {
    throw new Error('TTS audio data too small');
  }

  return audioBuffer.toString('base64');
}

// Frontend sets voice
ipcMain.handle('tts:setVoice', async (event, voiceId) => {
  console.log(`[TTS] Voice switched: ${currentVoiceId} → ${voiceId}`);
  currentVoiceId = voiceId;
  return { success: true };
});

// Frontend gets current voice
ipcMain.handle('tts:getVoice', async () => {
  return { voiceId: currentVoiceId };
});

// Stop TTS playback
ipcMain.handle('tts:stop', async () => {
  console.log('[TTS] Playback stopped');
  ttsQueueManager.reset();
  return { success: true };
});

// Non-streaming TTS (legacy compatibility)
ipcMain.handle('deepgram:textToSpeech', async (event, text) => {
  try {
    const audioBase64 = await callMiniMaxTTS(text);
    return { success: true, audio: audioBase64 };
  } catch (error) {
    console.error('[TTS] MiniMax failed:', error);
    return { success: false, error: error.message };
  }
});

// ===== Window Control =====
const FULL_WIDTH = 330;
const FULL_HEIGHT = 550;
const MINI_SIZE = 64;
let isMiniMode = false;

ipcMain.on('window:minimize', () => {
  if (!mainWindow) return;
  // Switch to mini mode (floating bubble)
  isMiniMode = true;
  const bounds = mainWindow.getBounds();
  // Remember expanded position
  mainWindow._restoreX = bounds.x;
  mainWindow._restoreY = bounds.y;
  // Shrink to mini mode
  mainWindow.setMinimumSize(MINI_SIZE, MINI_SIZE);
  mainWindow.setSize(MINI_SIZE, MINI_SIZE);
  // Move to bottom-right of screen
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const x = display.workArea.x + display.workArea.width - MINI_SIZE - 20;
  const y = display.workArea.y + display.workArea.height - MINI_SIZE - 20;
  mainWindow.setPosition(x, y);
  mainWindow.webContents.send('window:miniMode', true);
});

ipcMain.on('window:restore', () => {
  if (!mainWindow) return;
  isMiniMode = false;
  mainWindow.setMinimumSize(200, 300);
  mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
  // Restore previously saved position
  if (mainWindow._restoreX !== undefined) {
    mainWindow.setPosition(mainWindow._restoreX, mainWindow._restoreY);
  } else {
    mainWindow.center();
  }
  mainWindow.webContents.send('window:miniMode', false);
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// ===== File Operations =====
// Show file in Finder/Explorer
ipcMain.handle('file:showInFolder', async (event, filePath) => {
  try {
    const fs = require('fs');
    const os = require('os');

    // Expand ~ to user directory
    let expandedPath = filePath;
    if (filePath.startsWith('~/')) {
      expandedPath = filePath.replace('~', os.homedir());
    }

    // Verify if path exists
    if (!fs.existsSync(expandedPath)) {
      console.warn('[File] File does not exist:', expandedPath);
      return { success: false, error: 'File does not exist' };
    }

    // Show file in Finder/Explorer
    shell.showItemInFolder(expandedPath);
    console.log('[File] Showing in Finder:', expandedPath);
    return { success: true };
  } catch (error) {
    console.error('[File] Open failed:', error.message);
    return { success: false, error: error.message };
  }
});

// ===== App Lifecycle =====
app.whenReady().then(() => {
  createWindow();
  // Pre-connect to Clawdbot (background task)
  connectClawdbot().then(() => {
    console.log('[Start] Clawdbot pre-connection successful');
  }).catch(err => {
    console.warn('[Start] Clawdbot pre-connection failed (will retry during first conversation):', err.message);
  });
  // Note: Deepgram does not pre-connect here; it's created on first startListening
  // Because Deepgram connection requires frontend audio stream preparation
});

app.on('window-all-closed', () => {
  // Cleanup Deepgram connection
  isListeningActive = false;
  if (deepgramKeepAlive) { clearInterval(deepgramKeepAlive); deepgramKeepAlive = null; }
  if (deepgramLive) { try { deepgramLive.finish(); } catch (e) { } deepgramLive = null; }
  // Cleanup TTS queue
  ttsQueueManager.reset();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
