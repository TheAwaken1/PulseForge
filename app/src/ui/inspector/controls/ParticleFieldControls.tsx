import React from 'react';
import { sampleParam, type ParticleFieldLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: ParticleFieldLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const ParticleFieldControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <Section title="Particles">
    <Field label="Max Particles">
      <RangeInput value={sampleParam(layer.maxParticles, 0)} min={50} max={2000} step={10} onChange={(v) => handleParamChange('maxParticles', v)} />
    </Field>
    <Field label="Spawn Rate">
      <RangeInput value={sampleParam(layer.spawnRate, 0)} min={1} max={100} step={1} onChange={(v) => handleParamChange('spawnRate', v)} />
    </Field>
    <Field label="Speed">
      <RangeInput value={sampleParam(layer.baseSpeed, 0)} min={5} max={300} step={1} onChange={(v) => handleParamChange('baseSpeed', v)} />
    </Field>
    <Field label="Size">
      <RangeInput value={sampleParam(layer.baseSize, 0)} min={1} max={20} step={0.5} onChange={(v) => handleParamChange('baseSize', v)} />
    </Field>
    <Field label="Lifetime">
      <RangeInput value={sampleParam(layer.lifetime, 0)} min={0.5} max={15} step={0.5} onChange={(v) => handleParamChange('lifetime', v)} />
    </Field>
    <Field label="Pattern">
      <select value={layer.pattern} onChange={(e) => handleDirectChange('pattern', e.target.value)}>
        <option value="radial">Radial</option>
        <option value="orbital">Orbital</option>
        <option value="rain">Rain</option>
        <option value="fountain">Fountain</option>
      </select>
    </Field>
    <Field label="Gravity Y">
      <RangeInput value={sampleParam(layer.gravityY, 0)} min={-200} max={200} step={5} onChange={(v) => handleParamChange('gravityY', v)} />
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
    <Field label="Audio Spawn Boost">
      <RangeInput value={sampleParam(layer.audioSpawnBoost, 0)} min={0} max={3} step={0.1} onChange={(v) => handleParamChange('audioSpawnBoost', v)} />
    </Field>
    <Field label="Audio Speed Boost">
      <RangeInput value={sampleParam(layer.audioSpeedBoost, 0)} min={0} max={3} step={0.1} onChange={(v) => handleParamChange('audioSpeedBoost', v)} />
    </Field>
    <Field label="Glow">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.glowEnabled, 0)} onChange={(e) => handleParamChange('glowEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Enabled
      </label>
    </Field>
    <Field label="Beat Burst">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={sampleParam(layer.burstOnBeat, 0)} onChange={(e) => handleParamChange('burstOnBeat', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Burst on Beat
      </label>
    </Field>
  </Section>
);
