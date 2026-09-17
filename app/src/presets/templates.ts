import {
  LayerAny, EffectAny, RadialSpectrumLayerConfig,
  RadialWaveformLayerConfig, BottomSpectrumLayerConfig,
  ShaderLayerConfig, ShaderType,
  HDBarsReflectionLayerConfig, HDSonicSpikesLayerConfig,
  HDCircularSpectrumLayerConfig, ParticleFieldLayerConfig,
  OscilloscopeLayerConfig, TextLayerConfig,
  DotSphereEqualizerLayerConfig,
  AudioTarget,
  staticParam, defaultTransform, createLayerId, createEffectId,
} from '../types/project';

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  layers: LayerAny[];
  settings?: {
    backgroundColor?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Layer factories                                                    */
/* ------------------------------------------------------------------ */

function makeRadialSpectrum(overrides: Partial<RadialSpectrumLayerConfig> = {}): RadialSpectrumLayerConfig {
  return {
    id: createLayerId(),
    name: 'Radial Spectrum',
    kind: 'radialSpectrum',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    centerX: staticParam(0),
    centerY: staticParam(0),
    radius: staticParam(150),
    thickness: staticParam(4),
    barCount: staticParam(72),
    barGap: staticParam(1),
    gain: staticParam(1.5),
    smoothing: {
      attack: staticParam(0.35),
      release: staticParam(0.08),
    },
    compressionPow: staticParam(0.6),
    peakHold: {
      enabled: staticParam(true),
      decay: staticParam(0.95),
    },
    color: {
      mode: 'solid',
      solid: staticParam('#00ffff'),
    },
    noiseJitter: staticParam(0.03),
    ...overrides,
  };
}

function makeRadialWaveform(overrides: Partial<RadialWaveformLayerConfig> = {}): RadialWaveformLayerConfig {
  return {
    id: createLayerId(),
    name: 'Radial Waveform',
    kind: 'radialWaveform',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    centerX: staticParam(0),
    centerY: staticParam(0),
    radius: staticParam(130),
    amplitude: staticParam(100),
    lineWidth: staticParam(2),
    smoothing: { attack: staticParam(0.3), release: staticParam(0.06) },
    color: staticParam('#a29bfe'),
    liquidMotion: true,
    liquidAmount: staticParam(0.75),
    liquidSpeed: staticParam(1.25),
    ...overrides,
  };
}

function makeBottomSpectrum(overrides: Partial<BottomSpectrumLayerConfig> = {}): BottomSpectrumLayerConfig {
  return {
    id: createLayerId(),
    name: 'Bottom Spectrum',
    kind: 'bottomSpectrum',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    barX: staticParam(0),
    barY: staticParam(0),
    barWidth: staticParam(0),
    barHeight: staticParam(0),
    barCount: staticParam(64),
    gain: staticParam(1.5),
    smoothing: { attack: staticParam(0.35), release: staticParam(0.08) },
    color: staticParam('#00cec9'),
    liquidMotion: true,
    liquidAmount: staticParam(0.45),
    liquidSpeed: staticParam(0.85),
    ...overrides,
  };
}

function makeHDBarsReflection(overrides: Partial<HDBarsReflectionLayerConfig> = {}): HDBarsReflectionLayerConfig {
  return {
    id: createLayerId(),
    name: 'HD Rainbow Bars',
    kind: 'hdRainbowBarsReflection',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    barCount: staticParam(180),
    gain: staticParam(0.60),
    attack: staticParam(0.35),
    release: staticParam(0.06),
    compressionPow: staticParam(0.92),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.93), showCaps: staticParam(true) },
    glowStrength: staticParam(1.2),
    reflectionEnabled: staticParam(true),
    reflectionOpacity: staticParam(0.25),
    reflectionBlur: staticParam(14),
    reflectionFade: staticParam(0.80),
    gamma: staticParam(1.36),
    contrast: staticParam(1.03),
    baselineY: staticParam(0.55),
    heightScale: staticParam(0.4),
    ...overrides,
  };
}

function makeHDSonicSpikes(overrides: Partial<HDSonicSpikesLayerConfig> = {}): HDSonicSpikesLayerConfig {
  return {
    id: createLayerId(),
    name: 'HD Sonic Spikes',
    kind: 'hdSonicWaveSpikes',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    barCount: staticParam(184),
    gain: staticParam(0.60),
    attack: staticParam(0.35),
    release: staticParam(0.30),
    compressionPow: staticParam(1.20),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.97) },
    glowStrength: staticParam(3.0),
    mirror: staticParam(true),
    lineThickness: staticParam(5),
    gamma: staticParam(1.32),
    contrast: staticParam(1.24),
    spikeScale: staticParam(0.78),
    transientBoost: staticParam(0.55),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Effect factories                                                   */
/* ------------------------------------------------------------------ */

function makeGlowEffect(color: string = '#00ffff', distance: number = 15): EffectAny {
  return {
    id: createEffectId(),
    name: 'Glow',
    kind: 'glow',
    enabled: true,
    distance: staticParam(distance),
    outerStrength: staticParam(2),
    color: staticParam(color),
    quality: staticParam(4),
  };
}

function makeShakeEffect(amount: number = 3, audioDriven: boolean = true, speed: number = 8, audioAmount: number = 2): EffectAny {
  return {
    id: createEffectId(),
    name: 'Shake',
    kind: 'shake',
    enabled: true,
    amountPx: staticParam(amount),
    amountRot: staticParam(0.01),
    speed: staticParam(speed),
    audioDriven,
    audioAmount: staticParam(audioAmount),
  };
}

function makePulseEffect(audioAmount: number = 0.15, smoothing: number = 0.3, audioTarget: AudioTarget = 'full'): EffectAny {
  return {
    id: createEffectId(),
    name: 'Pulse',
    kind: 'pulse',
    enabled: true,
    baseScaleAdd: staticParam(0),
    audioAmount: staticParam(audioAmount),
    smoothing: staticParam(smoothing),
    audioTarget,
  };
}

function makeBeatPunchEffect(
  zoomAmount: number = 0.1,
  rotationDeg: number = 1.5,
  positionPx: number = 6,
  decayMs: number = 180,
): EffectAny {
  return {
    id: createEffectId(),
    name: 'Beat Punch',
    kind: 'beatPunch',
    enabled: true,
    zoomAmount: staticParam(zoomAmount),
    rotationDeg: staticParam(rotationDeg),
    positionPx: staticParam(positionPx),
    decayMs: staticParam(decayMs),
  };
}

function makeStrobeEffect(rate: number = 4, duty: number = 0.5, softEdge: number = 0.1): EffectAny {
  return {
    id: createEffectId(),
    name: 'Strobe',
    kind: 'strobe',
    enabled: true,
    rateHz: staticParam(rate),
    dutyCycle: staticParam(duty),
    softEdge: staticParam(softEdge),
  };
}

