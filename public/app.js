// ===== App State =====
let appState = 'welcome'; // welcome | idle | listening | thinking | speaking | followup | goodbye
let isFirstLaunch = true;
let isRecording = false;
let isProcessing = false;
let isSpeaking = false;
let audioStream = null;
let audioContext = null;
let audioWorkletNode = null;
let audioPlayer = null;
let followupTimer = null;
let bubbleHideTimer = null;
let auraAnimator = null;
let executeTimer = null;
let accumulatedTranscript = '';
let lastAIResponse = ''; // Cached last AI response, used for viewing after interruption
let countdownInterval = null;

// ===== Character System =====
const CHARACTER_PROFILES = {
  lobster: {
    id: 'lobster',
    name: 'Little Shrimp',
    desc: 'Lively and cute lobster assistant',
    icon: 'mdi:fish',
    welcomeText: 'Hello everyone, I am your AI assistant Little Shrimp! I can help you with anything. How can I assist you today?',
    thinkingPrompts: [
      'Please wait a moment, I am looking that up for you~',
      'Let me think about how to help you...',
      'Thinking hard...',
      'Almost there, please wait a second~',
      'Let me see what I can do for you...',
      'Got it! Processing...',
      'Okay, I will get that done for you~',
      'Wait a moment, I will have the answer for you soon!'
    ],
    videos: {
      welcome: 'lobster-welcome.mp4',
      idle: 'lobster-listening.mp4',
      listening: 'lobster-listening.mp4',
      thinking: 'lobster-thinking.mp4',
      speaking: 'lobster-speaking.mp4',
      followup: 'lobster-listening.mp4',
      goodbye: 'lobster-idle.mp4'
    },
    auraColors: {
      idle: { r: 102, g: 126, b: 234 },
      listening: { r: 239, g: 68, b: 68 },
      thinking: { r: 245, g: 158, b: 11 },
      speaking: { r: 118, g: 75, b: 162 }
    },
    defaultVoice: 'Lovely_Girl'
  },
  amy: {
    id: 'amy',
    name: 'Amy',
    desc: 'Gentle and intellectual female assistant',
    icon: 'mdi:account-heart',
    welcomeText: 'Hello, I am Amy. It is a pleasure to serve you! Is there anything I can help you with?',
    thinkingPrompts: [
      'Please wait a moment, let me think...',
      'Looking that up for you...',
      'Just a moment~',
      'Let me see...',
      'Okay, processing right away...',
      'Thinking...',
    ],
    // Pre-query prompts (played before execution)
    preQueryPrompts: [
      'Okay, Amy will look that up for you right away',
      'Got it, Amy is checking now',
      'Okay, Amy will go take a look',
      'Understood, Amy is on it',
    ],
    videos: {
      welcome: 'amy-welcome.mp4',
      idle: 'amy-listening.mp4',
      listening: 'amy-listening.mp4',
      thinking: 'amy-listening.mp4',
      speaking: 'amy-speaking.mp4',
      followup: 'amy-listening.mp4',
      goodbye: 'amy-listening.mp4'
    },
    auraColors: {
      idle: { r: 255, g: 154, b: 162 },
      listening: { r: 255, g: 107, b: 157 },
      thinking: { r: 255, g: 183, b: 178 },
      speaking: { r: 255, g: 134, b: 154 }
    },
    defaultVoice: 'Arrogant_Miss'
  },
  cat: {
    id: 'cat',
    name: 'Meow Assistant',
    desc: 'Elegant and lazy cat assistant',
    icon: 'mdi:cat',
    welcomeText: 'Meow~ I am Meow Assistant. What do you need help with, meow?',
    thinkingPrompts: [
      'Meow~ Let me think...',
      'Thinking, meow~',
      'Just a moment, meow~',
      'Let me check, meow...',
      'Meow is thinking hard now~',
      'Almost there, meow!',
    ],
    videos: {
      welcome: 'cat-welcome.mp4',
      idle: 'cat-idle.mp4',
      listening: 'cat-listening.mp4',
      thinking: 'cat-thinking.mp4',
      speaking: 'cat-speaking.mp4',
      followup: 'cat-listening.mp4',
      goodbye: 'cat-idle.mp4'
    },
    auraColors: {
      idle: { r: 255, g: 183, b: 77 },
      listening: { r: 255, g: 107, b: 107 },
      thinking: { r: 255, g: 213, b: 79 },
      speaking: { r: 171, g: 130, b: 255 }
    },
    defaultVoice: 'Sweet_Girl_2'
  },
  robot: {
    id: 'robot',
    name: 'Mecha Assistant',
    desc: 'Efficient and precise robot assistant',
    icon: 'mdi:robot',
    welcomeText: 'System ready. I am Mecha Assistant, at your service.',
    thinkingPrompts: [
      'Analyzing data...',
      'Computing...',
      'Retrieving information...',
      'System processing, please wait...',
      'Executing analysis...',
      'Processing data...',
    ],
    videos: {
      welcome: 'robot-welcome.mp4',
      idle: 'robot-idle.mp4',
      listening: 'robot-listening.mp4',
      thinking: 'robot-thinking.mp4',
      speaking: 'robot-speaking.mp4',
      followup: 'robot-listening.mp4',
      goodbye: 'robot-idle.mp4'
    },
    auraColors: {
      idle: { r: 0, g: 200, b: 255 },
      listening: { r: 0, g: 255, b: 150 },
      thinking: { r: 255, g: 200, b: 0 },
      speaking: { r: 0, g: 150, b: 255 }
    },
    defaultVoice: 'Robot_Armor'
  }
};

let currentCharacter = CHARACTER_PROFILES.lobster;

// Current character video state mapping (dynamically switched)
let VIDEO_SOURCES = { ...currentCharacter.videos };

// Timeout for waiting for user response after follow-up (return to idle after 30s)
const FOLLOWUP_TIMEOUT = 30000;
// Bubble auto-hide time
const BUBBLE_AUTO_HIDE = 12000;
// Execution delay (time to wait after user pause, optimized from 10s to 3s)
const EXECUTE_DELAY = 3000;

// Get thinking prompts from current character configuration
function getThinkingPrompts() {
  return currentCharacter.thinkingPrompts;
}

// ===== DOM Elements =====
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const statusHint = document.getElementById('status-hint');
const lobsterArea = document.getElementById('lobster-area');
const lobsterChar = document.getElementById('lobster-char');
const stateIndicator = document.getElementById('state-indicator');
const stateDot = stateIndicator.querySelector('.state-dot');
const stateText = document.getElementById('state-text');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const tapHint = document.getElementById('tap-hint');
const listeningPulseRing = document.getElementById('listening-pulse-ring');

