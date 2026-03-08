import React from 'react';
import { sampleParam, type BottomSpectrumLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: BottomSpectrumLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const BottomSpectrumControls: React.FC<Props> = ({ layer, handleParamChange }) => (
  <Section title="Spectrum">
    <Field label="Bar Count">
      <RangeInput value={sampleParam(layer.barCount, 0)} min={16} max={128} step={1} onChange={(v) => handleParamChange('barCount', v)} />
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.1} max={5} step={0.1} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Color">
      <input type="color" value={sampleParam(layer.color, 0)} onChange={(e) => handleParamChange('color', e.target.value)} />
    </Field>
  </Section>
);