function makeVignetteEffect(strength: number = 0.6, radius: number = 0.4): EffectAny {
  return {
    id: createEffectId(),
    name: 'Vignette',
    kind: 'vignette',
    enabled: true,
    strength: staticParam(strength),
    radius: staticParam(radius),
  };
}

function makeChromaticEffect(amountPx: number = 6, angle: number = 0, audioDriven: boolean = true): EffectAny {
  return {
    id: createEffectId(),
    name: 'Chromatic Aberration',
    kind: 'chromaticAberration',
    enabled: true,
    amountPx: staticParam(amountPx),
    angle: staticParam(angle),
    audioDriven,
  };
}

function makeBlurEffect(blur: number = 4, quality: number = 4): EffectAny {
  return {
    id: createEffectId(),
    name: 'Blur',
    kind: 'blur',
    enabled: true,
    blur: staticParam(blur),
    quality: staticParam(quality),
  };
}

function makeBloomEffect(
  strength: number = 1.6,
  radius: number = 4,
  threshold: number = 0.32,
  audioTarget: AudioTarget = 'full',
): EffectAny {
  return {
    id: createEffectId(),
    name: 'Bloom',
    kind: 'bloom',
    enabled: true,
    threshold: staticParam(threshold),
    strength: staticParam(strength),
    radius: staticParam(radius),
    softKnee: staticParam(0.55),
    toneMap: true,
    audioDriven: true,
    audioAmount: staticParam(0.45),
    audioTarget,
  };
}

/* ------------------------------------------------------------------ */
/*  Shader layer factory                                               */
/* ------------------------------------------------------------------ */

function makeShaderLayer(
  shaderType: ShaderType,
  name: string,
  overrides: Partial<ShaderLayerConfig> = {},
): ShaderLayerConfig {
  return {
    id: createLayerId(),
    name,
    kind: 'shader',
    enabled: true,
    opacity: staticParam(1),
    blendMode: 'normal',
    transform: defaultTransform(),
    effects: [],
    shaderType,
    speed: staticParam(1),
    intensity: staticParam(1),
    scale: staticParam(1),
    color1: staticParam('#ff00ff'),
    color2: staticParam('#00ffff'),
    color3: staticParam('#ffffff'),
    audioReactivity: staticParam(1),
    feedbackEnabled: false,
    feedbackAmount: staticParam(0.5),
    feedbackZoom: staticParam(1.0),
    feedbackRotate: staticParam(0),
    distortionStrength: staticParam(1.0),
    flowSpeed: staticParam(0.5),
    viscosity: staticParam(0.72),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  New layer factories                                                */
/* ------------------------------------------------------------------ */

function makeHDCircularSpectrum(overrides: Partial<HDCircularSpectrumLayerConfig> = {}): HDCircularSpectrumLayerConfig {
  return {
    id: createLayerId(), name: 'HD Circular Spectrum', kind: 'hdCircularSpectrum', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    barCount: staticParam(72), gain: staticParam(1.35), attack: staticParam(0.35), release: staticParam(0.06),
    compressionPow: staticParam(0.6), innerRadius: staticParam(120), barMaxHeight: staticParam(200),
    barWidthRatio: staticParam(0.7),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.93), showCaps: staticParam(true) },
    colorMode: 'rainbow', solidColor: staticParam('#6c5ce7'),
    gradientColor1: staticParam('#ff00ff'), gradientColor2: staticParam('#00ffff'),
    glowStrength: staticParam(1.2),
    reflectionEnabled: staticParam(true), reflectionOpacity: staticParam(0.2), reflectionFade: staticParam(2.0),
    innerRing: { enabled: staticParam(true), width: staticParam(2), color: staticParam('#ffffff'), glowEnabled: staticParam(true) },
    outerRing: { enabled: staticParam(false), width: staticParam(2), color: staticParam('#ffffff'), glowEnabled: staticParam(false) },
    gamma: staticParam(0.86), contrast: staticParam(1.16), rotationSpeed: staticParam(0.1),
    liquidMotion: true, liquidAmount: staticParam(0.65), liquidSpeed: staticParam(1.15),
    ...overrides,
  };
}

function makeParticleField(overrides: Partial<ParticleFieldLayerConfig> = {}): ParticleFieldLayerConfig {
  return {
    id: createLayerId(), name: 'Particle Field', kind: 'particleField', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    maxParticles: staticParam(500), spawnRate: staticParam(30), baseSpeed: staticParam(60),
    baseSize: staticParam(3), sizeVariation: staticParam(0.5), lifetime: staticParam(4),
    pattern: 'radial', gravityY: staticParam(0),
    colorMode: 'rainbow', solidColor: staticParam('#6c5ce7'),
    gradientColor1: staticParam('#ff00ff'), gradientColor2: staticParam('#00ffff'),
    audioSpawnBoost: staticParam(1), audioSpeedBoost: staticParam(0.5), audioSizeBoost: staticParam(0.5),
    trailLength: staticParam(0), glowEnabled: staticParam(true), glowStrength: staticParam(1),
    burstOnBeat: staticParam(true), burstThreshold: staticParam(0.6), burstCount: staticParam(20),
    ...overrides,
  };
}

function makeOscilloscope(overrides: Partial<OscilloscopeLayerConfig> = {}): OscilloscopeLayerConfig {
  return {
    id: createLayerId(), name: 'Oscilloscope', kind: 'oscilloscope', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    mode: 'horizontal', lineWidth: staticParam(3), gain: staticParam(1.5), smoothing: staticParam(0.3),
    sampleCount: staticParam(256), color: staticParam('#00cec9'),
    glowEnabled: staticParam(true), glowStrength: staticParam(1.2), glowColor: staticParam('#00cec9'),
    fillEnabled: staticParam(false), fillOpacity: staticParam(0.15),
    mirrorY: staticParam(0.5), circularRadius: staticParam(150), circularAmplitude: staticParam(80),
    lineGradient: { enabled: staticParam(false), color1: staticParam('#ff00ff'), color2: staticParam('#00ffff') },
    gamma: staticParam(1), stereoSpread: staticParam(0), scanlineEffect: staticParam(false),
    liquidMotion: true, liquidAmount: staticParam(0.55), liquidSpeed: staticParam(1.4),
    ...overrides,
  };
}

function makeText(overrides: Partial<TextLayerConfig> = {}): TextLayerConfig {
  return {
    id: createLayerId(), name: 'Text', kind: 'text', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    text: 'PULSE', fontFamily: 'Arial', fontSize: staticParam(64), fontWeight: 'bold',
    color: staticParam('#ffffff'), textAlign: 'center',
    positionX: staticParam(0.5), positionY: staticParam(0.5),
    glowEnabled: staticParam(true), glowStrength: staticParam(1), glowColor: staticParam('#6c5ce7'),
    audioPulseAmount: staticParam(0.3), audioShakeAmount: staticParam(0),
    scrollEnabled: staticParam(false), scrollSpeed: staticParam(2),
    letterSpacing: staticParam(0), strokeEnabled: staticParam(false),
    strokeColor: staticParam('#000000'), strokeWidth: staticParam(2),
    ...overrides,
  };
}