// ===== Initialization & Light Aura Animation =====
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('aura-canvas');
  if (canvas && window.OrbAnimator) {
    auraAnimator = new OrbAnimator(canvas);
  }
  initDeepgramListeners();
  initVoice();
  initTaskListeners();
  initMiniMode();
  initStreamingTTS();  // Initialize streaming TTS listeners
  initFilePathClickHandler();  // Initialize file path click handler

  // Play welcome video on first launch
  if (isFirstLaunch) {
    playWelcomeVideo();
  }

  console.log('[Little Shrimp] Initialized');
});

// ===== Task Listeners =====
function initTaskListeners() {
  // Listen for task completion
  window.electronAPI.task.onCompleted((data) => {
    console.log('[Little Shrimp] Task completed:', data.taskId);

    const cleanResult = cleanMarkdown(data.result);

    // Show completion notification bubble
    showBubble(`✅ Task completed! ${cleanResult}`);

    // Play completion voice
    playTextToSpeech(`Task completed! ${cleanResult}`).catch(err => {
      console.warn('[Little Shrimp] Failed to play task completion voice:', err);
    });

    // Switch to speaking state
    setAppState('speaking');

    // Return to idle after voice playback
    setTimeout(() => {
      if (appState === 'speaking') {
        setAppState('idle');
      }
    }, 5000);
  });

  // Listen for task failure
  window.electronAPI.task.onFailed((data) => {
    console.error('[Little Shrimp] Task failed:', data.taskId, data.error);

    const cleanError = cleanMarkdown(data.error);

    // Show failure notification
    showBubble(`❌ Task failed: ${cleanError}`);

    // Play failure voice
    playTextToSpeech(`Sorry, task execution failed: ${cleanError}`).catch(err => {
      console.warn('[Little Shrimp] Failed to play task failure voice:', err);
    });
  });
}

// ===== State Management =====
function setAppState(newState) {
  appState = newState;
  clearTimeout(followupTimer);

  // Update lobster animation class
  lobsterChar.className = 'lobster-character';
  stateDot.className = 'state-dot';
  statusHint.className = 'status-hint';

  // Control click guide and pulse ring
  if (newState === 'idle') {
    tapHint.classList.remove('hidden');
  } else {
    tapHint.classList.add('hidden');
  }
  if (newState === 'listening' || newState === 'followup') {
    listeningPulseRing.classList.remove('hidden');
  } else {
    listeningPulseRing.classList.add('hidden');
  }

  // Switch video source
  switchVideo(newState);

  switch (newState) {
    case 'welcome':
      tapHint.classList.add('hidden');
      stateText.textContent = `Welcome to use ${currentCharacter.name}`;
      statusHint.textContent = '';
      break;
    case 'idle':
      stateText.textContent = 'Click me to start a conversation';
      statusHint.textContent = '';
      break;
    case 'listening':
      lobsterChar.classList.add('listening');
      stateDot.classList.add('listening');
      statusHint.classList.add('listening');
      stateText.textContent = 'Listening...';
      statusHint.textContent = 'Please speak...';
      break;
    case 'thinking':
      lobsterChar.classList.add('thinking');
      stateDot.classList.add('thinking');
      statusHint.classList.add('thinking');
      stateText.textContent = 'Thinking...';
      statusHint.textContent = '🤔 Analyzing your question';
      showBubble('<div class="thinking-dots"><span></span><span></span><span></span></div>', false);
      break;
    case 'speaking':
      lobsterChar.classList.add('speaking');
      stateDot.classList.add('speaking');
      statusHint.classList.add('speaking');
      stateText.textContent = 'Replying...';
      statusHint.textContent = '💬 Answering for you';
      break;
    case 'followup':
      // Wait for user to continue speaking after TTS ends
      lobsterChar.classList.add('listening');
      stateDot.classList.add('listening');
      statusHint.classList.add('listening');
      stateText.textContent = 'Keep talking, I am listening...';
      statusHint.textContent = '💬 You can keep asking questions';
      // Timeout return to idle
      followupTimer = setTimeout(() => {
        console.log('[Little Shrimp] Follow-up timeout, returning to standby');
        stopRecording().then(() => {
          setAppState('idle');
          hideBubble(2000);
        });
      }, FOLLOWUP_TIMEOUT);
      break;
    case 'goodbye':
      stateText.textContent = 'Goodbye!';
      statusHint.textContent = '👋 Hope to see you again soon';
      break;
  }

  // Synchronize light aura animation state
  if (auraAnimator) {
    const orbState = newState === 'followup' ? 'listening' : newState;
    auraAnimator.setState(orbState);
  }

  // Synchronize mini mode state
  if (isMiniMode) {
    setMiniOrbState(newState);
  }
}

// States that requiring playing audio along with video
const VIDEO_WITH_AUDIO = ['welcome', 'thinking'];

// ===== Video Switching Function =====
function switchVideo(state) {
  const videoSource = VIDEO_SOURCES[state] || VIDEO_SOURCES.idle;
  const videoElement = document.getElementById('lobster-char');

  if (videoElement && videoElement.tagName === 'VIDEO') {
    const sourceElement = videoElement.querySelector('source');
    const currentSrc = sourceElement ? sourceElement.src : '';
    const newSrc = videoSource;

    // Only switch if video source is different
    if (!currentSrc.endsWith(newSrc)) {
      console.log(`[Video Switch] ${state} -> ${videoSource}`);

      // Add transition animation
      videoElement.classList.add('video-transition');
      setTimeout(() => videoElement.classList.remove('video-transition'), 400);

      // Save current playback state
      const wasPlaying = !videoElement.paused;

      // Update video source
      if (sourceElement) {
        sourceElement.src = newSrc;
      }

      // Decide whether to enable video audio based on state
      const useVideoAudio = VIDEO_WITH_AUDIO.includes(state);
      videoElement.muted = !useVideoAudio;

      // Reload and play
      videoElement.load();
      if (wasPlaying || useVideoAudio) {
        videoElement.play().catch(err => {
          console.warn('[Video Play] Auto-play failed:', err);
          // If voiced playback fails, downgrade to muted playback
          if (useVideoAudio) {
            videoElement.muted = true;
            videoElement.play().catch(() => { });
          }
        });
      }
    } else {
      // Video source same, but might need to update audio state
      const useVideoAudio = VIDEO_WITH_AUDIO.includes(state);
      videoElement.muted = !useVideoAudio;
    }
  }
}

