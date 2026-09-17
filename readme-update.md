# PulseForge Update Summary

This document records the major PulseForge upgrades completed during the current development pass. The focus has been to replace the generic editor experience with a guided, polished workflow while keeping the advanced controls available for users who want to build their own visualizers.

## Experience and interface

- Rebuilt the opening screen with a stronger PulseForge title, subtitle, and clearer visual hierarchy.
- Added a guided **Brand Visualizer** workflow that walks users through background, logo, and audio import in that order.
- Removed the unnecessary visual-style step from Brand Visualizer so a preset cannot cover the imported background.
- Added animated preset artwork so users can understand a visual style before applying it.
- Reorganized the Layers panel around creating visualizers instead of duplicating the preset gallery.
- Added collapsible editor panels and improved the overall spacing, typography, colors, and control styling.
- Added drag-and-drop layer ordering. The top of the list is the front of the composition, and layers can be dropped above or below any other layer.

## Brand Visualizer defaults

Brand Visualizer now creates a polished composition without requiring the user to understand every control first.

### Background

- Fit mode: `stretch`
- Audio-reactive shake enabled
- Background darkness slider available in the inspector

### Logo

- Centered circular frame
- Fit mode: `cover`
- Frame size: `375`
- Border enabled at the maximum width: `20`
- Border color: `#8b7cff`
- Neon border glow enabled
- Color Grade, Shake, and Pulse effects enabled
- Automatic fitting on import

The logo's Shake and Pulse settings are shared with the Logo Spectrum Halo defaults so the frame and spectrum move together.

## Logo Spectrum Halo

Added a dedicated spectrum visualizer designed to sit seamlessly behind the default circular logo. It is inserted directly behind the logo in the layer stack and remains independently editable.

Default settings:

| Setting | Value |
| --- | ---: |
| Radius | 196 |
| Bar count | 128 |
| Thickness | 18 |
| Gain | 2.35 |
| Liquid amount | 1.35 |
| Liquid speed | 2.70 |
| Noise jitter | 0 |
| Blend mode | Screen |
| Color | `#8b7cff` |

The halo includes rounded bars, liquid motion, matched Shake, and matched Pulse.

## Presets

The preset collection was expanded and upgraded with more layered, music-reactive compositions:

- Neon Mesh Odyssey
- Kaleido Reactor
- Hyperspace
- Fractal Dreams
- Psychedelic Mandala
- Retro 1980s
- HD Rainbow Bars
- HD Sonic Spikes
- Aurora Borealis
- Liquid Dreams
- Fluid Nebula
- Dot Sphere Equalizer
- Kinetic Poster

Dot Sphere Equalizer is now available as a preset without automatically adding the unrelated Deep Space composition.

## Layers and visual building tools

The **Add Layer** menu now focuses on useful building blocks:

- Background and Logo assets
- Radial Spectrum
- Radial Waveform
- Bottom Spectrum
- Particle Field
- Oscilloscope
- Logo Spectrum Halo
- Text and Lyrics
- Spectrogram waterfall
- Starfield, Vortex, Fractal Noise, Psychedelic, Retro Grid, Aurora, Nebula, Liquid, Neon Mesh Wave, and Kaleido Reactor motion backgrounds

The duplicated HD visualizer entries were removed from normal layer creation because they already exist as presets. Fullscreen displacement was also removed from the normal layer menu and is no longer presented as a user-facing visualizer.

## Liquid motion

Added reusable Liquid Motion controls to make existing visualizers feel more organic and less mechanically uniform. Liquid amount and speed can be adjusted on:

- Radial Spectrum
- Radial Waveform
- Bottom Spectrum
- HD Circular Spectrum
- Oscilloscope

Liquid-based shaders and presets were also added for full-screen motion backgrounds.

## Effects and audio response

Added or upgraded the following effects:

- Bloom
- Color Grade
- Beat Pixelate
- Beat Punch
- Glow
- Shake
- Pulse
- Chromatic Aberration
- Blur
- Strobe
- Vignette
- Gradient Map

Effects can target the full mix, bass, mids, highs, or detected beats where supported. Audio analysis and beat detection were upgraded for both realtime preview and deterministic offline export.

### Beat Pixelate fix

Beat Pixelate now behaves as an effect on the selected layer. Applying it no longer replaces, hides, or removes the existing layer or preset stack.

## Lyrics and transcription

PulseForge now supports three lyric workflows:

1. Import an already timed `.lrc` file.
2. Import a structured `.txt` file containing headings such as `[Verse]`, `[Chorus]`, and `[Bridge]`.
3. Generate lyrics with local Whisper or the OpenAI Whisper API.

For plain TXT files, section headings are ignored as display lines while the original lyric line breaks are preserved. PulseForge creates an initial estimated timeline and can then align those lines to the vocals with **Sync Lyrics to Audio**.

Synchronization includes:

- Sequential matching so repeated choruses align to their correct occurrence
- Word-timestamp synchronization when the selected Whisper model supports it
- Automatic segment-timing fallback for models exported without cross-attention timestamps
- Earlier, Later, Faster, and Slower adjustment buttons
- Fine timing offset and timing stretch controls in the Lyrics inspector

### Transcription paragraph fix

Local transcription now requests word timing first. Whisper models can return either one word per chunk or an entire passage as one chunk, so PulseForge now normalizes both forms into short, separately timed lyric lines. A paragraph-sized Whisper result is no longer displayed as one giant block of text.

When testing an existing project that already contains broken paragraph lyrics or bad generated timestamps, clear that lyric layer and re-import the original TXT or transcribe again so the stored LRC content is replaced.

## Removed or simplified

- Removed Energy Ribbon and its controls.
- Removed the redundant Brand Visualizer preset-selection step.
- Removed duplicated HD visualizers from the layer creation menu.
- Removed fullscreen displacement from normal layer creation.
- Kept advanced editing available without forcing new users to start in the full editor.

## Validation completed

- Production TypeScript and Vite build passes.
- Browser export pauses its recorder, audio clock, and render clock together when the PulseForge tab is hidden, preventing background-tab time from becoming a frozen section in the finished video.
- Beat Pixelate preserves the existing layer stack.
- Drag-and-drop ordering maps correctly between the visible front-to-back list and the renderer's internal back-to-front stack.
- Logo Spectrum Halo defaults match the branded logo frame and motion.
- Paragraph-sized transcription output is split into short timed lines.
- Word-level transcription output is grouped into readable lyric lines.
- Repeated chorus synchronization preserves sequential occurrence order.
- Pinokio launcher files remain unchanged by these app updates.
