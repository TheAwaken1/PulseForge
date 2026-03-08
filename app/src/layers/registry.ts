import type { RuntimeLayer } from '../renderer/types';
import type { LayerAny } from '../types/project';
import { BackgroundLayerRuntime } from './BackgroundLayer';
import { LogoLayerRuntime } from './LogoLayer';
import { RadialSpectrumLayerRuntime } from './RadialSpectrumLayer';
import { RadialWaveformLayerRuntime } from './RadialWaveformLayer';
import { BottomSpectrumLayerRuntime } from './BottomSpectrumLayer';
import { ShaderLayerRuntime } from './ShaderLayer';
import { HDBarsReflectionLayerRuntime } from './HDBarsReflectionLayer';
import { HDSonicSpikesLayerRuntime } from './HDSonicSpikesLayer';
import { HDCircularSpectrumLayerRuntime } from './HDCircularSpectrumLayer';
import { ParticleFieldLayerRuntime } from './ParticleFieldLayer';
import { OscilloscopeLayerRuntime } from './OscilloscopeLayer';
import { TextLayerRuntime } from './TextLayer';
import { EnergyRibbonLayerRuntime } from './EnergyRibbonLayer';
import { DotSphereEqualizerLayerRuntime } from './DotSphereEqualizerLayer';
import { LyricsLayerRuntime } from './LyricsLayer';

/**
 * Create a runtime layer instance from a layer configuration.
 */
export function createRuntimeLayer(config: LayerAny): RuntimeLayer {
  switch (config.kind) {
    case 'background':
      return new BackgroundLayerRuntime(config);
    case 'logo':
      return new LogoLayerRuntime(config);
    case 'radialSpectrum':
      return new RadialSpectrumLayerRuntime(config);
    case 'radialWaveform':
      return new RadialWaveformLayerRuntime(config);
    case 'bottomSpectrum':
      return new BottomSpectrumLayerRuntime(config);
    case 'shader':
      return new ShaderLayerRuntime(config);
    case 'hdRainbowBarsReflection':
      return new HDBarsReflectionLayerRuntime(config);
    case 'hdSonicWaveSpikes':
      return new HDSonicSpikesLayerRuntime(config);
    case 'hdCircularSpectrum':
      return new HDCircularSpectrumLayerRuntime(config);
    case 'particleField':
      return new ParticleFieldLayerRuntime(config);
    case 'oscilloscope':
      return new OscilloscopeLayerRuntime(config);
    case 'energyRibbon':
      return new EnergyRibbonLayerRuntime(config);
    case 'dotSphereEqualizer':
      return new DotSphereEqualizerLayerRuntime(config);
    case 'text':
      return new TextLayerRuntime(config);
    case 'lyrics':
      return new LyricsLayerRuntime(config);
    default:
      throw new Error(`Unknown layer kind: ${(config as any).kind}`);
  }
}