// ===== Play Welcome Video =====
function playWelcomeVideo() {
  console.log('[Little Shrimp] Playing welcome video');
  setAppState('welcome');

  const videoElement = document.getElementById('lobster-char');
  if (videoElement && videoElement.tagName === 'VIDEO') {
    // Remove loop attribute, let welcome video play only once
    videoElement.loop = false;
    // Use video's own audio (unmute)
    videoElement.muted = false;

    // Listen for video playback end
    videoElement.onended = () => {
      console.log('[Little Shrimp] Welcome video finished, switching to idle state');
      videoElement.loop = true; // Restore loop
      videoElement.muted = true; // Restore mute (other states don't need video sound)
      videoElement.onended = null; // Remove listener
      isFirstLaunch = false;
      setAppState('idle');
    };

    // Ensure video replacement (try voiced playback first, then muted playback + TTS fallback)
    videoElement.play().catch(err => {
      console.warn('[Video Play] Welcome video voiced playback failed, trying muted playback + TTS fallback:', err);
      videoElement.muted = true;
      videoElement.play().catch(err2 => {
        console.warn('[Video Play] Welcome video auto-play failed completely:', err2);
        videoElement.loop = true;
        isFirstLaunch = false;
        setAppState('idle');
      });
      // Use TTS as fallback for welcome voice when muted playback is successful
      playWelcomeAudioFallback();
    });
  }
}

// ===== Play Welcome Voice (Fallback: use TTS when video cannot play voiced) =====
async function playWelcomeAudioFallback() {
  try {
    await playTextToSpeech(currentCharacter.welcomeText);
  } catch (error) {
    console.warn('[Little Shrimp] Welcome voice TTS fallback failed:', error);
  }
}

// ===== Bubble Display =====
function showBubble(content, isUserSpeech = false) {
  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';

  if (isUserSpeech) {
    speechBubble.className = 'speech-bubble user-speech';
    bubbleText.innerHTML = content;
  } else {
    speechBubble.className = 'speech-bubble ai-response';
    // Detect file paths and convert to clickable links
    bubbleText.innerHTML = linkifyFilePaths(content);
  }

  // Auto-hide
  bubbleHideTimer = setTimeout(() => {
    hideBubble();
  }, BUBBLE_AUTO_HIDE);
}

// Typewriter effect to display AI response
function showBubbleWithTyping(content) {
  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';
  speechBubble.className = 'speech-bubble ai-response';
  bubbleText.innerHTML = '';

  let index = 0;
  const typingSpeed = 30; // Delay per character (ms)

  function typeNextChar() {
    if (index < content.length) {
      bubbleText.innerHTML += content.charAt(index);
      index++;
      setTimeout(typeNextChar, typingSpeed);
    } else {
      // Append view full text button after typing finishes
      appendViewTextBtn(content);
      // Auto-hide
      bubbleHideTimer = setTimeout(() => {
        hideBubble();
      }, BUBBLE_AUTO_HIDE);
    }
  }

  typeNextChar();
}

// Bubble with view text button (used for display after interruption)
function showBubbleWithViewBtn(fullText, isInterrupted = false) {
  clearTimeout(bubbleHideTimer);
  speechBubble.style.display = 'block';
  speechBubble.className = 'speech-bubble ai-response';

  const preview = fullText.length > 40 ? fullText.substring(0, 40) + '...' : fullText;
  const label = isInterrupted ? 'Interrupted, click to view full response' : 'Click to view full response';

  bubbleText.innerHTML = `<span class="bubble-preview">${escapeHtml(preview)}</span>`;
  appendViewTextBtn(fullText, label);

  bubbleHideTimer = setTimeout(() => {
    hideBubble();
  }, BUBBLE_AUTO_HIDE * 2); // Give longer display time after interruption
}

// Append "View Full Text" button to bottom of bubble
function appendViewTextBtn(fullText, label) {
  if (!fullText || fullText.length < 20) return; // Short text doesn't need button

  const btnWrap = document.createElement('div');
  btnWrap.className = 'view-text-btn-wrap';
  btnWrap.innerHTML = `<button class="view-text-btn">${label || 'View Full Text'}</button>`;
  bubbleText.appendChild(btnWrap);

  btnWrap.querySelector('.view-text-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openTextViewer(fullText);
  });
}

// Full text viewer overlay
function openTextViewer(text) {
  // Remove existing overlay
  const existing = document.getElementById('text-viewer');
  if (existing) existing.remove();

  const viewer = document.createElement('div');
  viewer.id = 'text-viewer';
  viewer.className = 'text-viewer';
  viewer.innerHTML = `
    <div class="text-viewer-header">
      <span class="text-viewer-title">Full Response</span>
      <button class="text-viewer-close" id="text-viewer-close">×</button>
    </div>
    <div class="text-viewer-body">${escapeHtml(text)}</div>
  `;

  document.querySelector('.widget-container').appendChild(viewer);

  viewer.querySelector('#text-viewer-close').addEventListener('click', (e) => {
    e.stopPropagation();
    viewer.classList.add('closing');
    setTimeout(() => viewer.remove(), 250);
  });
}

function hideBubble(delay) {
  if (delay) {
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = setTimeout(() => {
      fadeOutBubble();
    }, delay);
  } else {
    fadeOutBubble();
  }
}

function fadeOutBubble() {
  speechBubble.style.transition = 'opacity 0.3s ease-out';
  speechBubble.style.opacity = '0';
  setTimeout(() => {
    speechBubble.style.display = 'none';
    speechBubble.style.opacity = '1';
    speechBubble.style.transition = '';
  }, 300);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup markdown formatting symbols (**bold**, *italic*, ~~strikethrough~~, etc.)
function cleanMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
    .replace(/\*(.+?)\*/g, '$1')      // *italic*
    .replace(/~~(.+?)~~/g, '$1')      // ~~strikethrough~~
    .replace(/`(.+?)`/g, '$1');       // `code`
}

// Detect file paths in text and convert to clickable links
function linkifyFilePaths(text) {
  if (!text) return text;

  // File path regex (loose matching)
  // Matches: ~/xxx, /Users/xxx, /home/xxx, etc.
  // Supports Chinese, spaces, and various special characters
  const filePathRegex = /(~\/[^\s`'"<>|]+|\/(?:Users|home|System|Applications|Library|tmp|var|etc)[^\s`'"<>|]*)/g;

  return text.replace(filePathRegex, (match) => {
    // Cleanup trailing punctuation
    let cleanPath = match.replace(/[。，,；;！!？?）)\]]+$/g, '');

    // Create clickable link
    return `<span class="file-path" data-path="${escapeHtml(cleanPath)}" title="Click to show in Finder">${escapeHtml(cleanPath)}</span>`;
  });
}

// Interrupt current task (query or playback)
function interruptCurrentTask() {
  console.log('[Little Shrimp] Interrupting current task');

  // Set interruption flag
  isProcessing = false;

  // Interrupt TTS
  interruptTTS();

  // Clear audio queue
  audioQueue = [];
  isPlayingQueue = false;
  streamingTextBuffer = '';

  // Reset state
  setAppState('idle');
  showBubble('Interrupted');
}