function makeDotSphereEqualizer(overrides: Partial<DotSphereEqualizerLayerConfig> = {}): DotSphereEqualizerLayerConfig {
  return {
    id: createLayerId(), name: 'Dot Sphere Equalizer', kind: 'dotSphereEqualizer', enabled: true,
    opacity: staticParam(1), blendMode: 'add', transform: defaultTransform(), effects: [],
    columns: staticParam(65),
    dotsPerColumn: staticParam(23),
    baseRadius: staticParam(3),
    sphereSize: staticParam(0.43),
    mirrorEnabled: staticParam(true),
    gain: staticParam(1),
    attack: staticParam(0.60),
    release: staticParam(0.20),
    peakHoldEnabled: staticParam(false),
    peakHoldDecay: staticParam(0.93),
    gradientPreset: 'rainbow',
    glowEnabled: staticParam(true),
    glowStrength: staticParam(1.2),
    textEnabled: staticParam(true),
    textString: 'PINOKIO',
    ...overrides,
  };
}

/* ================================================================== */
/*  PRESET TEMPLATES                                                   */
/* ================================================================== */

/* ================================================================== */
/*  SHADER-BASED PRESETS                                               */
/* ================================================================== */

/**
 * WARP TUNNEL — Classic visualizer infinite zoom
 *
 * Full-screen tunnel shader as background with spectrum ring overlay.
 * The tunnel zooms and rotates with the beat, spectrum bars punch
 * through on top for that classic visualizer look.
 */
export const PRESET_WARP_TUNNEL: PresetTemplate = {
  id: 'warp-tunnel',
  name: 'Warp Tunnel',
  description: 'Classic visualizer infinite zoom tunnel with spectrum overlay',
  layers: [
    // Full-screen tunnel background
    {
      ...makeShaderLayer('tunnel', 'Tunnel BG', {
        speed: staticParam(0.8),
        intensity: staticParam(0.9),
        scale: staticParam(1.2),
        color1: staticParam('#6c5ce7'),
        color2: staticParam('#00cec9'),
        color3: staticParam('#ff00ff'),
        audioReactivity: staticParam(1.5),
        opacity: staticParam(0.7),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.4),
        feedbackZoom: staticParam(1.005),
        feedbackRotate: staticParam(0.003),
      }),
      effects: [],
    },
    // Spectrum ring overlay
    {
      ...makeRadialSpectrum({
        name: 'Tunnel Ring',
        radius: staticParam(140),
        thickness: staticParam(4),
        barCount: staticParam(80),
        gain: staticParam(2),
        opacity: staticParam(0.8),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ffffff') },
        smoothing: { attack: staticParam(0.4), release: staticParam(0.08) },
      }),
      effects: [
        makeGlowEffect('#00cec9', 18),
        makePulseEffect(0.2, 0.25),
      ],
    },
    // Inner waveform
    {
      ...makeRadialWaveform({
        name: 'Core Wave',
        radius: staticParam(90),
        amplitude: staticParam(40),
        lineWidth: staticParam(2),
        color: staticParam('#ff88ff'),
        opacity: staticParam(0.6),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ff88ff', 10),
      ],
    },
  ],
};

/**
 * PLASMA OCEAN — Flowing plasma with bioluminescent rings
 *
 * Full-screen plasma shader creates a living, breathing background.
 * Multiple spectrum rings float on top like jellyfish tentacles.
 */
export const PRESET_PLASMA_OCEAN: PresetTemplate = {
  id: 'plasma-ocean',
  name: 'Plasma Ocean',
  description: 'Flowing plasma background with floating spectrum rings',
  layers: [
    // Plasma background
    {
      ...makeShaderLayer('plasma', 'Plasma BG', {
        speed: staticParam(0.6),
        intensity: staticParam(0.7),
        scale: staticParam(0.8),
        color1: staticParam('#0984e3'),
        color2: staticParam('#00cec9'),
        color3: staticParam('#6c5ce7'),
        audioReactivity: staticParam(1.2),
        opacity: staticParam(0.6),
      }),
      effects: [],
    },
    // Outer spectrum halo
    {
      ...makeRadialSpectrum({
        name: 'Outer Halo',
        radius: staticParam(200),
        thickness: staticParam(2),
        barCount: staticParam(96),
        gain: staticParam(1.5),
        opacity: staticParam(0.35),
        blendMode: 'screen',
        color: { mode: 'solid', solid: staticParam('#00cec9') },
        smoothing: { attack: staticParam(0.2), release: staticParam(0.04) },
        peakHold: { enabled: staticParam(false), decay: staticParam(0.95) },
      }),
      effects: [
        makeGlowEffect('#00cec9', 22),
      ],
    },
    // Inner spectrum
    {
      ...makeRadialSpectrum({
        name: 'Inner Ring',
        radius: staticParam(130),
        thickness: staticParam(5),
        barCount: staticParam(72),
        gain: staticParam(2.2),
        opacity: staticParam(0.8),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#00ffff') },
      }),
      effects: [
        makeGlowEffect('#00ffff', 16),
        makePulseEffect(0.15, 0.2),
      ],
    },
    // Core waveform
    {
      ...makeRadialWaveform({
        name: 'Bio Pulse',
        radius: staticParam(80),
        amplitude: staticParam(35),
        lineWidth: staticParam(2),
        color: staticParam('#ffffff'),
        opacity: staticParam(0.7),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ffffff', 10),
        makePulseEffect(0.12, 0.2),
      ],
    },
  ],
};

/**
 * HYPERSPACE — Starfield warp drive
 *
 * Starfield shader as the main background, spectrum ring as the
 * ship's window frame, vortex shader overlay for warp streaks.
 */
export const PRESET_HYPERSPACE: PresetTemplate = {
  id: 'hyperspace',
  name: 'Hyperspace',
  description: 'Starfield warp drive with vortex streaks',
  layers: [
    // Starfield background
    {
      ...makeShaderLayer('starfield', 'Star Field', {
        speed: staticParam(0.15),
        intensity: staticParam(0.85),
        scale: staticParam(2.25),
        color1: staticParam('#f7f7f7'),
        color2: staticParam('#0de31b'),
        color3: staticParam('#d66b6b'),
        audioReactivity: staticParam(2.75),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.0),
        feedbackZoom: staticParam(0.99),
        feedbackRotate: staticParam(0.02),
        opacity: staticParam(0.8),
        blendMode: 'normal',
      }),
      effects: [
        makeShakeEffect(),
        makePulseEffect(),
      ],
    },
    // Vortex warp overlay
    {
      ...makeShaderLayer('vortex', 'Warp Streaks', {
        speed: staticParam(1.5),
        intensity: staticParam(0.4),
        scale: staticParam(0.8),
        color1: staticParam('#4488ff'),
        color2: staticParam('#00ccff'),
        color3: staticParam('#ffffff'),
        audioReactivity: staticParam(1.5),
        feedbackEnabled: true,
        opacity: staticParam(0.3),
        blendMode: 'add',
      }),
      effects: [],
    },
  ],
};

