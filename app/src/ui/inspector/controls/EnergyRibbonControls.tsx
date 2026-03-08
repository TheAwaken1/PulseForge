import React from 'react';
import { sampleParam, type EnergyRibbonLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: EnergyRibbonLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const EnergyRibbonControls: React.FC<Props> = ({ layer, handleParamChange }) => (
  <Section title="Energy Ribbon">
    <Field label="Intensity">
      <RangeInput value={sampleParam(layer.intensity, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('intensity', v)} />
    </Field>
    <Field label="Glow Strength">
      <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('glowStrength', v)} />
    </Field>
    <Field label="Spike Sensitivity">
      <RangeInput value={sampleParam(layer.spikeSensitivity, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('spikeSensitivity', v)} />
    </Field>
    <Field label="Ribbon Thickness">
      <RangeInput value={sampleParam(layer.ribbonThickness, 0)} min={2} max={40} step={0.1} onChange={(v) => handleParamChange('ribbonThickness', v)} />
    </Field>
    <Field label="Attack">
      <RangeInput value={sampleParam(layer.smoothing.attack, 0)} min={0.05} max={0.8} step={0.01} onChange={(v) => handleParamChange('smoothing.attack', v)} />
    </Field>
    <Field label="Release">
      <RangeInput value={sampleParam(layer.smoothing.release, 0)} min={0.01} max={0.3} step={0.01} onChange={(v) => handleParamChange('smoothing.release', v)} />
    </Field>
    <Field label="Color Theme">
      <select value={sampleParam(layer.colorTheme, 0)} onChange={(e) => handleParamChange('colorTheme', e.target.value)}>
        <option value="electric">Electric</option>
        <option value="ice">Ice</option>
        <option value="sunset">Sunset</option>
      </select>
    </Field>
    <Field label="Mirror Reflection">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input
          type="checkbox"
          checked={sampleParam(layer.mirrorReflection, 0)}
          onChange={(e) => handleParamChange('mirrorReflection', e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        Enabled
      </label>
    </Field>
  </Section>
);