// Initialize file path click listener
function initFilePathClickHandler() {
  document.addEventListener('click', async (e) => {
    const pathElement = e.target.closest('.file-path');
    if (pathElement) {
      e.stopPropagation();
      const filePath = pathElement.dataset.path;

      console.log('[File] File path clicked:', filePath);

      try {
        const result = await window.electronAPI.file.showInFolder(filePath);
        if (result.success) {
          // Show success feedback
          pathElement.classList.add('clicked');
          setTimeout(() => pathElement.classList.remove('clicked'), 500);
        } else {
          console.warn('[File] Open failed:', result.error);
          // Show error bubble
          showBubble(`Cannot open path: ${result.error}`);
        }
      } catch (err) {
        console.error('[File] Call failed:', err);
      }
    }
  });
}

// Duplicate function removal (cleaned up during translation)
function initFilePathClickHandlerMissed() {
  // This was duplicated in the original code, removing the second instance.
}

// ===== Deepgram Event Listeners =====
function initDeepgramListeners() {
  window.electronAPI.deepgram.removeAllListeners();

  window.electronAPI.deepgram.onConnected(() => {
    console.log('[Little Shrimp] Deepgram connected');
  });

  window.electronAPI.deepgram.onTranscript((data) => {
    const { transcript, isFinal } = data;
    console.log(`[Little Shrimp] Recognized [${isFinal ? 'Final' : 'Interim'}]: "${transcript}"`);

    if (isFinal) {
      if (transcript.trim().length > 0) {
        // Accumulate recognition results
        if (accumulatedTranscript.length > 0) {
          accumulatedTranscript += ' ' + transcript.trim();
        } else {
          accumulatedTranscript = transcript.trim();
        }

        // Display accumulated user speech
        showBubble('🎤 ' + escapeHtml(accumulatedTranscript), true);

        // Clear previous execution timer
        clearTimeout(executeTimer);

        // Execution delay: Wait for user pause before executing command (utterance_end event can trigger early)
        executeTimer = setTimeout(() => {
          console.log('[Little Shrimp] User pause timeout, executing command');
          clearInterval(countdownInterval);
          const commandToExecute = accumulatedTranscript;
          accumulatedTranscript = '';

          stopRecording().then(() => {
            handleCommand(commandToExecute);
          });
        }, EXECUTE_DELAY);

        // Countdown display
        let countdown = Math.ceil(EXECUTE_DELAY / 1000);
        clearInterval(countdownInterval);
        statusHint.textContent = `Executing in ${countdown}s... Continue speaking to reset`;
        countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            statusHint.textContent = `Executing in ${countdown}s... Continue speaking to reset`;
          } else {
            clearInterval(countdownInterval);
          }
        }, 1000);
      }
    } else {
      // Show interim recognition text in real-time
      if (transcript.trim().length > 0) {
        statusHint.textContent = transcript + '...';
      }
    }
  });

  // Listen for speech end event (Deepgram detected user stopped speaking)
  window.electronAPI.deepgram.onUtteranceEnd(() => {
    console.log('[Little Shrimp] Speech end detected');
    if (accumulatedTranscript.trim().length > 0) {
      // Execute immediately when user has valid speech and stopped talking
      clearTimeout(executeTimer);
      clearInterval(countdownInterval);
      console.log('[Little Shrimp] Speech end, executing command immediately');
      const commandToExecute = accumulatedTranscript;
      accumulatedTranscript = '';
      stopRecording().then(() => {
        handleCommand(commandToExecute);
      });
    }
  });

  window.electronAPI.deepgram.onError((error) => {
    console.error('[Little Shrimp] Deepgram error:', error);
    stopRecording();
    setAppState('idle');
    showBubble('Recognition error, please click me and try again');
  });

  window.electronAPI.deepgram.onClosed(() => {
    console.log('[Little Shrimp] Deepgram connection closed');
  });
}

// ===== Interrupt TTS =====
// Streaming TTS audio queue
let audioQueue = [];
let isPlayingQueue = false;
let streamingTextBuffer = '';

function interruptTTS() {
  // Stop current playback
  if (audioPlayer) {
    try {
      audioPlayer.onended = null;
      audioPlayer.pause();
    } catch (e) { /* ignore */ }
    audioPlayer = null;
  }
  // Clear queue
  audioQueue = [];
  isPlayingQueue = false;
  streamingTextBuffer = '';
  isSpeaking = false;
  // Notify main process to stop TTS generation
  window.electronAPI.tts.stop();
}

// ===== Streaming TTS Initialization =====
function initStreamingTTS() {
  // Listen for audio chunks
  window.electronAPI.deepgram.onAudioChunk(async (data) => {
    console.log(`[TTS] Received audio chunk #${data.sentenceId}`);

    audioQueue.push(data);

    if (!isPlayingQueue) {
      await processAudioQueue();
    }
  });

  // Listen for the first sentence (switch state, but don't display text yet)
  window.electronAPI.deepgram.onFirstSentence((data) => {
    console.log('[TTS] First sentence arrived, preparing playback');
    // Switch to speaking state
    if (appState === 'thinking') {
      setAppState('speaking');
    }
    // Don't display text yet, wait until audio starts playing
  });
}

// Process audio queue
async function processAudioQueue() {
  if (isPlayingQueue || audioQueue.length === 0) return;

  isPlayingQueue = true;

  while (audioQueue.length > 0) {
    const item = audioQueue.shift();

    // Play audio (display text only when audio starts playing)
    await playAudioChunk(item.audio, item.text);
  }

  isPlayingQueue = false;
  isSpeaking = false;

  // TTS playback finished, enter follow-up mode
  if (appState === 'speaking') {
    isProcessing = false;
    setAppState('followup');
    await startRecording();
  }
}

// Play single audio chunk (display text only when audio starts playing)
function playAudioChunk(audioBase64, text) {
  return new Promise((resolve) => {
    const audioDataUrl = 'data:audio/mp3;base64,' + audioBase64;
    const audio = new Audio(audioDataUrl);

    // Display text only when audio starts playing
    audio.onplay = () => {
      // Append text to buffer and update display
      if (streamingTextBuffer && !streamingTextBuffer.includes(text)) {
        streamingTextBuffer += text;
      } else {
        streamingTextBuffer = text;
      }
      showBubble(escapeHtml(streamingTextBuffer));
    };

    audio.onended = () => {
      resolve();
    };

    audio.onerror = () => {
      resolve();
    };

    audio.play().catch(() => resolve());

    audioPlayer = audio;
  });
}

// ===== Recording Control =====
async function startRecording() {
  if (isRecording || isProcessing) return;

  try {
    interruptTTS();

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000
      }
    });

    const result = await window.electronAPI.deepgram.startListening();
    if (!result.success) {
      showBubble('Failed to start speech recognition, please check your configuration');
      setAppState('idle');
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
      return;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    await audioContext.audioWorklet.addModule('audio-processor.js');
    const source = audioContext.createMediaStreamSource(audioStream);
    audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

    audioWorkletNode.port.onmessage = (event) => {
      if (isRecording && event.data) {
        const uint8 = new Uint8Array(event.data);
        window.electronAPI.deepgram.sendAudio(uint8);
      }
    };

    source.connect(audioWorkletNode);
    isRecording = true;

  } catch (error) {
    console.error('[Little Shrimp] Recording failed:', error);
    setAppState('idle');
    if (error.name === 'NotAllowedError') {
      showBubble('Please allow microphone access before clicking me');
    } else if (error.name === 'NotFoundError') {
      showBubble('Microphone not detected');
    } else {
      showBubble('Failed to start recording: ' + error.message);
    }
  }
}