/**
 * FRACTAL DREAMS — Domain-warped noise with ethereal rings
 *
 * Fractal noise creates an ever-morphing organic background.
 * Thin ethereal spectrum rings float within the noise like
 * structures in a dream.
 */
export const PRESET_FRACTAL_DREAMS: PresetTemplate = {
  id: 'fractal-dreams',
  name: 'Fractal Dreams',
  description: 'Domain-warped fractal noise with ethereal floating rings',
  layers: [
    // Fractal noise background
    {
      ...makeShaderLayer('fractalNoise', 'Fractal BG', {
        speed: staticParam(2.0),
        intensity: staticParam(0.9),
        scale: staticParam(1.4),
        color1: staticParam('#0a0a0a'),
        color2: staticParam('#0a0a0a'),
        color3: staticParam('#f0c800'),
        audioReactivity: staticParam(1.3),
        opacity: staticParam(0.7),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.3),
        feedbackZoom: staticParam(1),
        feedbackRotate: staticParam(0),
      }),
      effects: [],
    },
    // Outer mist ring
    {
      ...makeRadialSpectrum({
        name: 'Dream Mist',
        radius: staticParam(200),
        thickness: staticParam(1),
        barCount: staticParam(128),
        barGap: staticParam(0),
        gain: staticParam(1.2),
        opacity: staticParam(0.2),
        blendMode: 'screen',
        color: { mode: 'solid', solid: staticParam('#a29bfe') },
        smoothing: { attack: staticParam(0.1), release: staticParam(0.02) },
        peakHold: { enabled: staticParam(false), decay: staticParam(0.95) },
      }),
      effects: [
        makeGlowEffect('#a29bfe', 25),
      ],
    },
    // Inner dream ring
    {
      ...makeRadialSpectrum({
        name: 'Dream Core',
        radius: staticParam(130),
        thickness: staticParam(3),
        barCount: staticParam(72),
        gain: staticParam(1.8),
        opacity: staticParam(0.5),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#55efc4') },
        smoothing: { attack: staticParam(0.15), release: staticParam(0.03) },
      }),
      effects: [
        makeGlowEffect('#55efc4', 16),
        makePulseEffect(0.1, 0.2),
      ],
    },
    // Heart waveform
    {
      ...makeRadialWaveform({
        name: 'Dream Heart',
        radius: staticParam(80),
        amplitude: staticParam(40),
        lineWidth: staticParam(1.5),
        color: staticParam('#fd79a8'),
        opacity: staticParam(0.6),
        blendMode: 'add',
        smoothing: { attack: staticParam(0.15), release: staticParam(0.03) },
      }),
      effects: [
        makeGlowEffect('#fd79a8', 12),
        makePulseEffect(0.08, 0.15),
      ],
    },
  ],
};

/**
 * NEON VORTEX — Spinning spiral with reactive rings
 *
 * Vortex shader as the main background, multiple spectrum
 * rings at different radii create a complex layered look.
 */
