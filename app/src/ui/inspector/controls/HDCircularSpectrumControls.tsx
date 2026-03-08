import React from 'react';
import { sampleParam, type HDCircularSpectrumLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: HDCircularSpectrumLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const HDCircularSpectrumControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <Section title="Circular Spectrum">
    <Field label="Bar Count">
      <RangeInput value={sampleParam(layer.barCount, 0)} min={24} max={128} step={1} onChange={(v) => handleParamChange('barCount', v)} />
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
    <Field label="Inner Radius">
      <RangeInput value={sampleParam(layer.innerRadius, 0)} min={30} max={400} step={1} onChange={(v) => handleParamChange('innerRadius', v)} />
    </Field>
    <Field label="Bar Max Height">
      <RangeInput value={sampleParam(layer.barMaxHeight, 0)} min={50} max={500} step={1} onChange={(v) => handleParamChange('barMaxHeight', v)} />
    </Field>
    <Field label="Bar Width Ratio">
      <RangeInput value={sampleParam(layer.barWidthRatio, 0)} min={0.2} max={1} step={0.05} onChange={(v) => handleParamChange('barWidthRatio', v)} />
    </Field>
    <Field label="Compression">
      <RangeInput value={sampleParam(layer.compressionPow, 0)} min={0.3} max={1.2} step={0.01} onChange={(v) => handleParamChange('compressionPow', v)} />
    </Field>
    <Field label="Color Mode">
      <select value={layer.colorMode} onChange={(e) => handleDirectChange('colorMode', e.target.value)}>
        <option value="rainbow">Rainbow</option>
        <option value="solid">Solid</option>
        <option value="gradient">Gradient</option>
      </select>
    </Field>
    {layer.colorMode === 'solid' && (
      <Field label="Color">
        <input type="color" value={sampleParam(layer.solidColor, 0)} onChange={(e) => handleParamChange('solidColor', e.target.value)} />
      </Field>
    )}
    {layer.colorMode === 'gradient' && (
      <>
        <Field label="Gradient Start">
          <input type="color" value={sampleParam(layer.gradientColor1, 0)} onChange={(e) => handleParamChange('gradientColor1', e.target.value)} />
        </Field>
        <Field label="Gradient End">
          <input type="color" value={sampleParam(layer.gradientColor2, 0)} onChange={(e) => handleParamChange('gradientColor2', e.target.value)} />
        </Field>
      </>
    )}
    <Field label="Glow">
      <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('glowStrength', v)} />
    </Field>
    <Field label="Peak Hold">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.peakHold.enabled, 0)} onChange={(e) => handleParamChange('peakHold.enabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Reflection">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.reflectionEnabled, 0)} onChange={(e) => handleParamChange('reflectionEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Rotation Speed">
      <RangeInput value={sampleParam(layer.rotationSpeed, 0)} min={-1} max={1} step={0.01} onChange={(v) => handleParamChange('rotationSpeed', v)} />
    </Field>
    <Field label="Gamma">
      <RangeInput value={sampleParam(layer.gamma, 0)} min={0.5} max={1.4} step={0.01} onChange={(v) => handleParamChange('gamma', v)} />
    </Field>
    <Field label="Contrast">
      <RangeInput value={sampleParam(layer.contrast, 0)} min={0.7} max={2} step={0.01} onChange={(v) => handleParamChange('contrast', v)} />
    </Field>
  </Section>
);
