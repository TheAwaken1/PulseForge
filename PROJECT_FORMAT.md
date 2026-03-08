# Project Format — PulseForge

## Overview

PulseForge projects are stored as JSON files with the `.json` extension. The project file contains all metadata, layer configurations, effect settings, and asset references needed to reproduce the visualization.

## Schema Version

Current schema version: `1`

## Top-Level Structure

```json
{
  "version": 1,
  "name": "My Project",
  "fps": 30,
  "resolution": { "width": 1920, "height": 1080 },
  "durationSec": 180,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T12:00:00.000Z",
  "assets": [],
  "layers": [],
  "presetsApplied": [],
  "audio": {
    "assetId": "uuid-of-audio-asset",
    "startOffsetSec": 0
  },
  "settings": {
    "previewScale": 1,
    "backgroundColor": "#1a1a2e"
  }
}
```

## Asset Model

```json
{
  "id": "uuid",
  "type": "audio | image",
  "name": "filename.mp3",
  "relPath": "assets/filename.mp3",
  "sha256": "hex-hash",
  "sizeBytes": 1234567,
  "metadata": {
    "duration": 180.5
  }
}
```

## Parameter Model

All animatable values use a unified Param type:

```json
// Static value (V1)
{ "kind": "static", "value": 150 }

// Curve with keyframes (V2-ready)
{
  "kind": "curve",
  "keyframes": [
    { "t": 0, "value": 100, "ease": "linear" },
    { "t": 5, "value": 200, "ease": "inOut" }
  ]
}
```

## Layer Types

### Background Layer
```json
{
  "id": "uuid",
  "name": "Background",
  "kind": "background",
  "enabled": true,
  "opacity": { "kind": "static", "value": 1 },
  "blendMode": "normal",
  "transform": { "x": ..., "y": ..., "scale": ..., "rotation": ... },
  "effects": [],
  "assetId": "uuid-of-image",
  "fit": "cover | contain | stretch"
}
```

### Logo Layer
```json
{
  "kind": "logo",
  "assetId": "uuid-of-image",
  "anchor": "center"
}
```

### Radial Spectrum Layer
```json
{
  "kind": "radialSpectrum",
  "centerX": { "kind": "static", "value": 960 },
  "centerY": { "kind": "static", "value": 540 },
  "radius": { "kind": "static", "value": 150 },
  "thickness": { "kind": "static", "value": 4 },
  "barCount": { "kind": "static", "value": 72 },
  "barGap": { "kind": "static", "value": 1 },
  "gain": { "kind": "static", "value": 1.5 },
  "smoothing": {
    "attack": { "kind": "static", "value": 0.35 },
    "release": { "kind": "static", "value": 0.08 }
  },
  "compressionPow": { "kind": "static", "value": 0.6 },
  "peakHold": {
    "enabled": { "kind": "static", "value": true },
    "decay": { "kind": "static", "value": 0.95 }
  },
  "color": {
    "mode": "solid",
    "solid": { "kind": "static", "value": "#00ffff" }
  },
  "noiseJitter": { "kind": "static", "value": 0.03 }
}
```

### Radial Waveform Layer
```json
{
  "kind": "radialWaveform",
  "centerX": ...,
  "centerY": ...,
  "radius": ...,
  "amplitude": ...,
  "lineWidth": ...,
  "smoothing": { "attack": ..., "release": ... },
  "color": ...
}
```

### Bottom Spectrum Layer
```json
{
  "kind": "bottomSpectrum",
  "barX": ...,
  "barY": ...,
  "barWidth": ...,
  "barHeight": ...,
  "barCount": ...,
  "gain": ...,
  "smoothing": { "attack": ..., "release": ... },
  "color": ...
}
```

## Effect Types

All effects have: `id`, `name`, `kind`, `enabled`

| Kind | Parameters |
|------|-----------|
| `shake` | amountPx, amountRot, speed, audioDriven, audioAmount |
| `pulse` | baseScaleAdd, audioAmount, smoothing |
| `strobe` | rateHz, dutyCycle, softEdge |
| `glow` | distance, outerStrength, color, quality |
| `blur` | blur, quality |
| `chromaticAberration` | amountPx, angle, audioDriven |
| `gradientMap` | stops (array of {pos, color}) |
| `vignette` | strength, radius |

## Blend Modes

Supported: `normal`, `add`, `screen`, `multiply`

## Defaults

| Parameter | Default |
|-----------|---------|
| fps | 30 |
| resolution | 1920x1080 |
| spectrum bins | 72 |
| smoothing attack | 0.35 |
| smoothing release | 0.08 |
| compressionPow | 0.6 |
| peak decay | 0.95 |
| noise jitter | 0.03 |
