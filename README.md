<div align="center">
  <h1>🦅🦅 YChang Sound 🦅🦅</h1>

  [![Visual Studio Code](https://img.shields.io/badge/VS%20Code-0078d7.svg?logo=visual-studio-code&logoColor=white)](https://code.visualstudio.com/)
  [![Extension Version](https://img.shields.io/badge/Version-1.0.9-success.svg)](#)
</div>

---

## 📖 Overview

**Y Chang**

## ✨ Key Features

YChang.

## 🚀 Getting Started

### Prerequisites

- Visual Studio Code **v1.93.0** or newer.
- **Shell Integration** must be active. *(Note: VS Code enables this by default!)*
- A system audio player:
  - **macOS:** Supported natively (`afplay` is built-in).
  - **Windows:** Supported natively (uses PowerShell fall-back).
  - **Linux:** Requires `mpg123`, `mplayer`, or `aplay` to be installed on your system.

### Quick Setup

1. Install the **YChang Sound** extension.
2. *(Optional)* Want a custom sound? Add your `.mp3`, `.wav`, or `.ogg` file to the extension's `sounds/` folder.
3. Update the `ychang-sound.soundFile` setting if you changed the filename from default.
4. Open the integrated terminal and run a command that intentionally fails.
5. Enjoy your satisfying feedback sound! 🔊

## ⚙️ Configuration

Tweak YChang Sound to fit your exact workflow. Access these settings via `Preferences: Open Settings (UI)` and search for `YChang Sound`.

| Configuration Key | Type | Default | What it does |
|-------------------|------|---------|-------------|
| `ychang-sound.enabled` | `boolean` | `true` | Master switch to enable or disable the failure sound. |
| `ychang-sound.soundFile` | `string` | `"error.mp3"` | The active audio file name residing in the `sounds/` folder. |
| `ychang-sound.volume` | `number` | `1.0` | Controls playback volume (Range: `0.0` - `1.0`). |

## 👨‍💻 Development

Want to compile the extension yourself or contribute?

```bash
# 1. Install dependencies
npm install

# 2. Compile the TypeScript code
npm run compile

# 3. Watch for changes during development
npm run watch
```

> **Pro Tip:** Press `F5` in VS Code to quickly launch an Extension Development Host right in your workspace!

---

