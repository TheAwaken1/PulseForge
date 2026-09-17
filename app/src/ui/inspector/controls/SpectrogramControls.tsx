import React from 'react';
import { sampleParam, type SpectrogramLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: SpectrogramLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const SpectrogramControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <Section title="Spectrogram">
    <Field label="Color Scheme">
      <select value={layer.colorScheme} onChange={(e) => handleDirectChange('colorScheme', e.target.value)}>
        <option value="heat">Heat (black→red→white)</option>
        <option value="cool">Cool (black→blue→cyan)</option>
        <option value="rainbow">Rainbow (frequency-colored)</option>
        <option value="mono">Mono (grayscale)</option>
      </select>
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.2} max={4} step={0.1} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Height">
      <RangeInput value={sampleParam(layer.heightFraction, 0)} min={0.05} max={1} step={0.05} onChange={(v) => handleParamChange('heightFraction', v)} />
    </Field>
    <Field label="Position Y">
      <RangeInput value={sampleParam(layer.positionY, 0)} min={0} max={1} step={0.05} onChange={(v) => handleParamChange('positionY', v)} />
    </Field>
    <Field label="Log Frequency">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={layer.logScale} onChange={(e) => handleDirectChange('logScale', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Logarithmic scale
      </label>
    </Field>
    <Field label="Beat Marker">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={layer.beatMarker} onChange={(e) => handleDirectChange('beatMarker', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Flash on beat
      </label>
    </Field>
  </Section>
);
