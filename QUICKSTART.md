# Quick Start Guide

## 🚀 Run Now

Execute in the project directory:

```bash
npm start
```

Or run in development mode (opens Developer Tools for easier debugging):

```bash
npm run dev
```

## 📱 Usage Demo

### 1. Launch Application
After running the command, a beautiful desktop window will appear, displaying an AI assistant character.

### 2. Test Voice Input
- **Hold** the microphone button (the large circular button in the middle).
- Speak: "What emails do I have today?"
- **Release** the button.
- Wait for recognition and response.

### 3. Use Quick Buttons
Click the quick buttons at the bottom:
- 📧 **Email** - Check today's emails.
- 📅 **Schedule** - Check today's schedule.

### 4. View Detailed Data
After the assistant replies, a detailed data panel will automatically pop up, showing:
- Email list (includes sender, subject, preview).
- Schedule (meeting time, location).
- To-do tasks (priority, deadline).

## 🎯 Test Commands

Try these voice commands:
- "What emails do I have today?"
- "Email"
- "What's my schedule today?"
- "Today"
- "Report"

## 🐛 Troubleshooting

### Voice Recognition Not Working
1. Ensure the browser has microphone permission.
2. Check if the system microphone is functioning normally.
3. Try using quick buttons instead of voice input.

### Window Cannot Be Dragged
- Drag in the character area or chat bubble area.
- Avoid dragging on buttons.

### Application Cannot Start
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm start
```

## 📸 Interface Description

The application includes the following interfaces:
1. **Main Interface** - Displays the AI character and chat bubbles.
2. **Email Panel** - Displays the email list, with important emails highlighted.
3. **Schedule Panel** - Displays today's overview, meetings, and tasks.

## 🔧 Developer Options

### Open Developer Tools
```bash
npm run dev
```

### View Console Logs
- Voice recognition results.
- Command execution process.
- Error messages.

## 📝 Current Limitations

- ⚠️ Uses mock data, not connected to real OpenClaw.
- ⚠️ Voice recognition aims for English support (previously Chinese only).
- ⚠️ Command recognition is simple, supporting only a few keywords.

## 🎉 Next Steps

After the MVP runs successfully, you can:
1. Integrate the real OpenClaw API.
2. Replace with a Live2D character.
3. Enhance command recognition capabilities.
4. Add more features.