export const PRESET_NEON_VORTEX: PresetTemplate = {
  id: 'neon-vortex',
  name: 'Neon Vortex',
  description: 'Spinning spiral vortex with layered neon spectrum rings',
  layers: [
    // Vortex background
    {
      ...makeShaderLayer('vortex', 'Vortex BG', {
        speed: staticParam(0.7),
        intensity: staticParam(0.8),
        scale: staticParam(1.2),
        color1: staticParam('#ff00ff'),
        color2: staticParam('#6c5ce7'),
        color3: staticParam('#ffffff'),
        audioReactivity: staticParam(1.5),
        opacity: staticParam(0.6),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.35),
        feedbackZoom: staticParam(0.995),
        feedbackRotate: staticParam(0.005),
      }),
      effects: [],
    },
    // Wide outer ring
    {
      ...makeRadialSpectrum({
        name: 'Outer Vortex',
        radius: staticParam(190),
        thickness: staticParam(3),
        barCount: staticParam(96),
        gain: staticParam(1.8),
        opacity: staticParam(0.4),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ff44ff') },
        smoothing: { attack: staticParam(0.25), release: staticParam(0.05) },
      }),
      effects: [
        makeGlowEffect('#ff44ff', 22),
      ],
    },
    // Main ring
    {
      ...makeRadialSpectrum({
        name: 'Neon Core',
        radius: staticParam(140),
        thickness: staticParam(6),
        barCount: staticParam(72),
        gain: staticParam(2.5),
        opacity: staticParam(0.9),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#00ffff') },
      }),
      effects: [
        makeGlowEffect('#00ffff', 18),
        makePulseEffect(0.2, 0.25),
        makeShakeEffect(4, true, 10, 2),
      ],
    },
    // Tight inner waveform
    {
      ...makeRadialWaveform({
        name: 'Vortex Pulse',
        radius: staticParam(90),
        amplitude: staticParam(35),
        lineWidth: staticParam(2),
        color: staticParam('#ff88ff'),
        opacity: staticParam(0.7),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ff88ff', 10),
        makePulseEffect(0.15, 0.2),
      ],
    },
    // Floor bars
    {
      ...makeBottomSpectrum({
        name: 'Vortex Floor',
        barCount: staticParam(96),
        gain: staticParam(2),
        color: staticParam('#6c5ce7'),
        opacity: staticParam(0.35),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#6c5ce7', 8),
      ],
    },
  ],
};

/**
 * PULSE DIMENSION — Expanding ring waves
 *
 * Pulse rings shader as the main visual with a tight spectrum
 * ring at center. The ring waves expand outward from center
 * driven by different frequency bands.
 */
export const PRESET_PULSE_DIMENSION: PresetTemplate = {
  id: 'pulse-dimension',
  name: 'Pulse Dimension',
  description: 'Expanding ring waves with central spectrum focus',
  layers: [
    // Pulse rings background
    {
      ...makeShaderLayer('pulseRings', 'Ring Waves', {
        speed: staticParam(0.8),
        intensity: staticParam(1),
        scale: staticParam(1),
        color1: staticParam('#ff0066'),
        color2: staticParam('#00ccff'),
        color3: staticParam('#ffffff'),
        audioReactivity: staticParam(2),
        opacity: staticParam(0.7),
      }),
      effects: [],
    },
    // Spectrum overlay
    {
      ...makeRadialSpectrum({
        name: 'Pulse Ring',
        radius: staticParam(120),
        thickness: staticParam(5),
        barCount: staticParam(64),
        gain: staticParam(2.5),
        opacity: staticParam(0.8),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ffffff') },
      }),
      effects: [
        makeGlowEffect('#00ccff', 20),
        makePulseEffect(0.25, 0.3),
        makeShakeEffect(5, true, 12, 2.5),
      ],
    },
    // Inner waveform
    {
      ...makeRadialWaveform({
        name: 'Pulse Heart',
        radius: staticParam(70),
        amplitude: staticParam(30),
        lineWidth: staticParam(2.5),
        color: staticParam('#ff0066'),
        opacity: staticParam(0.7),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ff0066', 12),
        makePulseEffect(0.2, 0.25),
      ],
    },
  ],
};

/**
 * PSYCHEDELIC MANDALA — Kaleidoscopic rainbow with fractal warping
 *
 * The psychedelic shader creates an 8-fold kaleidoscope mirror with
 * rainbow color cycling driven by fBm domain warping. Mandala rings
 * and angular rays overlay the fractal pattern. Paired with a
 * chromatic waveform and glowing spectrum ring.
 */
export const PRESET_PSYCHEDELIC: PresetTemplate = {
  id: 'psychedelic',
  name: 'Psychedelic Mandala',
  description: 'Kaleidoscopic rainbow mandala with fractal domain warping',
  layers: [
    // Psychedelic shader background
    {
      ...makeShaderLayer('psychedelic', 'Mandala BG', {
        speed: staticParam(0.6),
        intensity: staticParam(0.9),
        scale: staticParam(1),
        color1: staticParam('#ff00ff'),
        color2: staticParam('#00ff88'),
        color3: staticParam('#ffff00'),
        audioReactivity: staticParam(1.8),
        opacity: staticParam(0.75),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.45),
        feedbackZoom: staticParam(1.008),
        feedbackRotate: staticParam(-0.004),
      }),
      effects: [],
    },
    // Outer rainbow ring
    {
      ...makeRadialSpectrum({
        name: 'Rainbow Ring',
        radius: staticParam(180),
        thickness: staticParam(3),
        barCount: staticParam(96),
        gain: staticParam(1.8),
        opacity: staticParam(0.4),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ff44ff') },
        smoothing: { attack: staticParam(0.2), release: staticParam(0.04) },
      }),
      effects: [
        makeGlowEffect('#ff44ff', 20),
      ],
    },
    // Core spectrum with chromatic split
    {
      ...makeRadialSpectrum({
        name: 'Prismatic Core',
        radius: staticParam(120),
        thickness: staticParam(5),
        barCount: staticParam(72),
        gain: staticParam(2.2),
        opacity: staticParam(0.8),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ffffff') },
      }),
      effects: [
        makeGlowEffect('#00ff88', 16),
        makeChromaticEffect(8, 0.7, true),
        makePulseEffect(0.2, 0.25),
      ],
    },
    // Waveform with rainbow glow
    {
      ...makeRadialWaveform({
        name: 'Trip Wave',
        radius: staticParam(75),
        amplitude: staticParam(45),
        lineWidth: staticParam(2),
        color: staticParam('#ff88ff'),
        opacity: staticParam(0.7),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ffff00', 12),
        makePulseEffect(0.15, 0.2),
      ],
    },
  ],
};

/**
 * RETRO 1980s — Synthwave grid with pixel sun
 *
 * The retroGrid shader renders a classic 80s perspective grid floor,
 * striped sun at the horizon, twinkling stars, CRT scanlines and
 * pixel effects. Overlaid with neon spectrum ring and waveform for
 * that full retro-future visualizer aesthetic.
 */
export const PRESET_RETRO_80S: PresetTemplate = {
  id: 'retro-80s',
  name: 'Retro 1980s',
  description: '80s synthwave grid with pixel sun, scanlines and neon overlays',
  layers: [
    // Retro grid shader background
    {
      ...makeShaderLayer('retroGrid', 'Retro Grid', {
        speed: staticParam(0.7),
        intensity: staticParam(1),
        scale: staticParam(1),
        color1: staticParam('#ff00ff'),
        color2: staticParam('#00ffff'),
        color3: staticParam('#ffaa00'),
        audioReactivity: staticParam(1.5),
        opacity: staticParam(0.8),
      }),
      effects: [],
    },
    // Neon magenta spectrum ring
    {
      ...makeRadialSpectrum({
        name: 'Neon Ring',
        radius: staticParam(150),
        thickness: staticParam(4),
        barCount: staticParam(72),
        gain: staticParam(2),
        opacity: staticParam(0.7),
        blendMode: 'add',
        color: { mode: 'solid', solid: staticParam('#ff00ff') },
        smoothing: { attack: staticParam(0.35), release: staticParam(0.07) },
      }),
      effects: [
        makeGlowEffect('#ff00ff', 20),
        makePulseEffect(0.15, 0.25),
      ],
    },
    // Cyan waveform
    {
      ...makeRadialWaveform({
        name: 'Retro Wave',
        radius: staticParam(100),
        amplitude: staticParam(35),
        lineWidth: staticParam(2.5),
        color: staticParam('#00ffff'),
        opacity: staticParam(0.6),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#00ffff', 12),
        makeChromaticEffect(4, 0, true),
        makePulseEffect(0.12, 0.2),
      ],
    },
    // Floor bars in magenta
    {
      ...makeBottomSpectrum({
        name: 'Retro Floor',
        barCount: staticParam(64),
        gain: staticParam(1.8),
        color: staticParam('#ff00ff'),
        opacity: staticParam(0.35),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#ff00ff', 8),
      ],
    },
  ],
};

/**
 * CALM PULSE — Clean minimal for podcasts/branding
 *
 * Gentle pulse rings at low intensity with a subtle gradient background.
 * Minimal motion, elegant waveform, and muted floor bars.
 * Designed for spoken-word content and brand videos where chaos is unwanted.
 */
export const PRESET_CALM_PULSE: PresetTemplate = {
  id: 'calm-pulse',
  name: 'Calm Pulse',
  description: 'Clean minimal with gentle pulse rings for podcasts and branding',
  layers: [
    // Low-intensity pulse rings background
    {
      ...makeShaderLayer('pulseRings', 'Gentle Rings', {
        speed: staticParam(0.3),
        intensity: staticParam(0.4),
        scale: staticParam(0.8),
        color1: staticParam('#6c5ce7'),
        color2: staticParam('#a29bfe'),
        color3: staticParam('#dfe6e9'),
        audioReactivity: staticParam(0.6),
        opacity: staticParam(0.35),
      }),
      effects: [],
    },
    // Subtle outer spectrum accent
    {
      ...makeRadialSpectrum({
        name: 'Accent Ring',
        radius: staticParam(150),
        thickness: staticParam(2),
        barCount: staticParam(72),
        barGap: staticParam(1),
        gain: staticParam(1),
        opacity: staticParam(0.2),
        blendMode: 'screen',
        color: { mode: 'solid', solid: staticParam('#b2bec3') },
        smoothing: { attack: staticParam(0.15), release: staticParam(0.03) },
        compressionPow: staticParam(0.5),
        peakHold: { enabled: staticParam(false), decay: staticParam(0.95) },
      }),
      effects: [
        makeGlowEffect('#b2bec3', 8),
      ],
    },
    // Clean waveform ring
    {
      ...makeRadialWaveform({
        name: 'Voice Ring',
        radius: staticParam(105),
        amplitude: staticParam(40),
        lineWidth: staticParam(2),
        color: staticParam('#ffffff'),
        smoothing: { attack: staticParam(0.2), release: staticParam(0.04) },
      }),
      effects: [
        makeGlowEffect('#ffffff', 8),
        makePulseEffect(0.05, 0.2),
      ],
    },
    // Muted floor bars
    {
      ...makeBottomSpectrum({
        name: 'Subtle Floor',
        barCount: staticParam(40),
        gain: staticParam(0.8),
        color: staticParam('#636e72'),
        opacity: staticParam(0.15),
        smoothing: { attack: staticParam(0.2), release: staticParam(0.04) },
      }),
      effects: [],
    },
  ],
};

export const PRESET_HD_RAINBOW_BARS: PresetTemplate = {
  id: 'hd-rainbow-bars',
  name: 'HD Rainbow Bars',
  description: 'Premium rainbow bars with confident peaks, glow and glossy floor reflection',
  layers: [
    makeHDBarsReflection(),
  ],
};

export const PRESET_HD_SONIC_SPIKES: PresetTemplate = {
  id: 'hd-sonic-spikes',
  name: 'HD Sonic Spikes',
  description: 'Centered sonic spikes with rainbow energy, soft bloom and transient snap',
  layers: [
    makeHDSonicSpikes(),
  ],
};

/* ================================================================== */
/*  PHASE 2 PRESETS                                                    */
/* ================================================================== */

/**
 * AURORA BOREALIS — Northern lights with circular spectrum
 */
export const PRESET_AURORA_BOREALIS: PresetTemplate = {
  id: 'aurora-borealis',
  name: 'Aurora Borealis',
  description: 'Northern lights over a frozen lake: the curtains are the spectrum, beats flash the rays, and it all reflects in the ice',
  settings: { backgroundColor: '#02040f' },
  layers: [
    {
      ...makeShaderLayer('aurora', 'Aurora Sky', {
        speed: staticParam(0.5),
        intensity: staticParam(1.15),
        scale: staticParam(1),
        color1: staticParam('#3dffa0'),
        color2: staticParam('#24b8ff'),
        color3: staticParam('#c46bff'),
        audioReactivity: staticParam(1.6),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.12),
        feedbackZoom: staticParam(1.0),
        feedbackRotate: staticParam(0),
      }),
      effects: [
        makeBloomEffect(0.8, 3.5, 0.5, 'full'),
        makeBeatPunchEffect(0.02, 0, 0.8, 200),
      ],
    },
    makeHDCircularSpectrum({
      name: 'Aurora Ring',
      innerRadius: staticParam(88),
      barMaxHeight: staticParam(120),
      barCount: staticParam(96),
      gain: staticParam(0.9),
      attack: staticParam(0.46),
      release: staticParam(0.18),
      barWidthRatio: staticParam(0.62),
      compressionPow: staticParam(1.0),
      colorMode: 'gradient',
      gradientColor1: staticParam('#7dffc9'),
      gradientColor2: staticParam('#c46bff'),
      glowStrength: staticParam(1.6),
      rotationSpeed: staticParam(0.05),
      reflectionEnabled: staticParam(false),
      innerRing: { enabled: staticParam(true), width: staticParam(2), color: staticParam('#e6fbff'), glowEnabled: staticParam(true) },
      gamma: staticParam(1.1),
      contrast: staticParam(1.05),
      opacity: staticParam(0.72),
      blendMode: 'add',
    }),
    {
      ...makeRadialWaveform({
        name: 'Aurora Wave',
        radius: staticParam(72),
        amplitude: staticParam(22),
        lineWidth: staticParam(3),
        color: staticParam('#e6fbff'),
        opacity: staticParam(0.6),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#8dffd9', 12),
      ],
    },
  ],
};

/**
 * DEEP SPACE — Nebula with particles and circular oscilloscope
 */
export const PRESET_DEEP_SPACE: PresetTemplate = {
  id: 'deep-space',
  name: 'Deep Space',
  description: 'Nebula clouds with radial particles and circular oscilloscope',
  layers: [
    {
      ...makeShaderLayer('nebula', 'Nebula BG', {
        speed: staticParam(0.4),
        intensity: staticParam(0.9),
        scale: staticParam(1.2),
        color1: staticParam('#2d1b69'),
        color2: staticParam('#0984e3'),
        color3: staticParam('#fd79a8'),
        audioReactivity: staticParam(1.2),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.2),
        feedbackZoom: staticParam(1.003),
        feedbackRotate: staticParam(0.001),
      }),
      effects: [],
    },
    makeParticleField({
      name: 'Star Dust',
      pattern: 'radial',
      maxParticles: staticParam(400),
      spawnRate: staticParam(20),
      baseSpeed: staticParam(40),
      baseSize: staticParam(2),
      lifetime: staticParam(6),
      colorMode: 'gradient',
      gradientColor1: staticParam('#aabbff'),
      gradientColor2: staticParam('#ff88cc'),
      glowEnabled: staticParam(true),
      burstOnBeat: staticParam(true),
      burstThreshold: staticParam(0.5),
      burstCount: staticParam(30),
      opacity: staticParam(0.7),
      blendMode: 'add',
    }),
    makeOscilloscope({
      name: 'Space Scope',
      mode: 'circular',
      circularRadius: staticParam(120),
      circularAmplitude: staticParam(60),
      lineWidth: staticParam(2),
      color: staticParam('#aabbff'),
      glowEnabled: staticParam(true),
      glowStrength: staticParam(1.5),
      glowColor: staticParam('#6c5ce7'),
      opacity: staticParam(0.6),
      blendMode: 'add',
    }),
  ],
};

/**
 * SACRED GEOMETRY — Geometric patterns with gold circular spectrum
 */
export const PRESET_SACRED_GEOMETRY: PresetTemplate = {
  id: 'sacred-geometry',
  name: 'Sacred Geometry',
  description: 'Wireframe geometric patterns with gold circular spectrum and text',
  layers: [
    {
      ...makeShaderLayer('geometric', 'Geometry BG', {
        speed: staticParam(0.4),
        intensity: staticParam(1),
        scale: staticParam(1),
        color1: staticParam('#ffd700'),
        color2: staticParam('#ff8c00'),
        color3: staticParam('#ffffff'),
        audioReactivity: staticParam(1.5),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.3),
        feedbackZoom: staticParam(1.004),
        feedbackRotate: staticParam(-0.002),
      }),
      effects: [],
    },
    makeHDCircularSpectrum({
      name: 'Gold Ring',
      innerRadius: staticParam(130),
      barMaxHeight: staticParam(150),
      barCount: staticParam(64),
      gain: staticParam(1.8),
      colorMode: 'solid',
      solidColor: staticParam('#ffd700'),
      glowStrength: staticParam(1.3),
      rotationSpeed: staticParam(-0.05),
      opacity: staticParam(0.7),
      blendMode: 'add',
    }),
    makeText({
      name: 'Sacred Text',
      text: 'SACRED',
      fontSize: staticParam(48),
      fontWeight: 'bold',
      color: staticParam('#ffd700'),
      positionX: staticParam(0.5),
      positionY: staticParam(0.88),
      glowEnabled: staticParam(true),
      glowStrength: staticParam(1.5),
      glowColor: staticParam('#ff8c00'),
      audioPulseAmount: staticParam(0.15),
      letterSpacing: staticParam(12),
      opacity: staticParam(0.8),
    }),
  ],
};

/**
 * LIQUID DREAMS — Metaballs with mirrored oscilloscope and orbital particles
 */
export const PRESET_LIQUID_DREAMS: PresetTemplate = {
  id: 'liquid-dreams',
  name: 'Liquid Dreams',
  description: 'Flowing metaballs with mirrored waveform and orbital particles',
  layers: [
    {
      ...makeShaderLayer('liquid', 'Liquid BG', {
        speed: staticParam(0.6),
        intensity: staticParam(1),
        scale: staticParam(1),
        color1: staticParam('#e77f08'),
        color2: staticParam('#0d86e3'),
        color3: staticParam('#fd3b26'),
        audioReactivity: staticParam(1.4),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.50),
        feedbackZoom: staticParam(1.00),
        feedbackRotate: staticParam(0.00),
      }),
      effects: [],
    },
    makeOscilloscope({
      name: 'Liquid Wave',
      mode: 'mirrored',
      lineWidth: staticParam(3),
      gain: staticParam(.60),
      color: staticParam('#ffffff'),
      fillEnabled: staticParam(true),
      fillOpacity: staticParam(0.1),
      mirrorY: staticParam(0.5),
      glowEnabled: staticParam(true),
      glowStrength: staticParam(1),
      glowColor: staticParam('#00cec9'),
      opacity: staticParam(0.6),
      blendMode: 'add',
    }),
    makeParticleField({
      name: 'Dream Dust',
      pattern: 'orbital',
      maxParticles: staticParam(300),
      spawnRate: staticParam(15),
      baseSpeed: staticParam(50),
      baseSize: staticParam(2.5),
      lifetime: staticParam(5),
      colorMode: 'gradient',
      gradientColor1: staticParam('#6c5ce7'),
      gradientColor2: staticParam('#00cec9'),
      glowEnabled: staticParam(true),
      opacity: staticParam(0.5),
      blendMode: 'add',
    }),
  ],
};


export const PRESET_FLUID_NEBULA: PresetTemplate = {
  id: 'fluid-nebula',
  name: 'Fluid Nebula',
  description: 'Liquid nebula drift with smooth cinematic displacement',
  layers: [
    {
      ...makeShaderLayer('liquid', 'Nebula Liquid', {
        speed: staticParam(2.1),
        intensity: staticParam(1.05),
        scale: staticParam(1.65),
        color1: staticParam('#54ec13'),
        color2: staticParam('#f11809'),
        color3: staticParam('#2491e5'),
        audioReactivity: staticParam(1.3),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.07),
        feedbackZoom: staticParam(0.99),
        feedbackRotate: staticParam(0.02),
      }),
      effects: [],
    },
    {
      ...makeShaderLayer('displacement', 'Nebula Refract', {
        speed: staticParam(0.42),
        intensity: staticParam(1),
        scale: staticParam(1.2),
        color1: staticParam('#de2b17'),
        color2: staticParam('#ce3636'),
        color3: staticParam('#0de727'),
        audioReactivity: staticParam(1.35),
        distortionStrength: staticParam(2.63),
        flowSpeed: staticParam(1.68),
        viscosity: staticParam(0.13),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.03),
        feedbackZoom: staticParam(0.98),
        feedbackRotate: staticParam(0),
        opacity: staticParam(0.9),
      }),
      effects: [],
    },
  ],
};


