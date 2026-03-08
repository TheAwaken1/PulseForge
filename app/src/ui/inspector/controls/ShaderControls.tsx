import React from 'react';
import { sampleParam, type ShaderLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: ShaderLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const ShaderControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <>
    <Section title="Shader">
      <Field label="Type">
        <select value={layer.shaderType} onChange={(e) => handleDirectChange('shaderType', e.target.value)}>
          <option value="tunnel">Tunnel</option>
          <option value="plasma">Plasma</option>
          <option value="starfield">Starfield</option>
          <option value="vortex">Vortex</option>
          <option value="fractalNoise">Fractal Noise</option>
          <option value="pulseRings">Pulse Rings</option>
          <option value="psychedelic">Psychedelic</option>
          <option value="retroGrid">Retro Grid</option>
          <option value="aurora">Aurora</option>
          <option value="nebula">Nebula</option>
          <option value="geometric">Geometric</option>
          <option value="liquid">Liquid</option>
          <option value="displacement">Fullscreen Displacement</option>
        </select>
      </Field>
      <Field label="Speed">
        <RangeInput value={sampleParam(layer.speed, 0)} min={0} max={5} step={0.05} onChange={(v) => handleParamChange('speed', v)} />
      </Field>
      <Field label="Intensity">
        <RangeInput value={sampleParam(layer.intensity, 0)} min={0} max={3} step={0.05} onChange={(v) => handleParamChange('intensity', v)} />
      </Field>
      <Field label="Scale">
        <RangeInput value={sampleParam(layer.scale, 0)} min={0.1} max={5} step={0.05} onChange={(v) => handleParamChange('scale', v)} />
      </Field>
      <Field label="Audio React">
        <RangeInput value={sampleParam(layer.audioReactivity, 0)} min={0} max={3} step={0.05} onChange={(v) => handleParamChange('audioReactivity', v)} />
      </Field>
      {layer.shaderType === 'displacement' && (
        <>
          <Field label="Distortion Strength">
            <RangeInput value={sampleOr(layer.distortionStrength, 1)} min={0} max={3} step={0.01} onChange={(v) => handleParamChange('distortionStrength', v)} />
          </Field>
          <Field label="Speed">
            <RangeInput value={sampleOr(layer.flowSpeed, 0.5)} min={0.05} max={2} step={0.01} onChange={(v) => handleParamChange('flowSpeed', v)} />
          </Field>
          <Field label="Viscosity">
            <RangeInput value={sampleOr(layer.viscosity, 0.72)} min={0.05} max={1} step={0.01} onChange={(v) => handleParamChange('viscosity', v)} />
          </Field>
        </>
      )}
      <Field label="Color 1">
        <input type="color" value={sampleParam(layer.color1, 0)} onChange={(e) => handleParamChange('color1', e.target.value)} />
      </Field>
      <Field label="Color 2">
        <input type="color" value={sampleParam(layer.color2, 0)} onChange={(e) => handleParamChange('color2', e.target.value)} />
      </Field>
      <Field label="Color 3">
        <input type="color" value={sampleParam(layer.color3, 0)} onChange={(e) => handleParamChange('color3', e.target.value)} />
      </Field>
    </Section>

    <Section title="Feedback">
      <Field label="Enabled">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={layer.feedbackEnabled} onChange={(e) => handleDirectChange('feedbackEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Feedback Effect (Classic Visualizer Style)
        </label>
      </Field>
      {layer.feedbackEnabled && (
        <>
          <Field label="Amount">
            <RangeInput value={sampleParam(layer.feedbackAmount, 0)} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('feedbackAmount', v)} />
          </Field>
          <Field label="Zoom">
            <RangeInput value={sampleParam(layer.feedbackZoom, 0)} min={0.98} max={1.02} step={0.001} onChange={(v) => handleParamChange('feedbackZoom', v)} />
          </Field>
          <Field label="Rotate">
            <RangeInput value={sampleParam(layer.feedbackRotate, 0)} min={-0.02} max={0.02} step={0.001} onChange={(v) => handleParamChange('feedbackRotate', v)} />
          </Field>
        </>
      )}
    </Section>
  </>
);

function sampleOr(param: any, fallback: number): number {
  try {
    if (!param) return fallback;
    return sampleParam(param, 0);
  } catch {
    return fallback;
  }
}
