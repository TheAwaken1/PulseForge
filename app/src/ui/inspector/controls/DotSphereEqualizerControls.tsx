import React from 'react';
import { sampleParam, type DotSphereEqualizerLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: DotSphereEqualizerLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const DotSphereEqualizerControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <Section title="Dot Sphere Equalizer">
    <Field label="Columns">
      <RangeInput value={sampleParam(layer.columns, 0)} min={32} max={128} step={1} onChange={(v) => handleParamChange('columns', v)} />
    </Field>
    <Field label="Dots Per Column">
      <RangeInput value={sampleParam(layer.dotsPerColumn, 0)} min={10} max={32} step={1} onChange={(v) => handleParamChange('dotsPerColumn', v)} />
    </Field>
    <Field label="Dot Radius">
      <RangeInput value={sampleParam(layer.baseRadius, 0)} min={2} max={8} step={0.5} onChange={(v) => handleParamChange('baseRadius', v)} />
    </Field>
    <Field label="Sphere Size">
      <RangeInput value={sampleParam(layer.sphereSize, 0)} min={0.2} max={0.5} step={0.01} onChange={(v) => handleParamChange('sphereSize', v)} />
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.1} max={5} step={0.1} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Attack">
      <RangeInput value={sampleParam(layer.attack, 0)} min={0.05} max={0.8} step={0.01} onChange={(v) => handleParamChange('attack', v)} />
    </Field>
    <Field label="Release">
      <RangeInput value={sampleParam(layer.release, 0)} min={0.01} max={0.3} step={0.01} onChange={(v) => handleParamChange('release', v)} />
    </Field>
    <Field label="Mirror">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.mirrorEnabled, 0)} onChange={(e) => handleParamChange('mirrorEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Peak Hold">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.peakHoldEnabled, 0)} onChange={(e) => handleParamChange('peakHoldEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    {sampleParam(layer.peakHoldEnabled, 0) && (
      <Field label="Peak Decay">
        <RangeInput value={sampleParam(layer.peakHoldDecay, 0)} min={0.90} max={0.99} step={0.01} onChange={(v) => handleParamChange('peakHoldDecay', v)} />
      </Field>
    )}
    <Field label="Gradient">
      <select value={layer.gradientPreset} onChange={(e) => handleDirectChange('gradientPreset', e.target.value)}>
        <option value="rainbow">Rainbow</option>
        <option value="cool">Cool</option>
        <option value="warm">Warm</option>
      </select>
    </Field>
    <Field label="Glow">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.glowEnabled, 0)} onChange={(e) => handleParamChange('glowEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    {sampleParam(layer.glowEnabled, 0) && (
      <Field label="Glow Strength">
        <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.1} onChange={(v) => handleParamChange('glowStrength', v)} />
      </Field>
    )}
    <Field label="Text Overlay">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.textEnabled, 0)} onChange={(e) => handleParamChange('textEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    {sampleParam(layer.textEnabled, 0) && (
      <Field label="Text">
        <input
          type="text"
          value={layer.textString}
          onChange={(e) => handleDirectChange('textString', e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: '4px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)' }}
        />
      </Field>
    )}
  </Section>
);
