import React from 'react';
import { sampleParam, type OscilloscopeLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';
import { LiquidMotionControls } from './LiquidMotionControls';

interface Props {
  layer: OscilloscopeLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const OscilloscopeControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <Section title="Oscilloscope">
    <Field label="Mode">
      <select value={layer.mode} onChange={(e) => handleDirectChange('mode', e.target.value)}>
        <option value="horizontal">Horizontal</option>
        <option value="mirrored">Mirrored</option>
        <option value="circular">Circular</option>
      </select>
    </Field>
    <Field label="Line Width">
      <RangeInput value={sampleParam(layer.lineWidth, 0)} min={1} max={10} step={0.5} onChange={(v) => handleParamChange('lineWidth', v)} />
    </Field>
    <Field label="Gain">
      <RangeInput value={sampleParam(layer.gain, 0)} min={0.1} max={5} step={0.1} onChange={(v) => handleParamChange('gain', v)} />
    </Field>
    <Field label="Smoothing">
      <RangeInput value={sampleParam(layer.smoothing, 0)} min={0} max={0.95} step={0.05} onChange={(v) => handleParamChange('smoothing', v)} />
    </Field>
    <Field label="Color">
      <input type="color" value={sampleParam(layer.color, 0)} onChange={(e) => handleParamChange('color', e.target.value)} />
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
    <Field label="Fill">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.fillEnabled, 0)} onChange={(e) => handleParamChange('fillEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Fill Under Wave
      </label>
    </Field>
    {layer.mode === 'mirrored' && (
      <Field label="Mirror Y">
        <RangeInput value={sampleParam(layer.mirrorY, 0)} min={0.1} max={0.9} step={0.01} onChange={(v) => handleParamChange('mirrorY', v)} />
      </Field>
    )}
    {layer.mode === 'circular' && (
      <>
        <Field label="Radius">
          <RangeInput value={sampleParam(layer.circularRadius, 0)} min={30} max={400} step={1} onChange={(v) => handleParamChange('circularRadius', v)} />
        </Field>
        <Field label="Amplitude">
          <RangeInput value={sampleParam(layer.circularAmplitude, 0)} min={10} max={300} step={1} onChange={(v) => handleParamChange('circularAmplitude', v)} />
        </Field>
      </>
    )}
    <Field label="Scanline Effect">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.scanlineEffect, 0)} onChange={(e) => handleParamChange('scanlineEffect', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        CRT Scanlines
      </label>
    </Field>
    <LiquidMotionControls enabled={layer.liquidMotion} amount={layer.liquidAmount} speed={layer.liquidSpeed} handleParamChange={handleParamChange} />
    <Field label="Gamma">
      <RangeInput value={sampleParam(layer.gamma, 0)} min={0.5} max={2} step={0.01} onChange={(v) => handleParamChange('gamma', v)} />
    </Field>
  </Section>
);
