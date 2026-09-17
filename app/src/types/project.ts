import { v4 as uuid } from 'uuid';

// --- Parameter system (V2-ready keyframes) ---

export type StaticParam<T> = { kind: 'static'; value: T };

export type Keyframe<T> = {
  t: number; // seconds
  value: T;
  ease?: 'linear' | 'inOut' | 'in' | 'out' | { cubicBezier: [number, number, number, number] };
};

export type CurveParam<T> = { kind: 'curve'; keyframes: Keyframe<T>[] };

export type Param<T> = StaticParam<T> | CurveParam<T>;

export function staticParam<T>(value: T): StaticParam<T> {
  return { kind: 'static', value };
}

export function sampleParam<T>(p: Param<T>, t: number): T {
  if (p.kind === 'static') return p.value;
  const kf = p.keyframes;
  if (kf.length === 0) throw new Error('CurveParam has no keyframes');
  if (kf.length === 1 || t <= kf[0].t) return kf[0].value;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].value;
  // Find segment
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i].t && t <= kf[i + 1].t) {
      const frac = (t - kf[i].t) / (kf[i + 1].t - kf[i].t);
      // Linear interpolation only for numbers in V1
      const a = kf[i].value;
      const b = kf[i + 1].value;
      if (typeof a === 'number' && typeof b === 'number') {
        return (a + (b - a) * frac) as T;
      }
      // For non-number types, snap to nearest
      return frac < 0.5 ? a : b;
    }
  }
  return kf[kf.length - 1].value;
}

// --- Resolution ---

export type Resolution = { width: number; height: number };

// --- Asset ---

export type AssetType = 'audio' | 'image' | 'video';

export type Asset = {
  id: string;
  type: AssetType;
  name: string;
  originalPath?: string;
  relPath: string;
  sha256: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
};

// --- Transform ---

export type Transform = {
  x: Param<number>;
  y: Param<number>;
  scale: Param<number>;
  rotation: Param<number>; // radians
};

export function defaultTransform(): Transform {
  return {
    x: staticParam(0),
    y: staticParam(0),
    scale: staticParam(1),
    rotation: staticParam(0),
  };
}

// --- Blend modes ---

export type BlendMode = 'normal' | 'add' | 'screen' | 'multiply';

// --- Effect types ---

export type AudioTarget = 'full' | 'bass' | 'mids' | 'highs' | 'beat';

export type ShakeEffectConfig = {
  id: string;
  name: string;
  kind: 'shake';
  enabled: boolean;
  amountPx: Param<number>;
  amountRot: Param<number>;
  speed: Param<number>;
  audioDriven: boolean;
  audioAmount: Param<number>;
  audioTarget?: AudioTarget;
};

export type PulseEffectConfig = {
  id: string;
  name: string;
  kind: 'pulse';
  enabled: boolean;
  baseScaleAdd: Param<number>;
  audioAmount: Param<number>;
  smoothing: Param<number>;
  audioTarget?: AudioTarget;
};

export type StrobeEffectConfig = {
  id: string;
  name: string;
  kind: 'strobe';
  enabled: boolean;
  rateHz: Param<number>;
  dutyCycle: Param<number>;
  softEdge: Param<number>;
};

export type GlowEffectConfig = {
  id: string;
  name: string;
  kind: 'glow';
  enabled: boolean;
  distance: Param<number>;
  outerStrength: Param<number>;
  color: Param<string>;
  quality: Param<number>;
};

export type BlurEffectConfig = {
  id: string;
  name: string;
  kind: 'blur';
  enabled: boolean;
  blur: Param<number>;
  quality: Param<number>;
};

export type ChromaticAberrationEffectConfig = {
  id: string;
  name: string;
  kind: 'chromaticAberration';
  enabled: boolean;
  amountPx: Param<number>;
  angle: Param<number>;
  audioDriven: boolean;
  audioTarget?: AudioTarget;
};