export const PRESET_DOT_DNA: PresetTemplate = {
  id: 'dot-dna',
  name: 'Dot DNA',
  description: 'Dual helix-style dot strands with contrasting gradients and tight audio response',
  settings: { backgroundColor: '#000000' },
  layers: [
    makeDotSphereEqualizer({
      name: 'DNA_STRAND_A',
      columns: staticParam(58),
      dotsPerColumn: staticParam(24),
      baseRadius: staticParam(2.8),
      sphereSize: staticParam(0.26),
      mirrorEnabled: staticParam(true),
      gain: staticParam(1.12),
      attack: staticParam(0.7),
      release: staticParam(0.24),
      peakHoldEnabled: staticParam(true),
      peakHoldDecay: staticParam(0.94),
      gradientPreset: 'cool',
      glowEnabled: staticParam(true),
      glowStrength: staticParam(1.6),
      textEnabled: staticParam(false),
      textString: 'DNA',
      transform: {
        x: staticParam(-120),
        y: staticParam(0),
        scale: staticParam(0.92),
        rotation: staticParam(-0.24),
      },
      blendMode: 'add',
      opacity: staticParam(0.92),
    }),
    makeDotSphereEqualizer({
      name: 'DNA_STRAND_B',
      columns: staticParam(58),
      dotsPerColumn: staticParam(24),
      baseRadius: staticParam(2.8),
      sphereSize: staticParam(0.26),
      mirrorEnabled: staticParam(true),
      gain: staticParam(1.05),
      attack: staticParam(0.64),
      release: staticParam(0.26),
      peakHoldEnabled: staticParam(true),
      peakHoldDecay: staticParam(0.94),
      gradientPreset: 'warm',
      glowEnabled: staticParam(true),
      glowStrength: staticParam(1.4),
      textEnabled: staticParam(false),
      textString: 'DNA',
      transform: {
        x: staticParam(120),
        y: staticParam(0),
        scale: staticParam(0.92),
        rotation: staticParam(0.24),
      },
      blendMode: 'add',
      opacity: staticParam(0.88),
    }),
  ],
};

