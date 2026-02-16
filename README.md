# OpenClaw Desktop Assistant MVP

A Minimum Viable Product (MVP) of an intelligent desktop assistant combining Live2D and OpenClaw.

## Features

- ✅ Electron Desktop Application
- ✅ Clean UI Interface
- ✅ Voice Input Support (Push-to-Talk)
- ✅ Simulated OpenClaw Data
- ✅ Email Query
- ✅ Schedule Query
- ✅ Quick Action Buttons

## Project Structure

```
openclaw-assistant-mvp/
├── electron/           # Electron main process
│   ├── main.js        # Entry point
│   └── preload.js     # Preload script
├── public/            # Frontend resources
│   ├── index.html     # Main page
│   ├── styles.css     # Styling
│   └── app.js         # Application logic
└── package.json       # Project configuration
```

## Installation and Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Application

```bash
npm start
```

Or run in development mode (opens Developer Tools):

```bash
npm run dev
```

## Usage Instructions

1. **Voice Input**: Hold the microphone button to speak, release to automatically recognize.
2. **Quick Buttons**: Click "Email" or "Schedule" buttons for quick queries.
3. **Window Control**: Minimize or close the window from the top right corner.
4. **Drag Window**: Drag anywhere on the window (except button areas).

## Supported Commands

- "What emails do I have today?" / "Email"
- "Today's schedule" / "Schedule" / "Report"

## Roadmap

- [ ] Integrate real OpenClaw API
- [ ] Add Live2D character
- [ ] Enhance voice recognition accuracy
- [ ] Add support for more commands
- [ ] Proactive notification feature
- [ ] Customizable character appearance

## Tech Stack

- Electron 28
- Web Speech API (Voice Recognition)
- Native HTML/CSS/JavaScript

## Important Notes

- Voice recognition requires microphone permission.
- Currently uses mock data, not connected to real OpenClaw.
- Tested only on macOS and Windows.
