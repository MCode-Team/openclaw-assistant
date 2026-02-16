# Deepgram Real-time Voice Recognition Integration Guide

## Overview

The project has been upgraded from the Web Speech API to a Deepgram-based real-time voice recognition architecture, addressing connectivity issues and improving performance.

## Architecture

### Tech Stack
- **Frontend**: MediaRecorder API (Audio Capture)
- **Backend**: Deepgram SDK (Real-time Recognition)
- **Communication**: Electron IPC (Audio Stream Transmission)

### Data Flow
```
Microphone → MediaRecorder → IPC → Deepgram Live API → Real-time Transcription → Command Processing
```

## Configuration Steps

### 1. Get Deepgram API Key

1. Visit [Deepgram Console](https://console.deepgram.com/)
2. Register or log in to your account.
3. Create a new project.
4. Generate an API Key.
5. Copy the API Key.

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file and enter your API Key:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### 3. Start the Application

```bash
npm start
```

## Usage Instructions

1. **Start Conversation**
   - Click the microphone icon (turns red to indicate recording).
   - Speak directly; the system will display recognition content in real-time.
   - Format: `Recognizing: [your speech content]`

2. **Execute Commands**
   - Say a complete command, e.g., "What emails do I have today?"
   - The system automatically executes the command after recognition is complete.
   - Results are displayed, and the corresponding panel opens.

3. **Stop Conversation**
   - Click the microphone icon again to stop recording.

## Supported Commands

- "What emails do I have today?" / "Check email" / "email"
- "Today's schedule" / "Today's report" / "briefing"
- Other natural language commands containing keywords.

## Technical Details

### Deepgram Configuration

```javascript
{
  model: 'nova-2',           // Latest recognition model
  language: 'zh-CN',         // Chinese recognition (switch as needed)
  smart_format: true,        // Smart formatting (punctuation, etc.)
  interim_results: true,     // Return intermediate results
  utterance_end_ms: 1000,    // Sentence end detection (1 second)
  vad_events: true           // Voice Activity Detection
}
```

### Audio Parameters

```javascript
{
  channelCount: 1,           // Mono
  sampleRate: 16000          // 16kHz sample rate
}
```

### MediaRecorder Configuration

```javascript
{
  mimeType: 'audio/webm;codecs=opus',  // Opus encoding
  timeslice: 250                        // Send data every 250ms
}
```

## Comparison with Web Speech API

| Feature | Web Speech API | Deepgram |
|------|----------------|----------|
| Network Dependency | Google Services (Inaccessible in some regions) | Deepgram API (Globally accessible) |
| Accuracy | Medium | High |
| Real-time Performance | Good | Excellent |
| Language Support | Limited | Wide |
| Cost | Free | Pay-as-you-go |
| Customizability | Limited | Rich |

## Common Questions

### 1. "Please configure Deepgram API Key first"

**Cause**: API Key not configured or incorrect.
**Solution**: Check if the `.env` file exists and if the API Key is correct.

### 2. Microphone Permission Denied

**Cause**: Browser/System microphone permission not granted.
**Solution**:
- macOS: System Settings → Security & Privacy → Microphone.
- Browser: Click the microphone icon in the address bar to allow access.

### 3. Inaccurate Recognition

**Possible Causes**:
- High ambient noise.
- Poor microphone quality.
- Unclear speech.

**Optimization Tips**:
- Use a high-quality microphone.
- Use in a quiet environment.
- Speak clearly and at a moderate speed.

### 4. Network Connection Error

**Cause**: Unable to connect to Deepgram API.
**Solution**:
- Check internet connection.
- Confirm API Key is valid.
- Check firewall settings.

## Cost Estimation

Deepgram Pricing (as of 2026):
- **Pay-as-you-go**: $0.0043/minute
- **Growth Plan**: $0.0036/minute ($99/month)
- **Free Credits**: New users typically get $200 in free credits.

**Example**:
- 30 minutes daily usage = $0.13/day
- 15 hours monthly usage = $3.87/month

## Future Optimizations

1. **Add Wake Word**: Implement "Hey Assistant" functionality.
2. **Integrate TTS**: Add voice response capability.
3. **Local Caching**: Cache results for common commands.
4. **Multilingual Support**: Better support for English and other languages.
5. **Custom Vocabulary**: Add recognition for technical terms.
6. **Noise Reduction**: Frontend audio pre-processing.

## Resources

- [Deepgram Official Documentation](https://developers.deepgram.com/)
- [Deepgram Node.js SDK](https://github.com/deepgram/deepgram-node-sdk)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [TEN Framework Reference](https://github.com/TEN-framework/ten-framework)

## Technical Support

If you encounter issues, please check:
1. Console logs (Dev mode: `npm run dev`)
2. Deepgram API Status
3. Network connection status
4. API Key quota usage