async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;

  // Clear execution timer and countdown
  clearTimeout(executeTimer);
  clearInterval(countdownInterval);
  executeTimer = null;

  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    try { audioWorkletNode.port.close(); } catch (e) { }
    audioWorkletNode = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    await audioContext.close();
    audioContext = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  await window.electronAPI.deepgram.stopListening();
}

// ===== Click Lobster → Start Listening =====
async function onLobsterClick() {
  // Allow interruption while speaking → start listening immediately
  if (appState === 'speaking') {
    interruptTTS();
    isProcessing = false;
    if (lastAIResponse) {
      showBubbleWithViewBtn(lastAIResponse, true);
    }
    // Start listening immediately after interruption
    accumulatedTranscript = '';
    setAppState('listening');
    await startRecording();
    return;
  }

  // Allow interruption while thinking → stop current task
  if (appState === 'thinking') {
    console.log('[Little Shrimp] Interrupting query task');
    interruptCurrentTask();
    return;
  }

  if (isProcessing) return;

  if (appState === 'listening' || appState === 'followup') {
    // Click again → stop listening
    clearTimeout(executeTimer);
    accumulatedTranscript = '';
    await stopRecording();
    setAppState('idle');
    return;
  }

  // Clear previous accumulated text
  accumulatedTranscript = '';

  // Trigger animation
  lobsterChar.classList.add('active');
  setTimeout(() => lobsterChar.classList.remove('active'), 600);

  // Start listening
  hideBubble();
  setAppState('listening');
  await startRecording();
}

// ===== Handle Commands =====
async function handleCommand(command) {
  if (isProcessing) return;

  // Detect if it is an asynchronous task
  const asyncKeywords = ['later', 'wait a while', 'tell me later', 'tell me when finished', 'tell me when ready', 'tell me when done'];
  const isAsyncTask = asyncKeywords.some(keyword => command.toLowerCase().includes(keyword));

  // Detect if it is a farewell
  const goodbyeKeywords = ['goodbye', 'bye', 'exit', 'close', 'see you'];
  const isGoodbye = goodbyeKeywords.some(keyword =>
    command.toLowerCase().includes(keyword)
  );

  if (isAsyncTask) {
    // Asynchronous task processing
    await handleAsyncTask(command);
  } else {
    // Synchronous task processing
    await handleSyncTask(command, isGoodbye);
  }
}

// ===== Handle Asynchronous Tasks =====
async function handleAsyncTask(command) {
  isProcessing = true;

  try {
    // Create asynchronous task
    const result = await window.electronAPI.task.create(command);

    if (result.success) {
      console.log(`[Little Shrimp] Created async task: ${result.taskId}`);

      // Immediate feedback
      const feedbackMessages = [
        'Okay, I am on it, I will tell you later~',
        'Got it! I will check right away and notify you when finished',
        'Understood, let me see, I will tell you the result later',
        'Sure, I will handle it for you and call you when done~'
      ];
      const feedback = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];

      showBubble(feedback);
      await playTextToSpeech(feedback);

      setAppState('idle');
    }
  } catch (error) {
    console.error('[Little Shrimp] Failed to create async task:', error);
    showBubble('Task creation failed, please try again');
    setAppState('idle');
  } finally {
    isProcessing = false;
  }
}

// ===== Handle Synchronous Tasks =====
async function handleSyncTask(command, isGoodbye) {
  isProcessing = true;

  setAppState('thinking');

  // If current character has preQueryPrompts, play prompt first before execution
  if (currentCharacter.preQueryPrompts && currentCharacter.preQueryPrompts.length > 0) {
    const prePrompt = currentCharacter.preQueryPrompts[Math.floor(Math.random() * currentCharacter.preQueryPrompts.length)];
    showBubble(prePrompt);
    // Play prompt (non-streaming TTS)
    await playTextToSpeech(prePrompt);
  } else {
    // Other characters show thinking prompts
    const prompts = getThinkingPrompts();
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    showBubble(randomPrompt);
  }

  // Reset streaming TTS state
  streamingTextBuffer = '';
  audioQueue = [];
  isPlayingQueue = false;
  isSpeaking = true;  // Mark as playing

  try {
    const result = await window.electronAPI.executeCommand(command);

    // Clean markdown symbols
    const cleanedMessage = cleanMarkdown(result.message);

    // Cache AI response (for viewing after interruption)
    lastAIResponse = cleanedMessage;

    // Streaming TTS is already playing in the background (driven by initStreamingTTS listening events)
    // If no audio chunks were received (e.g., Clawdbot returns empty), use traditional TTS as fallback
    if (audioQueue.length === 0 && !isPlayingQueue) {
      // No streaming audio received, use traditional TTS
      setAppState('speaking');
      showBubbleWithViewBtn(cleanedMessage);
      await playTextToSpeech(cleanedMessage);

      // Show text with typewriter effect after TTS ends
      showBubbleWithTyping(escapeHtml(cleanedMessage));

      // If it's a farewell, play farewell animation
      if (isGoodbye) {
        setAppState('goodbye');
        isProcessing = false;
        setTimeout(() => {
          setAppState('idle');
        }, 3000);
      } else {
        // Enter follow-up mode
        isProcessing = false;
        setAppState('followup');
        await startRecording();
      }
    }
    // If it's a farewell, special treatment
    if (isGoodbye) {
      setAppState('goodbye');
      isProcessing = false;
      setTimeout(() => {
        setAppState('idle');
      }, 3000);
    }
    // Otherwise, streaming TTS will automatically enter followup mode in processAudioQueue

  } catch (error) {
    console.error('[Little Shrimp] Processing failed:', error);
    showBubble('Something went wrong, click me to try again');
    setAppState('idle');
    isProcessing = false;
    isSpeaking = false;
  }
}

// ===== TTS Playback =====
async function playTextToSpeech(text) {
  if (isSpeaking) interruptTTS();

  try {
    isSpeaking = true;
    const result = await window.electronAPI.deepgram.textToSpeech(text);

    if (!result.success) {
      console.warn('[Little Shrimp] TTS failed:', result.error);
      isSpeaking = false;
      return;
    }

    const audioDataUrl = 'data:audio/mp3;base64,' + result.audio;

    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }

    audioPlayer = new Audio(audioDataUrl);

    return new Promise((resolve) => {
      audioPlayer.onended = () => {
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      };

      audioPlayer.onerror = (e) => {
        console.error('[Little Shrimp] TTS playback error:', e);
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      };

      audioPlayer.play().catch((err) => {
        console.error('[Little Shrimp] TTS play() failed:', err);
        isSpeaking = false;
        audioPlayer = null;
        resolve();
      });
    });
  } catch (error) {
    console.error('[Little Shrimp] TTS failed:', error);
    isSpeaking = false;
    audioPlayer = null;
  }
}

