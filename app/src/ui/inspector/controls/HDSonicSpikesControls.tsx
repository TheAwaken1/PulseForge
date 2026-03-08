import React from 'react';
import { sampleParam, type HDSonicSpikesLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: HDSonicSpikesLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const HDSonicSpikesControls: React.FC<Props> = ({ layer, handleParamChange }) => (
  <Section title="HD Spikes">
    <Field label="Spike Count">
      <RangeInput value={sampleParam(layer.barCount, 0)} min={32} max={192} step={1} onChange={(v) => handleParamChange('barCount', v)} />
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.6} max={3} step={0.01} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Attack">
      <RangeInput value={sampleParam(layer.attack, 0)} min={0.05} max={0.8} step={0.01} onChange={(v) => handleParamChange('attack', v)} />
    </Field>
    <Field label="Release">
      <RangeInput value={sampleParam(layer.release, 0)} min={0.01} max={0.3} step={0.01} onChange={(v) => handleParamChange('release', v)} />
    </Field>
    <Field label="Compression">
      <RangeInput value={sampleParam(layer.compressionPow, 0)} min={0.3} max={1.2} step={0.01} onChange={(v) => handleParamChange('compressionPow', v)} />
    </Field>
    <Field label="Peak Hold">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.peakHold.enabled, 0)} onChange={(e) => handleParamChange('peakHold.enabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Peak Decay">
      <RangeInput value={sampleParam(layer.peakHold.decay, 0)} min={0.8} max={0.995} step={0.001} onChange={(v) => handleParamChange('peakHold.decay', v)} />
    </Field>
    <Field label="Glow">
      <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('glowStrength', v)} />
    </Field>
    <Field label="Mirror">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.mirror, 0)} onChange={(e) => handleParamChange('mirror', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Symmetric
      </label>
    </Field>
    <Field label="Line Thickness">
      <RangeInput value={sampleParam(layer.lineThickness, 0)} min={2} max={14} step={0.5} onChange={(v) => handleParamChange('lineThickness', v)} />
    </Field>
    <Field label="Spike Scale">
      <RangeInput value={sampleParam(layer.spikeScale, 0)} min={0.2} max={1} step={0.01} onChange={(v) => handleParamChange('spikeScale', v)} />
    </Field>
    <Field label="Transient Boost">
      <RangeInput value={sampleParam(layer.transientBoost, 0)} min={0} max={2} step={0.01} onChange={(v) => handleParamChange('transientBoost', v)} />
    </Field>
    <Field label="Gamma">
      <RangeInput value={sampleParam(layer.gamma, 0)} min={0.5} max={1.4} step={0.01} onChange={(v) => handleParamChange('gamma', v)} />
    </Field>
    <Field label="Contrast">
      <RangeInput value={sampleParam(layer.contrast, 0)} min={0.7} max={2} step={0.01} onChange={(v) => handleParamChange('contrast', v)} />
    </Field>
  </Section>
);
