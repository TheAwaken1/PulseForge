import type { RuntimeEffect } from '../renderer/types';
import type { EffectAny } from '../types/project';
import { ShakeEffectRuntime } from './ShakeEffect';
import { PulseEffectRuntime } from './PulseEffect';
import { StrobeEffectRuntime } from './StrobeEffect';
import { GlowEffectRuntime } from './GlowEffect';
import { BlurEffectRuntime } from './BlurEffect';
import { ChromaticAberrationEffectRuntime } from './ChromaticAberrationEffect';
import { GradientMapEffectRuntime } from './GradientMapEffect';
import { VignetteEffectRuntime } from './VignetteEffect';
import { BloomEffectRuntime } from './BloomEffect';
import { ColorGradeEffectRuntime } from './ColorGradeEffect';
import { PixelateEffectRuntime } from './PixelateEffect';
import { BeatPunchEffectRuntime } from './BeatPunchEffect';

/**
 * Create a runtime effect instance from an effect configuration.
 */
export function createRuntimeEffect(config: EffectAny): RuntimeEffect {
  switch (config.kind) {
    case 'shake':
      return new ShakeEffectRuntime(config);
    case 'pulse':
      return new PulseEffectRuntime(config);
    case 'strobe':
      return new StrobeEffectRuntime(config);
    case 'glow':
      return new GlowEffectRuntime(config);
    case 'blur':
      return new BlurEffectRuntime(config);
    case 'chromaticAberration':
      return new ChromaticAberrationEffectRuntime(config);
    case 'gradientMap':
      return new GradientMapEffectRuntime(config);
    case 'vignette':
      return new VignetteEffectRuntime(config);
    case 'bloom':
      return new BloomEffectRuntime(config);
    case 'colorGrade':
      return new ColorGradeEffectRuntime(config);
    case 'pixelate':
      return new PixelateEffectRuntime(config);
    case 'beatPunch':
      return new BeatPunchEffectRuntime(config);
    default:
      throw new Error(`Unknown effect kind: ${(config as any).kind}`);
  }
}