// ===== Voice Selection =====
const voicePanel = document.getElementById('voice-panel');
const voiceList = document.getElementById('voice-list');
const voiceSelectBtn = document.getElementById('voice-select-btn');
const closeVoicePanel = document.getElementById('close-voice-panel');

// MiniMax System Voice List (Chinese + English)
const VOICE_OPTIONS = [
  // ===== Recommended =====
  {
    group: 'Recommended', lang: 'all', voices: [
      { id: 'Lovely_Girl', icon: 'mdi:ribbon', name: 'Lovely Girl', desc: 'Sweet and cute', gender: 'female' },
      { id: 'Lively_Girl', icon: 'mdi:star-four-points', name: 'Lively Girl', desc: 'Full of energy', gender: 'female' },
      { id: 'Decent_Boy', icon: 'mdi:account', name: 'Sunshine Boy', desc: 'Clean and fresh', gender: 'male' },
      { id: 'Friendly_Person', icon: 'mdi:emoticon-happy', name: 'Friendly Person', desc: 'Kind and natural', gender: 'female' },
    ]
  },
  // ===== Chinese Female =====
  {
    group: 'Chinese Female', lang: 'zh', voices: [
      { id: 'Chinese (Mandarin)_Cute_Spirit', icon: 'mdi:face-woman-shimmer', name: 'Cute Spirit', desc: 'Lively and cute', gender: 'female' },
      { id: 'Chinese (Mandarin)_Warm_Girl', icon: 'mdi:flower', name: 'Warm Girl', desc: 'Gentle and healing', gender: 'female' },
      { id: 'Chinese (Mandarin)_Soft_Girl', icon: 'mdi:cloud', name: 'Soft Girl', desc: 'Soft and sweet', gender: 'female' },
      { id: 'Chinese (Mandarin)_Crisp_Girl', icon: 'mdi:bell', name: 'Crisp Girl', desc: 'Clear and tender', gender: 'female' },
      { id: 'Chinese (Mandarin)_BashfulGirl', icon: 'mdi:emoticon-blush', name: 'Bashful Girl', desc: 'Reserved and shy', gender: 'female' },
      { id: 'Chinese (Mandarin)_Warm_Bestie', icon: 'mdi:heart', name: 'Warm Bestie', desc: 'Kind and warm', gender: 'female' },
      { id: 'Chinese (Mandarin)_IntellectualGirl', icon: 'mdi:book-open-page-variant', name: 'Intellectual Girl', desc: 'Intellectual and elegant', gender: 'female' },
      { id: 'Chinese (Mandarin)_Sweet_Lady', icon: 'mdi:flower-rose', name: 'Sweet Lady', desc: 'Mature and sweet', gender: 'female' },
      { id: 'Chinese (Mandarin)_Mature_Woman', icon: 'mdi:account-tie', name: 'Mature Woman', desc: 'Stable and atmospheric', gender: 'female' },
      { id: 'Chinese (Mandarin)_News_Anchor', icon: 'mdi:television', name: 'News Anchor', desc: 'Standard broadcast', gender: 'female' },
      { id: 'Arrogant_Miss', icon: 'mdi:crown', name: 'Arrogant Miss', desc: 'Cool and arrogant', gender: 'female' },
      { id: 'Sweet_Girl_2', icon: 'mdi:candy', name: 'Sweetie Girl', desc: 'Sweet and gentle', gender: 'female' },
      { id: 'Exuberant_Girl', icon: 'mdi:party-popper', name: 'Exuberant Girl', desc: 'Vibrant', gender: 'female' },
      { id: 'Inspirational_girl', icon: 'mdi:sparkles', name: 'Radiant Girl', desc: 'Positive energy', gender: 'female' },
      { id: 'Calm_Woman', icon: 'mdi:yoga', name: 'Calm Woman', desc: 'Stable and serene', gender: 'female' },
      { id: 'Wise_Woman', icon: 'mdi:book', name: 'Wise Woman', desc: 'Professional and mature', gender: 'female' },
      { id: 'Imposing_Manner', icon: 'mdi:chess-queen', name: 'Graceful Queen', desc: 'Powerful and domineering', gender: 'female' },
    ]
  },
  // ===== Chinese Male =====
  {
    group: 'Chinese Male', lang: 'zh', voices: [
      { id: 'Chinese (Mandarin)_Gentle_Youth', icon: 'mdi:weather-night', name: 'Gentle Youth', desc: 'Gentle and refined', gender: 'male' },
      { id: 'Chinese (Mandarin)_Straightforward_Boy', icon: 'mdi:arm-flex', name: 'Straightforward Boy', desc: 'Direct and frank', gender: 'male' },
      { id: 'Chinese (Mandarin)_Pure-hearted_Boy', icon: 'mdi:heart-outline', name: 'Pure-hearted Boy', desc: 'Pure and clear', gender: 'male' },
      { id: 'Chinese (Mandarin)_Gentleman', icon: 'mdi:hat-fedora', name: 'Gentleman', desc: 'Refined and polite', gender: 'male' },
      { id: 'Chinese (Mandarin)_Male_Announcer', icon: 'mdi:microphone', name: 'Male Announcer', desc: 'Deep broadcast', gender: 'male' },
      { id: 'Chinese (Mandarin)_Radio_Host', icon: 'mdi:radio', name: 'Radio Host', desc: 'Late night radio', gender: 'male' },
      { id: 'Chinese (Mandarin)_Reliable_Executive', icon: 'mdi:tie', name: 'Reliable Executive', desc: 'Stable and professional', gender: 'male' },
      { id: 'Young_Knight', icon: 'mdi:sword-cross', name: 'Young Knight', desc: 'Youthful feeling', gender: 'male' },
      { id: 'Casual_Guy', icon: 'mdi:sunglasses', name: 'Casual Guy', desc: 'Easy and casual', gender: 'male' },
      { id: 'Patient_Man', icon: 'mdi:tree', name: 'Patient Man', desc: 'Gentle and patient', gender: 'male' },
      { id: 'Deep_Voice_Man', icon: 'mdi:microphone-variant', name: 'Deep Voice Man', desc: 'Deep and powerful', gender: 'male' },
      { id: 'Determined_Man', icon: 'mdi:target', name: 'Determined Man', desc: 'Decisive and firm', gender: 'male' },
      { id: 'Elegant_Man', icon: 'mdi:glass-wine', name: 'Elegant Man', desc: 'Refined and sophisticated', gender: 'male' },
      { id: 'Robot_Armor', icon: 'mdi:robot', name: 'Robot Armor', desc: 'Robot', gender: 'male' },
    ]
  },
  // ===== English Female Voices =====
  {
    group: 'English Female', lang: 'en', voices: [
      { id: 'English_expressive_narrator', icon: 'mdi:book-open', name: 'Narrator', desc: 'Expressive storyteller', gender: 'female' },
      { id: 'English_radiant_girl', icon: 'mdi:star-four-points', name: 'Radiant Girl', desc: 'Bright and cheerful', gender: 'female' },
      { id: 'English_compelling_lady', icon: 'mdi:briefcase', name: 'Compelling Lady', desc: 'Professional tone', gender: 'female' },
      { id: 'English_sweet_lady', icon: 'mdi:flower', name: 'Sweet Lady', desc: 'Gentle and warm', gender: 'female' },
      { id: 'English_warm_woman', icon: 'mdi:coffee', name: 'Warm Woman', desc: 'Comforting voice', gender: 'female' },
      { id: 'English_cute_girl', icon: 'mdi:ribbon', name: 'Cute Girl', desc: 'Adorable tone', gender: 'female' },
      { id: 'English_lively_girl', icon: 'mdi:party-popper', name: 'Lively Girl', desc: 'Energetic vibe', gender: 'female' },
      { id: 'English_confident_woman', icon: 'mdi:account-tie', name: 'Confident Woman', desc: 'Strong presence', gender: 'female' },
    ]
  },
  // ===== English Male Voices =====
  {
    group: 'English Male', lang: 'en', voices: [
      { id: 'English_magnetic_male', icon: 'mdi:microphone', name: 'Magnetic Male', desc: 'Deep and rich', gender: 'male' },
      { id: 'English_calm_man', icon: 'mdi:yoga', name: 'Calm Man', desc: 'Soothing voice', gender: 'male' },
      { id: 'English_gentle_man', icon: 'mdi:hat-fedora', name: 'Gentleman', desc: 'Refined tone', gender: 'male' },
      { id: 'English_casual_guy', icon: 'mdi:sunglasses', name: 'Casual Guy', desc: 'Relaxed style', gender: 'male' },
      { id: 'English_young_man', icon: 'mdi:account', name: 'Young Man', desc: 'Youthful energy', gender: 'male' },
      { id: 'English_professional_man', icon: 'mdi:tie', name: 'Professional', desc: 'Business tone', gender: 'male' },
      { id: 'English_storyteller', icon: 'mdi:book-open-page-variant', name: 'Storyteller', desc: 'Narrative voice', gender: 'male' },
      { id: 'English_friendly_man', icon: 'mdi:emoticon-happy', name: 'Friendly Man', desc: 'Approachable', gender: 'male' },
    ]
  },
];

