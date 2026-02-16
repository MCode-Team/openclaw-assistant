# Real-time Voice Interaction Documentation

## Updates

The original "Push-to-Talk" mode has been upgraded to **Live2Live Real-time Interaction Mode**.

## Main Improvements

### 1. Continuous Voice Recognition
- **Before**: Required holding the microphone button to speak; recognition stopped upon release.
- **Now**: Click the microphone once to start and once more to stop; conversation can continue uninterrupted in between.

### 2. Real-time Recognition Feedback
- While you speak, the system displays recognized content in real-time.
- Display Format: `Recognizing: [your content]`
- Commands are automatically executed once recognition is complete.

### 3. Intelligent Error Handling
- If no speech is detected, a prompt "No speech detected, please speak..." appears.
- Network errors automatically stop the process and provide a prompt.
- Other errors are accompanied by clear notification messages.

### 4. Auto-Restart Mechanism
- Voice recognition automatically restarts in the background to maintain continuous listening.
- No need for manual restarts, achieving a true "always listening" effect.

## Usage Instructions

1. **Launch Application**
   ```bash
   cd /Users/user/openclaw-assistant-mvp
   npm start
   ```

2. **Start Conversation**
   - Click the microphone icon (turns red to indicate recording).
   - Speak directly, e.g., "What emails do I have today?"
   - The system displays recognition content in real-time.
   - Commands are automatically executed once completed.

3. **Stop Conversation**
   - Click the microphone icon again to stop.

## Command Examples

- "What emails do I have today?" / "Check email"
- "Today's schedule" / "Today's report"
- Other natural language commands containing keywords.

## Technical Implementation

### Core Changes

1. **Voice Recognition Configuration** (app.js)
   ```javascript
   recognition.continuous = true;      // Enable continuous recognition
   recognition.interimResults = true;  // Show real-time results
   ```

2. **Real-time Result Processing** (app.js)
   - Distinguishes between interim and final results.
   - Interim results are used for real-time feedback.
   - Final results are used for command execution.

3. **Auto-Restart Mechanism** (app.js)
   - Automatically restarts if the system is still in recording mode when recognition ends.
   - Achieves continuous monitoring.

4. **Interaction Method** (app.js)
   - Changed from mousedown/mouseup to click events.
   - Implemented as a toggle switch rather than push-to-talk.

## Important Notes

1. **Browser Support**: Requires a browser that supports the Web Speech API (Chrome/Edge).
2. **Microphone Permission**: Permission must be granted upon first use.
3. **Network Connection**: Voice recognition requires an internet connection (Google Speech Recognition services).
4. **Language Settings**: Currently configured for Chinese recognition (zh-CN) by default.

## Future Optimization Suggestions

1. Add a voice wake word (e.g., "Hey Assistant").
2. Integrate local voice recognition to reduce network dependency.
3. Add TTS voice response capability.
4. Optimize command recognition accuracy (currently based on simple keyword matching).
5. Integrate real OpenClaw APIs (currently using mock data).
