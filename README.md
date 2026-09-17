# PulseForge

PulseForge is a fully local, cross-platform audio visualizer editor. Turn a background, logo, and song into a branded music visual, customize every layer, and export a frame-perfect MP4 from your browser through Pinokio.

## What it does

- **Guided Brand Visualizer** - Add a background, logo, and audio track in a focused three-step workflow.
- **Live audio-reactive rendering** - Visual layers respond to music through the Web Audio API.
- **Motion presets** - Start with cinematic shader and visualizer combinations, shown with animated previews.
- **Advanced layer editor** - Stack backgrounds, logos, spectra, particles, shaders, text, lyrics, and spectrogram layers.
- **Animated brand media** - Use still images, GIFs, or short looping videos for backgrounds and logos; animated media is refreshed in the live preview and synchronized during export.
- **Background control** - Darken imported artwork independently so logos, lyrics, and reactive layers remain readable.
- **Creative layer effects** - Finish any layer with HDR bloom, Color Grade, Beat Pixelate, glow, pulse, shake, chromatic aberration, vignette, and more.
- **Directed audio reactions** - Target supported effects to the full mix, bass, mids, highs, or detected beats, with Beat Punch for sharp music-video impact.
- **Liquid motion engine** - Add adjustable organic flow to radial spectra, radial waveforms, bottom spectra, circular HD spectra, and oscilloscopes.
- **Flexible lyrics** - Import timed `.lrc` files, auto-time structured `.txt` lyrics, align supplied lines to real vocal timing with Whisper, or transcribe with local Whisper or the OpenAI Whisper API.
- **Deterministic MP4 export** - Offline audio analysis produces repeatable, frame-perfect output at 720p, 1080p, 1440p, or 4K. The finished video downloads straight from the editor, and a copy is also written to the `output/` folder.
- **Local project files** - Save, load, autosave, undo, and recover projects without uploading media.

## Quick Start

1. Launch PulseForge and choose **Brand Visualizer**.
2. Add 16:9 background artwork, a GIF, or a short video. PulseForge stretches it to the canvas and adds a subtle audio-reactive shake automatically.
3. Add a transparent logo, GIF, or short video. PulseForge centers it in a circular bordered frame and applies a polished color grade, shake, and pulse automatically.
4. Choose an MP3, WAV, OGG, or FLAC track.
5. Open the visualizer, press Play, and optionally fine-tune it in the Advanced Editor.
6. Select **Export Video**, pick a resolution (720p, 1080p, 1440p, or 4K), FPS, and quality, then start the export. When it finishes, an **Export Complete** panel appears with a **Download Video** button. By default the video also downloads automatically to your browser downloads folder, and a copy is written to `output/`.

You can reopen Quick Create from the top toolbar. Choose **Advanced Editor** on the welcome screen when you want to start with an empty layer stack.

## Project format

Projects are JSON documents containing resolution, duration, asset references, an ordered layer stack, effect settings, and audio configuration. Media paths are referenced rather than embedded.

```json
{
  "version": 1,
  "name": "My Visualizer",
  "fps": 30,
  "resolution": { "width": 1920, "height": 1080 },
  "assets": [],
  "layers": [],
  "audio": { "assetId": "" },
  "settings": { "previewScale": 1, "backgroundColor": "#1a1a2e" }
}
```

## Programmatic access

PulseForge is a local browser editor and does not currently expose an HTTP generation endpoint. Its stable integration surface is the saved project JSON format.

### JavaScript

```javascript
import { readFile } from "node:fs/promises";

const project = JSON.parse(await readFile("project.json", "utf8"));
console.log(project.name, project.layers.length);
```

### Python

```python
import json

with open("project.json", encoding="utf-8") as file:
    project = json.load(file)

print(project["name"], len(project["layers"]))
```

### cURL

There is no REST endpoint to call with cURL. When the development server is running, cURL can only verify that the local UI is available:

```bash
curl http://localhost:1420/
```

The actual port is captured automatically by the Pinokio launcher and may differ if port 1420 is occupied.

## Tech stack

| Component | Technology |
| --- | --- |
| Frontend | React and TypeScript |
| Build | Vite |
| State | Zustand |
| Renderer | PixiJS 8 and WebGL |
| Audio analysis | Web Audio API and custom FFT |
| Transcription | Hugging Face Transformers / Whisper |
| Desktop integration | Tauri 2 |
| Launcher | Pinokio |

## Platform support

PulseForge runs in modern Chromium-based browsers on Windows, macOS, and Linux. WebGPU availability for local transcription depends on the browser, GPU, and driver.

## License

MIT

Made by [@TheAwakenOne619](https://x.com/TheAwakenOne619).
