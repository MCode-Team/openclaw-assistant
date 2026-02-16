# Crash Fix Documentation

## Issue Root Cause

The use of the deprecated `ScriptProcessorNode` API caused the application to crash.

## Fix Implementation

Reverted to the `MediaRecorder` API and added:
1. Detailed error logging
2. Improved error handling
3. MIME type compatibility checks
4. More frequent data transmission (100ms interval)

## Current Status

✅ Application restarted (Development Mode)
✅ Detailed Console logs added
✅ All errors are captured and displayed

## Testing Steps

### 1. View Application Window
The window should already be open with DevTools.

### 2. Open Console
Go to the Console tab in DevTools.

### 3. Click Microphone
Observe the Console output; you should see:
```
Requesting microphone permission...
Microphone permission granted
Deepgram connection started
Using MIME type: audio/webm;codecs=opus
MediaRecorder started
Recording started
Sending audio data: XXX bytes
```

### 4. Speech Test
Clearly say: "What emails do I have today?"

### 5. Observe Results
- If you see recognition results → Success!
- If it crashes → Check the last error message in the Console.
- If no recognition results → Check backend logs.

## Viewing Backend Logs

```bash
tail -f /tmp/electron-output.log
```

You should see:
```
Deepgram connection established
Received transcription data: {...}
Transcription result: "What emails do I have today?", isFinal: true
```

## If Crashes Persist

Please provide:
1. The last message displayed in the Console.
2. Whether you see "Requesting microphone permission".
3. Whether the microphone permission request popped up.

## Alternatives

If there are issues with Deepgram real-time streaming, we can:
1. Switch to Deepgram's pre-recorded API (recognize after recording).
2. Switch to Alibaba Cloud Speech Recognition.
3. Switch to iFlytek Speech Recognition.
4. Switch to OpenAI Whisper API.

Please test now and let me know the results!