/**
 * DOT SPHERE (SOUNDWAVE) — Clean HD dot-matrix equalizer sphere
 */
export const PRESET_NEON_360: PresetTemplate = {
  id: 'dot-sphere-equalizer',
  name: 'Neon 360 Spectrum',
  description: 'Full-circle rainbow radial spectrum with glowing ring, peak hold, and EDM vignette',
  settings: { backgroundColor: '#04050d' },
  layers: [
    {
      ...makeShaderLayer('pulseRings', 'EDM Backdrop', {
        speed: staticParam(0.22),
        intensity: staticParam(0.28),
        scale: staticParam(0.72),
        color1: staticParam('#0d1a52'),
        color2: staticParam('#102d6e'),
        color3: staticParam('#25114d'),
        audioReactivity: staticParam(0.32),
        opacity: staticParam(0.38),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.05),
        feedbackZoom: staticParam(1.0008),
        feedbackRotate: staticParam(0),
      }),
      effects: [
        makeVignetteEffect(0.74, 0.34),
      ],
    },
    {
      ...makeRadialSpectrum({
        name: 'Neon 360 Bars',
        radius: staticParam(130),
        thickness: staticParam(4),
        barCount: staticParam(180),
        barGap: staticParam(0.8),
        gain: staticParam(1.55),
        smoothing: { attack: staticParam(0.38), release: staticParam(0.1) },
        compressionPow: staticParam(0.72),
        peakHold: { enabled: staticParam(true), decay: staticParam(0.955) },
        color: {
          mode: 'gradient',
          solid: staticParam('#ffffff'),
          gradient: staticParam({
            stops: [
              { pos: 0.00, color: '#ff2b2b' },
              { pos: 0.17, color: '#ffd53c' },
              { pos: 0.33, color: '#5eff74' },
              { pos: 0.50, color: '#39f6ff' },
              { pos: 0.67, color: '#3a6dff' },
              { pos: 0.83, color: '#ff45f6' },
              { pos: 1.00, color: '#ff2b2b' },
            ],
          }),
        },
        noiseJitter: staticParam(0.018),
        opacity: staticParam(0.96),
        blendMode: 'add',
      }),
      effects: [
        makeGlowEffect('#7cd6ff', 18),
      ],
    },
    {
      ...makeRadialWaveform({
        name: 'Glowing Core Ring',
        radius: staticParam(126),
        amplitude: staticParam(9),
        lineWidth: staticParam(4),
        color: staticParam('#f8fbff'),
        opacity: staticParam(0.86),
        blendMode: 'add',
      }),
      effects: [makeGlowEffect('#ffffff', 12)],
    },
  ],
};