export type GradientMapEffectConfig = {
  id: string;
  name: string;
  kind: 'gradientMap';
  enabled: boolean;
  stops: Param<{ pos: number; color: string }[]>;
};

export type VignetteEffectConfig = {
  id: string;
  name: string;
  kind: 'vignette';
  enabled: boolean;
  strength: Param<number>;
  radius: Param<number>;
};

export type BloomEffectConfig = {
  id: string;
  name: string;
  kind: 'bloom';
  enabled: boolean;
  threshold: Param<number>;
  strength: Param<number>;
  radius: Param<number>;
  softKnee: Param<number>;
  toneMap: boolean;
  audioDriven: boolean;
  audioAmount: Param<number>;
  audioTarget?: AudioTarget;
};

export type ColorGradeEffectConfig = {
  id: string;
  name: string;
  kind: 'colorGrade';
  enabled: boolean;
  hue: Param<number>;
  saturation: Param<number>;
  contrast: Param<number>;
  brightness: Param<number>;
  audioDriven: boolean;
  audioAmount: Param<number>;
  audioTarget?: AudioTarget;
};

export type PixelateEffectConfig = {
  id: string;
  name: string;
  kind: 'pixelate';
  enabled: boolean;
  pixelSize: Param<number>;
  mix: Param<number>;
  audioDriven: boolean;
  audioAmount: Param<number>;
  audioTarget?: AudioTarget;
};

export type BeatPunchEffectConfig = {
  id: string;
  name: string;
  kind: 'beatPunch';
  enabled: boolean;
  zoomAmount: Param<number>;
  rotationDeg: Param<number>;
  positionPx: Param<number>;
  decayMs: Param<number>;
};

export type EffectAny =
  | ShakeEffectConfig
  | PulseEffectConfig
  | StrobeEffectConfig
  | GlowEffectConfig
  | BlurEffectConfig
  | ChromaticAberrationEffectConfig
  | GradientMapEffectConfig
  | VignetteEffectConfig
  | BloomEffectConfig
  | ColorGradeEffectConfig
  | PixelateEffectConfig
  | BeatPunchEffectConfig;

export type EffectKind = EffectAny['kind'];

// --- Shader layer ---

export type ShaderType =
  | 'tunnel'
  | 'plasma'
  | 'starfield'
  | 'vortex'
  | 'fractalNoise'
  | 'pulseRings'
  | 'psychedelic'
  | 'retroGrid'
  | 'aurora'
  | 'nebula'
  | 'geometric'
  | 'liquid'
  | 'meshWave'
  | 'kaleidoReactor'
  | 'displacement';

// --- Layer types ---

export type LayerKind =
  | 'background'
  | 'logo'
  | 'radialSpectrum'
  | 'radialWaveform'
  | 'bottomSpectrum'
  | 'shader'
  | 'hdRainbowBarsReflection'
  | 'hdSonicWaveSpikes'
  | 'hdCircularSpectrum'
  | 'particleField'
  | 'oscilloscope'
  | 'dotSphereEqualizer'
  | 'text'
  | 'lyrics'
  | 'spectrogram';

export type LogoFrameShape = 'none' | 'circle' | 'square' | 'rounded';

export type LayerBase = {
  id: string;
  name: string;
  kind: LayerKind;
  enabled: boolean;
  opacity: Param<number>;
  blendMode: BlendMode;
  transform: Transform;
  effects: EffectAny[];
};

export type BackgroundLayerConfig = LayerBase & {
  kind: 'background';
  assetId: string;
  fit: 'cover' | 'contain' | 'stretch';
  /** Multiplicative image darkening, where 0 is unchanged and 1 is black. */
  darkness?: Param<number>;
};

export type LogoBorder = {
  enabled: boolean;
  width: Param<number>;
  color: Param<string>;
  glow: boolean;
};

