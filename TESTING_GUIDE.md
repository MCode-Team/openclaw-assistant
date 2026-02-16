# Testing Guide

## Current Status

✅ Deepgram API Key configured.
✅ Application launched.
✅ Environment variables loaded.

## Testing Steps

### 1. Open Application Window
The application should already be visible on your screen. If not, check your Taskbar or Dock.

### 2. Test Voice Recognition

**Process**:
1. Click the microphone icon (it should turn red).
2. Speak into the microphone, for example:
   - "What emails do I have today?"
   - "Today's schedule"
   - "Check email"

**Expected Results**:
- Microphone icon turns red after clicking.
- Chat bubble displays "Listening...".
- While speaking, real-time feedback: `Recognizing: [your content]`.
- Upon completion: `Received instruction: "[your command]"`.
- Automatic command execution and results panel display.

### 3. Stop Recording
Click the microphone icon again to stop recording.

## Debug Mode

If you encounter issues, enable Developer Tools to view detailed logs:

```bash
# Stop current application
pkill -f "electron.*openclaw-assistant-mvp"

# Start in development mode
npm run dev
```

Development mode automatically opens Chrome DevTools where you can review:
- Console logs.
- Network requests.
- Error messages.

## Common Troubleshooting

### 1. Microphone Permissions
If prompted to "Please allow microphone access":
- macOS: System Settings → Security & Privacy → Privacy → Microphone.
- Ensure Electron or the application has microphone access.

### 2. No Recognition Results
- Check if your microphone is working correctly.
- Try speaking more clearly.
- Check your internet connection (Deepgram requires network access).

### 3. API Key Errors
If there are API Key-related errors:
- Check if the `.env` file exists.
- Confirm the API Key is correct.
- Restart the application.

## Test Commands

Supported command keywords:
- **Email**: "email"
- **Schedule**: "report", "briefing", "today", "schedule"

## Real-time Recognition Flow

Under normal conditions, you will see:
1. Click Mic → "Listening..."
2. Start Speaking → "Recognizing: Today I..."
3. Continue Speaking → "Recognizing: What emails do I have today?"
4. Recognition Complete → "Received instruction: What emails do I have today?"
5. Display Result → Email list panel pops up.

## Performance Metrics

- **Latency**: Typically < 500ms.
- **Accuracy**: Recognition accuracy > 90%.
- **Real-time Performance**: Results displayed as you speak.

## Next Steps

After a successful test, you can:
1. Try more natural language commands.
2. Test continuous conversation (don't stop recording, give multiple commands).
3. Check usage stats in the Deepgram Console.

## Technical Support

If issues persist, check:
- Console logs (Development mode).
- `DEEPGRAM_SETUP.md` for detailed documentation.
- Deepgram Console: https://console.deepgram.com/
Riverside
