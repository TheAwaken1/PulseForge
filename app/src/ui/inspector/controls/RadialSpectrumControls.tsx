import React from 'react';
import { sampleParam, staticParam, type RadialSpectrumLayerConfig, type LayerAny } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';
import { LiquidMotionControls } from './LiquidMotionControls';

interface Props {
  layer: RadialSpectrumLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  updateLayer: (id: string, updates: Partial<LayerAny>) => void;
}

export const RadialSpectrumControls: React.FC<Props> = ({ layer, handleParamChange, updateLayer }) => (
  <Section title="Spectrum">
    <Field label="Radius">
      <RangeInput value={sampleParam(layer.radius, 0)} min={50} max={500} step={1} onChange={(v) => handleParamChange('radius', v)} />
    </Field>
    <Field label="Bar Count">
      <RangeInput value={sampleParam(layer.barCount, 0)} min={16} max={128} step={1} onChange={(v) => handleParamChange('barCount', v)} />
    </Field>
    <Field label="Thickness">
      <RangeInput value={sampleParam(layer.thickness, 0)} min={1} max={20} step={0.5} onChange={(v) => handleParamChange('thickness', v)} />
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.1} max={5} step={0.1} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Color">
      <input type="color" value={sampleParam(layer.color.solid, 0)}
        onChange={(e) => { updateLayer(layer.id, { color: { mode: 'solid', solid: staticParam(e.target.value) } } as any); }} />
    </Field>
    <Field label="Rounded Bars">
      <input
        type="checkbox"
        checked={layer.roundedCaps ?? false}
        onChange={(e) => updateLayer(layer.id, { roundedCaps: e.target.checked } as any)}
        style={{ accentColor: 'var(--accent)' }}
      />
    </Field>
    <LiquidMotionControls enabled={layer.liquidMotion} amount={layer.liquidAmount} speed={layer.liquidSpeed} handleParamChange={handleParamChange} />
    <Field label="Noise Jitter">
      <RangeInput value={sampleParam(layer.noiseJitter, 0)} min={0} max={0.1} step={0.005} onChange={(v) => handleParamChange('noiseJitter', v)} />
    </Field>
  </Section>
);