export type LogoLayerConfig = LayerBase & {
  kind: 'logo';
  assetId: string;
  anchor: 'center';
  frameShape: LogoFrameShape;
  cornerRadius: Param<number>;
  fitMode: 'cover' | 'contain' | 'fill';
  autoFitOnImport: boolean;
  frameSize: Param<number>;
  padding: Param<number>;
  border: LogoBorder;
  /** Incremented when user clicks "Re-Fit". Runtime watches for changes. */
  _refitSeq: number;
};

export type RadialSpectrumLayerConfig = LayerBase & {
  kind: 'radialSpectrum';
  centerX: Param<number>;
  centerY: Param<number>;
  radius: Param<number>;
  thickness: Param<number>;
  barCount: Param<number>;
  barGap: Param<number>;
  gain: Param<number>;
  smoothing: {
    attack: Param<number>;
    release: Param<number>;
  };
  compressionPow: Param<number>;
  peakHold: {
    enabled: Param<boolean>;
    decay: Param<number>;
  };
  color: {
    mode: 'solid' | 'gradient';
    solid: Param<string>;
    gradient?: Param<{ stops: { pos: number; color: string }[] }>;
  };
  roundedCaps?: boolean;
  /** Organic, frequency-local deformation for less uniform radial motion. */
  liquidMotion?: boolean;
  liquidAmount?: Param<number>;
  liquidSpeed?: Param<number>;
  noiseJitter: Param<number>;
};

export type RadialWaveformLayerConfig = LayerBase & {
  kind: 'radialWaveform';
  centerX: Param<number>;
  centerY: Param<number>;
  radius: Param<number>;
  amplitude: Param<number>;
  lineWidth: Param<number>;
  smoothing: { attack: Param<number>; release: Param<number> };
  color: Param<string>;
  liquidMotion?: boolean;
  liquidAmount?: Param<number>;
  liquidSpeed?: Param<number>;
};

export type BottomSpectrumLayerConfig = LayerBase & {
  kind: 'bottomSpectrum';
  barX: Param<number>;
  barY: Param<number>;
  barWidth: Param<number>;
  barHeight: Param<number>;
  barCount: Param<number>;
  gain: Param<number>;
  smoothing: { attack: Param<number>; release: Param<number> };
  color: Param<string>;
  liquidMotion?: boolean;
  liquidAmount?: Param<number>;
  liquidSpeed?: Param<number>;
};

export type HDBarsReflectionLayerConfig = LayerBase & {
  kind: 'hdRainbowBarsReflection';
  barCount: Param<number>;
  gain: Param<number>;
  attack: Param<number>;
  release: Param<number>;
  compressionPow: Param<number>;
  peakHold: {
    enabled: Param<boolean>;
    decay: Param<number>;
    showCaps: Param<boolean>;
  };
  glowStrength: Param<number>;
  reflectionEnabled: Param<boolean>;
  reflectionOpacity: Param<number>;
  reflectionBlur: Param<number>;
  reflectionFade: Param<number>;
  gamma: Param<number>;
  contrast: Param<number>;
  baselineY: Param<number>;
  heightScale: Param<number>;
};

export type HDSonicSpikesLayerConfig = LayerBase & {
  kind: 'hdSonicWaveSpikes';
  barCount: Param<number>;
  gain: Param<number>;
  attack: Param<number>;
  release: Param<number>;
  compressionPow: Param<number>;
  peakHold: {
    enabled: Param<boolean>;
    decay: Param<number>;
  };
  glowStrength: Param<number>;
  mirror: Param<boolean>;
  lineThickness: Param<number>;
  gamma: Param<number>;
  contrast: Param<number>;
  spikeScale: Param<number>;
  transientBoost: Param<number>;
};

