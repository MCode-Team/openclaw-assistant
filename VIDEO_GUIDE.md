# Video Assets Guide

## Required Video Files

Please place the following video files in the `public/` directory:

### 1. Idle State Video
**Filename**: `lobster-idle.mp4`
**Purpose**: Default idle state displayed when there is no interaction.
**Suggested Content**:
- Lobster standing still or subtle breathing animation.
- Occasional blinking or minor movements.
- Looping, suggested duration: 3-5 seconds.

### 2. Listening State Video
**Filename**: `lobster-listening.mp4`
**Purpose**: Displayed when the AI is listening to the user.
**Suggested Content**:
- Lobster in a listening posture.
- Animations for ears or antennae.
- Focused and attentive appearance.
- Looping, suggested duration: 2-3 seconds.

### 3. Thinking State Video
**Filename**: `lobster-thinking.mp4`
**Purpose**: Displayed when the AI is generating a response.
**Suggested Content**:
- Lobster performing a thinking action.
- Head turning, antennae twitching, etc.
- Thoughtful appearance.
- Looping, suggested duration: 2-3 seconds.

### 4. Speaking State Video
**Filename**: `lobster-speaking.mp4`
**Purpose**: Displayed during voice response.
**Suggested Content**:
- Lobster performing a speaking action.
- Mouth or claw movement animation.
- Communicative appearance.
- Looping, suggested duration: 2-3 seconds.

## Video Format Requirements

### Recommended Formats
- **Format**: MP4 (H.264) or WebM (VP9 with Alpha).
- **Resolution**: 320x400 (matches window dimensions).
- **Frame Rate**: 30fps.
- **Background**: Transparent background (WebM VP9 format with alpha channel recommended).

### If Using Black Background
If the video has a black background, CSS is configured to use `mix-blend-mode: screen` to remove the black. However, for the best results, a video with a transparent background is recommended.

## Converting Video to Transparent Background

### Use FFmpeg to Convert to WebM (Transparent)
```bash
ffmpeg -i input.mp4 -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -an output.webm
```

### Resize Video
```bash
ffmpeg -i input.mp4 -vf scale=320:400 -c:v libx264 -crf 23 output.mp4
```

## Application State Mapping

| App State | Video File | Trigger |
|---------|---------|---------|
| idle | lobster-idle.mp4 | Default idle state |
| listening | lobster-listening.mp4 | User clicks to start speaking |
| thinking | lobster-thinking.mp4 | AI is processing response |
| speaking | lobster-speaking.mp4 | AI is delivering voice response |
| followup | lobster-listening.mp4 | Waiting for user to continue (reuses listening) |

## Testing Videos

After preparing the videos:
1. Place the video files in the `public/` directory.
2. Restart the application: `npm start`.
3. Click the lobster to test video switching across different states.

## Extension: Adding Emotional States

To add emotional states (happy, sad, etc.):

1. Add new states to the `VIDEO_SOURCES` object in `app.js`:
```javascript
const VIDEO_SOURCES = {
  // ... existing states
  happy: 'lobster-happy.mp4',
  sad: 'lobster-sad.mp4',
  excited: 'lobster-excited.mp4'
};
```

2. Call `setAppState('happy')` as needed to switch to the corresponding state.

## Important Notes

- All videos will loop automatically (`loop` attribute set in HTML).
- Videos play muted by default (`muted` attribute set).
- Video transitions are smooth and maintain playback state.
- If a video file is missing, the display may appear blank or show an error.