/**
 * DOT SPHERE EQUALIZER — Standalone dot-matrix sphere preset.
 */
export const PRESET_DOT_SPHERE: PresetTemplate = {
  id: 'dot-sphere',
  name: 'Dot Sphere Equalizer',
  description: 'A luminous 3D dot sphere that breathes and expands with the music',
  settings: { backgroundColor: '#02030a' },
  layers: [
    makeDotSphereEqualizer({
      name: 'Dot Sphere Equalizer',
      columns: staticParam(92),
      dotsPerColumn: staticParam(32),
      baseRadius: staticParam(3.6),
      sphereSize: staticParam(0.4),
      mirrorEnabled: staticParam(true),
      gain: staticParam(0.8),
      attack: staticParam(0.7),
      release: staticParam(0.3),
      peakHoldEnabled: staticParam(true),
      peakHoldDecay: staticParam(0.96),
      gradientPreset: 'rainbow',
      glowEnabled: staticParam(true),
      glowStrength: staticParam(3),
      textEnabled: staticParam(true),
      textString: 'SOUNDWAVE',
    }),
  ],
};

/**
 * NEON MESH ODYSSEY — A dimensional wire landscape with frequency terrain.
 */
export const PRESET_NEON_MESH_ODYSSEY: PresetTemplate = {
  id: 'neon-mesh-odyssey',
  name: 'Neon Mesh Odyssey',
  description: 'A cinematic perspective mesh where the horizon, terrain, and stars react separately to the mix',
  settings: { backgroundColor: '#01030c' },
  layers: [
    {
      ...makeShaderLayer('meshWave', 'Frequency Terrain', {
        speed: staticParam(0.78),
        intensity: staticParam(1.25),
        scale: staticParam(1.08),
        color1: staticParam('#ff2bd6'),
        color2: staticParam('#13d9ff'),
        color3: staticParam('#fff2ad'),
        audioReactivity: staticParam(1.75),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.13),
        feedbackZoom: staticParam(1.001),
        feedbackRotate: staticParam(0),
      }),
      effects: [
        makeBloomEffect(1.45, 4.5, 0.28, 'bass'),
        makeChromaticEffect(2.2, 0.08, true),
        makeVignetteEffect(0.64, 0.42),
        makeBeatPunchEffect(0.035, 0.18, 1.2, 190),
      ],
    },
  ],
};

/**
 * KALEIDO REACTOR — Mirrored spectral ink with a bass-driven energy core.
 */
export const PRESET_KALEIDO_REACTOR: PresetTemplate = {
  id: 'kaleido-reactor',
  name: 'Kaleido Reactor',
  description: 'Ten-way mirrored spectral geometry with a pulsing reactor core and polished neon bloom',
  settings: { backgroundColor: '#03000b' },
  layers: [
    {
      ...makeShaderLayer('kaleidoReactor', 'Prismatic Reactor', {
        speed: staticParam(0.64),
        intensity: staticParam(1.38),
        scale: staticParam(1.16),
        color1: staticParam('#ff1f8f'),
        color2: staticParam('#6d4aff'),
        color3: staticParam('#25f4ff'),
        audioReactivity: staticParam(1.9),
        feedbackEnabled: true,
        feedbackAmount: staticParam(0.18),
        feedbackZoom: staticParam(1.002),
        feedbackRotate: staticParam(0.001),
      }),
      effects: [
        makeBloomEffect(1.7, 5.2, 0.24, 'full'),
        makeChromaticEffect(3.1, 0.22, true),
        makeVignetteEffect(0.74, 0.38),
        makeBeatPunchEffect(0.045, 0.45, 1.5, 170),
      ],
    },
  ],
};

/* ================================================================== */

export const ALL_PRESETS: PresetTemplate[] = [
  PRESET_NEON_MESH_ODYSSEY,
  PRESET_KALEIDO_REACTOR,
  PRESET_HYPERSPACE,
  PRESET_FRACTAL_DREAMS,
  PRESET_PSYCHEDELIC,
  PRESET_RETRO_80S,
  PRESET_HD_RAINBOW_BARS,
  PRESET_HD_SONIC_SPIKES,
  PRESET_AURORA_BOREALIS,
  PRESET_LIQUID_DREAMS,
  PRESET_FLUID_NEBULA,
  PRESET_DOT_SPHERE,
];