let currentSelectedVoice = 'Lovely_Girl';
let currentFilter = 'all'; // all | zh | en
let previewingVoice = null;

function renderVoiceList() {
  voiceList.innerHTML = '';

  VOICE_OPTIONS.forEach(group => {
    // Filter: 'all' shows everything, 'zh' shows Chinese and Recommended, 'en' shows English and Recommended
    if (currentFilter !== 'all' && group.lang !== 'all' && group.lang !== currentFilter) {
      return;
    }

    const groupLabel = document.createElement('div');
    groupLabel.className = 'voice-group-label';
    groupLabel.textContent = group.group;
    voiceList.appendChild(groupLabel);

    group.voices.forEach(voice => {
      const item = document.createElement('div');
      item.className = 'voice-item' + (voice.id === currentSelectedVoice ? ' active' : '');
      item.innerHTML = `
        <span class="voice-icon"><span class="iconify" data-icon="${voice.icon}"></span></span>
        <div class="voice-info">
          <div class="voice-name">${voice.name}</div>
          <div class="voice-desc">${voice.desc}</div>
        </div>
        <button class="voice-preview-btn" data-voice="${voice.id}" title="Preview">
          <span class="iconify" data-icon="mdi:play"></span>
        </button>
        ${voice.id === currentSelectedVoice ? '<span class="voice-check"><span class="iconify" data-icon="mdi:check"></span></span>' : ''}
      `;

      // Click to select voice
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.voice-preview-btn')) {
          selectVoice(voice.id);
        }
      });

      // Preview button
      const previewBtn = item.querySelector('.voice-preview-btn');
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewVoice(voice.id, voice.name);
      });

      voiceList.appendChild(item);
    });
  });
}

function setFilter(filter) {
  currentFilter = filter;
  // Update filter button state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderVoiceList();
}

async function previewVoice(voiceId, voiceName) {
  if (previewingVoice === voiceId) return;

  previewingVoice = voiceId;
  const previewText = voiceId.startsWith('English') ? 'Hello! Nice to meet you.' : 'Hello, nice to meet you!';

  try {
    // Temporarily set voice
    await window.electronAPI.tts.setVoice(voiceId);
    const result = await window.electronAPI.deepgram.textToSpeech(previewText);

    if (result.success) {
      const audio = new Audio('data:audio/mp3;base64,' + result.audio);
      audio.onended = () => { previewingVoice = null; };
      audio.onerror = () => { previewingVoice = null; };
      await audio.play();
    }

    // Restore original voice
    await window.electronAPI.tts.setVoice(currentSelectedVoice);
  } catch (e) {
    console.error('[Little Shrimp] Preview failed:', e);
    previewingVoice = null;
    await window.electronAPI.tts.setVoice(currentSelectedVoice);
  }
}

async function selectVoice(voiceId) {
  currentSelectedVoice = voiceId;
  await window.electronAPI.tts.setVoice(voiceId);
  renderVoiceList();
  // Find voice name to show toast
  let voiceName = voiceId;
  for (const g of VOICE_OPTIONS) {
    const v = g.voices.find(v => v.id === voiceId);
    if (v) { voiceName = v.name; break; }
  }
  showBubble(`Voice switched to "${escapeHtml(voiceName)}"`);
  setTimeout(() => {
    voicePanel.style.display = 'none';
  }, 600);
}

function openVoicePanel() {
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });
  renderVoiceList();
  voicePanel.style.display = 'flex';

  // Bind filter button events
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => setFilter(btn.dataset.filter);
  });
}

// Get current voice on initialization
async function initVoice() {
  try {
    const result = await window.electronAPI.tts.getVoice();
    if (result.voiceId) currentSelectedVoice = result.voiceId;
  } catch (e) { }
}

// ===== Character Switching =====
const characterPanel = document.getElementById('character-panel');
const characterList = document.getElementById('character-list');
const characterSelectBtn = document.getElementById('character-select-btn');
const closeCharacterPanel = document.getElementById('close-character-panel');

