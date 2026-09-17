import {
  createEffectId,
  createLayerId,
  defaultTransform,
  staticParam,
  type PulseEffectConfig,
  type RadialSpectrumLayerConfig,
  type ShakeEffectConfig,
} from '../types/project';

export function createLogoMatchedShake(): ShakeEffectConfig {
  return {
    id: createEffectId(),
    name: 'Shake',
    kind: 'shake',
    enabled: true,
    amountPx: staticParam(3),
    amountRot: staticParam(0.006),
    speed: staticParam(10),
    audioDriven: true,
    audioAmount: staticParam(2.2),
    audioTarget: 'full',
  };
}

export function createLogoMatchedPulse(): PulseEffectConfig {
  return {
    id: createEffectId(),
    name: 'Pulse',
    kind: 'pulse',
    enabled: true,
    baseScaleAdd: staticParam(0),
    audioAmount: staticParam(0.14),
    smoothing: staticParam(0.32),
    audioTarget: 'full',
  };
}

/**
 * A polished radial spectrum sized to sit just outside the default 375px
 * circular brand logo. Kept as its own layer so users can recolor, resize,
 * hide, or reorder it independently.
 */
export function createLogoSpectrumLayer(): RadialSpectrumLayerConfig {
  return {
    id: createLayerId(),
    name: 'Logo Spectrum Halo',
    kind: 'radialSpectrum',
    enabled: true,
    opacity: staticParam(0.95),
    blendMode: 'screen',
    transform: defaultTransform(),
    // These deliberately match the branding logo so both layers move as one.
    effects: [createLogoMatchedShake(), createLogoMatchedPulse()],
    centerX: staticParam(0),
    centerY: staticParam(0),
    radius: staticParam(196),
    thickness: staticParam(20),
    barCount: staticParam(128),
    barGap: staticParam(1),
    gain: staticParam(0.80),
    smoothing: {
      attack: staticParam(0.58),
      release: staticParam(0.14),
    },
    // A value above 1 keeps the frequency differences visible instead of
    // lifting every quiet band into a nearly uniform ring.
    compressionPow: staticParam(1.08),
    peakHold: {
      enabled: staticParam(false),
      decay: staticParam(0.94),
    },
    color: {
      mode: 'solid',
      solid: staticParam('#8b7cff'),
    },
    roundedCaps: true,
    liquidMotion: true,
    liquidAmount: staticParam(1.5),
    liquidSpeed: staticParam(1.35),
    noiseJitter: staticParam(0.03),
  };
}