export type HDCircularSpectrumLayerConfig = LayerBase & {
  kind: 'hdCircularSpectrum';
  barCount: Param<number>;
  gain: Param<number>;
  attack: Param<number>;
  release: Param<number>;
  compressionPow: Param<number>;
  innerRadius: Param<number>;
  barMaxHeight: Param<number>;
  barWidthRatio: Param<number>;
  peakHold: {
    enabled: Param<boolean>;
    decay: Param<number>;
    showCaps: Param<boolean>;
  };
  colorMode: 'rainbow' | 'solid' | 'gradient';
  solidColor: Param<string>;
  gradientColor1: Param<string>;
  gradientColor2: Param<string>;
  glowStrength: Param<number>;
  reflectionEnabled: Param<boolean>;
  reflectionOpacity: Param<number>;
  reflectionFade: Param<number>;
  innerRing: {
    enabled: Param<boolean>;
    width: Param<number>;
    color: Param<string>;
    glowEnabled: Param<boolean>;
  };
  outerRing: {
    enabled: Param<boolean>;
    width: Param<number>;
    color: Param<string>;
    glowEnabled: Param<boolean>;
  };
  gamma: Param<number>;
  contrast: Param<number>;
  rotationSpeed: Param<number>;
  liquidMotion?: boolean;
  liquidAmount?: Param<number>;
  liquidSpeed?: Param<number>;
};

export type ParticleFieldLayerConfig = LayerBase & {
  kind: 'particleField';
  maxParticles: Param<number>;
  spawnRate: Param<number>;
  baseSpeed: Param<number>;
  baseSize: Param<number>;
  sizeVariation: Param<number>;
  lifetime: Param<number>;
  pattern: 'radial' | 'orbital' | 'rain' | 'fountain';
  gravityY: Param<number>;
  colorMode: 'rainbow' | 'solid' | 'gradient';
  solidColor: Param<string>;
  gradientColor1: Param<string>;
  gradientColor2: Param<string>;
  audioSpawnBoost: Param<number>;
  audioSpeedBoost: Param<number>;
  audioSizeBoost: Param<number>;
  trailLength: Param<number>;
  glowEnabled: Param<boolean>;
  glowStrength: Param<number>;
  burstOnBeat: Param<boolean>;
  burstThreshold: Param<number>;
  burstCount: Param<number>;
};

export type OscilloscopeLayerConfig = LayerBase & {
  kind: 'oscilloscope';
  mode: 'horizontal' | 'mirrored' | 'circular';
  lineWidth: Param<number>;
  gain: Param<number>;
  smoothing: Param<number>;
  sampleCount: Param<number>;
  color: Param<string>;
  glowEnabled: Param<boolean>;
  glowStrength: Param<number>;
  glowColor: Param<string>;
  fillEnabled: Param<boolean>;
  fillOpacity: Param<number>;
  mirrorY: Param<number>;
  circularRadius: Param<number>;
  circularAmplitude: Param<number>;
  lineGradient: {
    enabled: Param<boolean>;
    color1: Param<string>;
    color2: Param<string>;
  };
  gamma: Param<number>;
  stereoSpread: Param<number>;
  scanlineEffect: Param<boolean>;
  liquidMotion?: boolean;
  liquidAmount?: Param<number>;
  liquidSpeed?: Param<number>;
};

export type TextLayerConfig = LayerBase & {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: Param<number>;
  fontWeight: 'normal' | 'bold';
  color: Param<string>;
  textAlign: 'left' | 'center' | 'right';
  positionX: Param<number>;
  positionY: Param<number>;
  glowEnabled: Param<boolean>;
  glowStrength: Param<number>;
  glowColor: Param<string>;
  audioPulseAmount: Param<number>;
  audioShakeAmount: Param<number>;
  scrollEnabled: Param<boolean>;
  scrollSpeed: Param<number>;
  letterSpacing: Param<number>;
  strokeEnabled: Param<boolean>;
  strokeColor: Param<string>;
  strokeWidth: Param<number>;
};

export type DotSphereGradientPreset = 'rainbow' | 'cool' | 'warm';