function renderCharacterList() {
  characterList.innerHTML = '';

  // Check if character video resources are available
  const availableCharacters = ['lobster', 'amy']; // Characters with video resources

  Object.values(CHARACTER_PROFILES).forEach(char => {
    const item = document.createElement('div');
    item.className = 'character-item' + (char.id === currentCharacter.id ? ' active' : '');

    const isAvailable = availableCharacters.includes(char.id);

    item.innerHTML = `
      <span class="character-icon"><span class="iconify" data-icon="${char.icon}"></span></span>
      <div class="character-info">
        <div class="character-name">${char.name}${!isAvailable ? ' <span class="coming-soon">Coming Soon</span>' : ''}</div>
        <div class="character-desc">${char.desc}</div>
      </div>
      ${char.id === currentCharacter.id ? '<span class="character-check"><span class="iconify" data-icon="mdi:check"></span></span>' : ''}
    `;

    if (isAvailable) {
      item.addEventListener('click', () => {
        switchCharacter(char.id);
      });
    } else {
      item.classList.add('disabled');
    }

    characterList.appendChild(item);
  });
}

async function switchCharacter(characterId) {
  const newChar = CHARACTER_PROFILES[characterId];
  if (!newChar || newChar.id === currentCharacter.id) return;

  console.log(`[Character Switch] ${currentCharacter.name} → ${newChar.name}`);

  // Update character
  currentCharacter = newChar;
  VIDEO_SOURCES = { ...newChar.videos };

  // Update aura colors
  if (auraAnimator && newChar.auraColors) {
    auraAnimator.updateColors(newChar.auraColors);
  }

  // Switch default voice
  currentSelectedVoice = newChar.defaultVoice;
  try {
    await window.electronAPI.tts.setVoice(newChar.defaultVoice);
  } catch (e) { }

  // Close panel
  characterPanel.style.display = 'none';

  // Show switch toast
  showBubble(`Switched to "${escapeHtml(newChar.name)}"`);

  // Replay welcome video
  isFirstLaunch = true;
  playWelcomeVideo();

  // Refresh character and voice lists
  renderCharacterList();
  renderVoiceList();
}

function openCharacterPanel() {
  renderCharacterList();
  characterPanel.style.display = 'flex';
}

// ===== Float Orb Mode =====
const miniOrb = document.getElementById('mini-orb');
const widgetContainer = document.getElementById('widget-container');
const miniOrbVideo = document.getElementById('mini-orb-video');
let isMiniMode = false;
let miniOrbClickTimer = null;

function initMiniMode() {
  // Listen for mini mode switch from main process
  window.electronAPI.onMiniMode((isMini) => {
    if (isMini) {
      enterMiniMode();
    } else {
      exitMiniMode();
    }
  });

  // Single click orb = start/stop listening; Double click orb = restore large window
  miniOrb.addEventListener('click', (e) => {
    console.log('[Float Orb] Click event triggered, isMiniMode:', isMiniMode, 'target:', e.target.className);
    // Do nothing when clicking expand button
    if (e.target.closest('.mini-expand-btn')) return;

    if (miniOrbClickTimer) {
      // Double click: restore large window
      clearTimeout(miniOrbClickTimer);
      miniOrbClickTimer = null;
      console.log('[Float Orb] Double click → Restoring large window');
      window.electronAPI.restoreWindow();
    } else {
      // Wait to determine if it is a double click
      miniOrbClickTimer = setTimeout(() => {
        miniOrbClickTimer = null;
        console.log('[Float Orb] Single click → Toggling listening');
        // Single click: toggle listening
        onMiniOrbTap();
      }, 250);
    }
  });

  // Expand button
  const expandBtn = document.getElementById('mini-expand-btn');
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.electronAPI.restoreWindow();
    });
  }
}

// Float orb single tap → start/stop listening
async function onMiniOrbTap() {
  console.log('[Float Orb] onMiniOrbTap, isMiniMode:', isMiniMode, 'appState:', appState, 'isProcessing:', isProcessing);
  if (!isMiniMode) return;

  // Allow interruption while speaking → start listening immediately
  if (appState === 'speaking') {
    interruptTTS();
    isProcessing = false;
    accumulatedTranscript = '';
    setAppState('listening');
    await startRecording();
    return;
  }

  if (isProcessing) return;

  if (appState === 'listening' || appState === 'followup') {
    // Currently listening → stop
    clearTimeout(executeTimer);
    accumulatedTranscript = '';
    await stopRecording();
    setMiniOrbState('idle');
    setAppState('idle');
    return;
  }

  // Start listening
  accumulatedTranscript = '';
  setAppState('listening');
  setMiniOrbState('listening');
  await startRecording();
}

// Update float orb visual state
function setMiniOrbState(state) {
  if (!isMiniMode) return;
  miniOrb.classList.remove('mini-listening', 'mini-thinking', 'mini-speaking');
  if (state === 'listening' || state === 'followup') {
    miniOrb.classList.add('mini-listening');
  } else if (state === 'thinking') {
    miniOrb.classList.add('mini-thinking');
  } else if (state === 'speaking') {
    miniOrb.classList.add('mini-speaking');
  }
  // Switch float orb video matching state
  const videoSrc = VIDEO_SOURCES[state] || VIDEO_SOURCES.idle;
  const source = miniOrbVideo.querySelector('source');
  if (source && !source.src.endsWith(videoSrc)) {
    source.src = videoSrc;
    miniOrbVideo.load();
    miniOrbVideo.play().catch(() => { });
  }
}

function enterMiniMode() {
  console.log('[Float Orb] Entering mini mode');
  isMiniMode = true;
  widgetContainer.style.display = 'none';
  miniOrb.style.display = 'flex';
  // Update float orb video to current state
  setMiniOrbState(appState);
}

function exitMiniMode() {
  console.log('[Float Orb] Exiting mini mode, restoring full window');
  isMiniMode = false;
  miniOrb.style.display = 'none';
  miniOrb.classList.remove('mini-listening', 'mini-thinking', 'mini-speaking');
  widgetContainer.style.display = 'flex';

  // If restoring while listening, maintain listening state
  if (appState === 'listening' || appState === 'followup') {
    setAppState(appState);
  }
}

// ===== Event Listeners =====
lobsterArea.addEventListener('click', onLobsterClick);

voiceSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openVoicePanel();
});

characterSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openCharacterPanel();
});

closeCharacterPanel.addEventListener('click', (e) => {
  e.stopPropagation();
  characterPanel.style.display = 'none';
});

closeVoicePanel.addEventListener('click', (e) => {
  e.stopPropagation();
  voicePanel.style.display = 'none';
});

minimizeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.minimizeWindow();
});

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.closeWindow();
});

// ===== Text Input Handling =====
async function handleTextInput() {
  const text = textInput.value.trim();
  if (!text || isProcessing) return;

  // Clear input field
  textInput.value = '';

  // Show user typed text
  showBubble('💬 ' + escapeHtml(text), true);

  // Directly handle command (no need for speech recognition)
  await handleCommand(text);
}

sendBtn.addEventListener('click', handleTextInput);

textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleTextInput();
  }
});
