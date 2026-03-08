import React from 'react';
import { sampleParam, type HDBarsReflectionLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: HDBarsReflectionLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const HDBarsReflectionControls: React.FC<Props> = ({ layer, handleParamChange }) => (
  <Section title="HD Bars">
    <Field label="Bar Count">
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
    <Field label="Peak Caps">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.peakHold.showCaps, 0)} onChange={(e) => handleParamChange('peakHold.showCaps', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Show caps
      </label>
    </Field>
    <Field label="Glow">
      <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('glowStrength', v)} />
    </Field>
    <Field label="Reflection">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.reflectionEnabled, 0)} onChange={(e) => handleParamChange('reflectionEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Reflection Opacity">
      <RangeInput value={sampleParam(layer.reflectionOpacity, 0)} min={0} max={0.8} step={0.01} onChange={(v) => handleParamChange('reflectionOpacity', v)} />
    </Field>
    <Field label="Reflection Blur">
      <RangeInput value={sampleParam(layer.reflectionBlur, 0)} min={0} max={20} step={0.5} onChange={(v) => handleParamChange('reflectionBlur', v)} />
    </Field>
    <Field label="Reflection Fade">
      <RangeInput value={sampleParam(layer.reflectionFade, 0)} min={0.8} max={4} step={0.05} onChange={(v) => handleParamChange('reflectionFade', v)} />
    </Field>
    <Field label="Gamma">
      <RangeInput value={sampleParam(layer.gamma, 0)} min={0.5} max={1.4} step={0.01} onChange={(v) => handleParamChange('gamma', v)} />
    </Field>
    <Field label="Contrast">
      <RangeInput value={sampleParam(layer.contrast, 0)} min={0.7} max={2} step={0.01} onChange={(v) => handleParamChange('contrast', v)} />
    </Field>
  </Section>
);