export type DotSphereEqualizerLayerConfig = LayerBase & {
  kind: 'dotSphereEqualizer';
  columns: Param<number>;
  dotsPerColumn: Param<number>;
  baseRadius: Param<number>;
  sphereSize: Param<number>;
  mirrorEnabled: Param<boolean>;
  gain: Param<number>;
  attack: Param<number>;
  release: Param<number>;
  peakHoldEnabled: Param<boolean>;
  peakHoldDecay: Param<number>;
  gradientPreset: DotSphereGradientPreset;
  glowEnabled: Param<boolean>;
  glowStrength: Param<number>;
  textEnabled: Param<boolean>;
  textString: string;
};

export type ShaderLayerConfig = LayerBase & {
  kind: 'shader';
  shaderType: ShaderType;
  speed: Param<number>;
  intensity: Param<number>;
  scale: Param<number>;
  color1: Param<string>;
  color2: Param<string>;
  color3: Param<string>;
  audioReactivity: Param<number>;
  feedbackEnabled: boolean;
  feedbackAmount: Param<number>;
  feedbackZoom: Param<number>;
  feedbackRotate: Param<number>;
  distortionStrength: Param<number>;
  flowSpeed: Param<number>;
  viscosity: Param<number>;
};

export type LyricsLayerConfig = LayerBase & {
  kind: 'lyrics';
  lrcContent: string;
  /** Global sync correction: positive values delay lyrics; >1 stretches/slows time. */
  timingOffsetSec?: Param<number>;
  timingScale?: Param<number>;
  fontFamily: string;
  fontSize: Param<number>;
  fontWeight: 'normal' | 'bold';
  color: Param<string>;
  textAlign: 'left' | 'center' | 'right';
  positionX: Param<number>;
  positionY: Param<number>;
  showNextLine: boolean;
  nextLineOpacity: number;
  glowEnabled: Param<boolean>;
  glowStrength: Param<number>;
  glowColor: Param<string>;
  audioPulseAmount: Param<number>;
  strokeEnabled: Param<boolean>;
  strokeColor: Param<string>;
  strokeWidth: Param<number>;
};

export type SpectrogramColorScheme = 'heat' | 'cool' | 'rainbow' | 'mono';

export type SpectrogramLayerConfig = LayerBase & {
  kind: 'spectrogram';
  colorScheme: SpectrogramColorScheme;
  gain: Param<number>;
  logScale: boolean;
  beatMarker: boolean;
  heightFraction: Param<number>;
  positionY: Param<number>;
};

export type LayerAny =
  | BackgroundLayerConfig
  | LogoLayerConfig
  | RadialSpectrumLayerConfig
  | RadialWaveformLayerConfig
  | BottomSpectrumLayerConfig
  | ShaderLayerConfig
  | HDBarsReflectionLayerConfig
  | HDSonicSpikesLayerConfig
  | HDCircularSpectrumLayerConfig
  | ParticleFieldLayerConfig
  | OscilloscopeLayerConfig
  | DotSphereEqualizerLayerConfig
  | TextLayerConfig
  | LyricsLayerConfig
  | SpectrogramLayerConfig;

// --- Project ---

export type Project = {
  version: 1;
  name: string;
  fps: number;
  resolution: Resolution;
  durationSec: number;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
  layers: LayerAny[];
  presetsApplied?: string[];
  audio: {
    assetId: string;
    startOffsetSec?: number;
  };
  settings: {
    previewScale: number;
    backgroundColor: string;
  };
};

// --- Defaults ---

export function createDefaultProject(): Project {
  return {
    version: 1,
    name: 'Untitled Project',
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    durationSec: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: [],
    layers: [],
    audio: { assetId: '', startOffsetSec: 0 },
    settings: {
      previewScale: 1,
      backgroundColor: '#1a1a2e',
    },
  };
}

export function createLayerId(): string {
  return uuid();
}

export function createEffectId(): string {
  return uuid();
}
