import React from 'react';
import type { LayerAny, Asset } from '../../types/project';
import { BackgroundControls } from './controls/BackgroundControls';
import { LogoControls } from './controls/LogoControls';
import { RadialSpectrumControls } from './controls/RadialSpectrumControls';
import { RadialWaveformControls } from './controls/RadialWaveformControls';
import { BottomSpectrumControls } from './controls/BottomSpectrumControls';
import { HDBarsReflectionControls } from './controls/HDBarsReflectionControls';
import { HDSonicSpikesControls } from './controls/HDSonicSpikesControls';
import { HDCircularSpectrumControls } from './controls/HDCircularSpectrumControls';
import { ParticleFieldControls } from './controls/ParticleFieldControls';
import { OscilloscopeControls } from './controls/OscilloscopeControls';
import { TextControls } from './controls/TextControls';
import { ShaderControls } from './controls/ShaderControls';
import { EnergyRibbonControls } from './controls/EnergyRibbonControls';
import { DotSphereEqualizerControls } from './controls/DotSphereEqualizerControls';
import { LyricsControls } from './controls/LyricsControls';

interface Props {
  layer: LayerAny;
  imageAssets: Asset[];
  handleAssignAsset: (assetId: string) => void;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
  updateLayer: (id: string, updates: Partial<LayerAny>) => void;
}

export const LayerControls: React.FC<Props> = (props) => {
  const { layer, imageAssets, handleAssignAsset, handleParamChange, handleDirectChange, updateLayer } = props;

  switch (layer.kind) {
    case 'background':
      return <BackgroundControls layer={layer} imageAssets={imageAssets} handleAssignAsset={handleAssignAsset} handleDirectChange={handleDirectChange} />;
    case 'logo':
      return <LogoControls layer={layer} imageAssets={imageAssets} handleAssignAsset={handleAssignAsset} updateLayer={updateLayer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'radialSpectrum':
      return <RadialSpectrumControls layer={layer} handleParamChange={handleParamChange} updateLayer={updateLayer} />;
    case 'radialWaveform':
      return <RadialWaveformControls layer={layer} handleParamChange={handleParamChange} />;
    case 'bottomSpectrum':
      return <BottomSpectrumControls layer={layer} handleParamChange={handleParamChange} />;
    case 'hdRainbowBarsReflection':
      return <HDBarsReflectionControls layer={layer} handleParamChange={handleParamChange} />;
    case 'hdSonicWaveSpikes':
      return <HDSonicSpikesControls layer={layer} handleParamChange={handleParamChange} />;
    case 'hdCircularSpectrum':
      return <HDCircularSpectrumControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'particleField':
      return <ParticleFieldControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'oscilloscope':
      return <OscilloscopeControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'energyRibbon':
      return <EnergyRibbonControls layer={layer} handleParamChange={handleParamChange} />;
    case 'dotSphereEqualizer':
      return <DotSphereEqualizerControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'text':
      return <TextControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'lyrics':
      return <LyricsControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    case 'shader':
      return <ShaderControls layer={layer} handleParamChange={handleParamChange} handleDirectChange={handleDirectChange} />;
    default:
      return null;
  }
};
