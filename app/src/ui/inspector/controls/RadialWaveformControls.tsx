import React from 'react';
import { sampleParam, type RadialWaveformLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';
import { LiquidMotionControls } from './LiquidMotionControls';

interface Props {
  layer: RadialWaveformLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const RadialWaveformControls: React.FC<Props> = ({ layer, handleParamChange }) => (
  <Section title="Waveform">
    <Field label="Radius">
      <RangeInput value={sampleParam(layer.radius, 0)} min={50} max={500} step={1} onChange={(v) => handleParamChange('radius', v)} />
    </Field>
    <Field label="Amplitude">
      <RangeInput value={sampleParam(layer.amplitude, 0)} min={10} max={300} step={1} onChange={(v) => handleParamChange('amplitude', v)} />
    </Field>
    <Field label="Line Width">
      <RangeInput value={sampleParam(layer.lineWidth, 0)} min={1} max={10} step={0.5} onChange={(v) => handleParamChange('lineWidth', v)} />
    </Field>
    <Field label="Color">
      <input type="color" value={sampleParam(layer.color, 0)} onChange={(e) => handleParamChange('color', e.target.value)} />
    </Field>
    <LiquidMotionControls enabled={layer.liquidMotion} amount={layer.liquidAmount} speed={layer.liquidSpeed} handleParamChange={handleParamChange} />
  </Section>
);
