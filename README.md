# PulseForge

A fully local, cross-platform audio visualizer editor. Create reactive music videos with layered graphics, AI-transcribed lyrics, and frame-perfect MP4 exports — all running in your browser via Pinokio.

## What it does

PulseForge is a motion graphics editor built for audio visualizer videos. Import your audio track, stack visualizer layers, drop in a logo, add lyrics, apply effects, pick from 18 built-in presets or build your own, and export an MP4 — entirely offline.

- **Audio-reactive rendering** - All layers respond to your music in real-time via WebAudio API
- **18 built-in presets** - Warp Tunnel, Plasma Ocean, Hyperspace, Fractal Dreams, Neon Vortex, Pulse Dimension, Psychedelic Mandala, Retro 1980s, Calm Pulse, HD Rainbow Bars, HD Sonic Spikes, Aurora Borealis, Deep Space, Sacred Geometry, Liquid Dreams, Fluid Nebula, Dot DNA, Neon 360 Spectrum
- **Layered composition** - Stack backgrounds, logos, visualizers, shaders, text, and lyrics layers
- **12 visualizer layer types** - Radial Spectrum, Radial Waveform, Bottom Spectrum, HD Rainbow Bars Reflection, HD Sonic Spikes, HD Circular Spectrum, Particle Field, Oscilloscope, Energy Ribbon, Dot Sphere Equalizer, Shader (8 GLSL shaders with Milkdrop-style feedback), Text
- **8 post-processing effects** - Glow, Shake, Pulse, Strobe, Blur, Chromatic Aberration, Gradient Map, Vignette
- **AI lyrics transcription** - Local Whisper (runs in-browser via WebAssembly/WebGPU) or OpenAI Whisper API; imports .lrc files; lyrics survive preset switches
- **Deterministic export** - Offline audio analysis (custom FFT pipeline matching Web Audio API) guarantees frame-perfect MP4 output saved to the `output/` folder
- **Project save/load** - JSON project format, autosave with crash recovery
- **GPU accelerated** - PixiJS v8 WebGL rendering

## Quick Start

1. **Import Audio** - Click "Import Audio" and select an MP3, WAV, or FLAC file
2. **Choose a Preset** - Click the Presets button in the toolbar and pick one, or start with an empty canvas
3. **Add Layers** - Use the Layers panel to add visualizers, backgrounds, logos, text, or lyrics
4. **Import Your Logo** - Add a Logo layer, then click the image slot in the Inspector to upload a PNG/SVG
5. **Add Lyrics** - In the Lyrics panel: upload an `.lrc` file, or click "Transcribe Audio" to generate them with AI
6. **Press Play** - Use the transport bar to preview in real-time
7. **Tune Parameters** - Select any layer and adjust settings in the Inspector panel on the right
8. **Export** - Click "Export MP4" — the video is saved to the `output/` folder automatically

## Project Format

Projects are saved as `.json` files. Each project contains:
- Audio asset reference (path stored, not embedded)
- Layer stack with all parameters
- Per-parameter animation envelopes (static or keyframed)
- Background color and resolution settings

Use **File > Save** (or Ctrl+S) to save, **File > Open** to load a `.json` project file.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| State | Zustand |
| Renderer | PixiJS v8 (WebGL) |
| Audio Analysis | Web Audio API + custom FFT |
| AI Transcription | @huggingface/transformers (Whisper) |
| Launcher | Pinokio (Node.js) |

## Platform Support

PulseForge runs in any modern Chromium-based browser. It works on:
- **Windows** - Full support including WebGPU Whisper acceleration
- **macOS** - Full support (WebGPU on Apple Silicon)
- **Linux** - Full support (WebGPU availability depends on GPU/driver)

The Pinokio launcher handles Node.js dependency installation cross-platform via `npm`.

## License

MIT

---

Made by [@TheAwakenOne619](https://x.com/TheAwakenOne619)
