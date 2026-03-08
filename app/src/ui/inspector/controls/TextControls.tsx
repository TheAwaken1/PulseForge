import React from 'react';
import { sampleParam, type TextLayerConfig } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: TextLayerConfig;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const TextControls: React.FC<Props> = ({ layer, handleParamChange, handleDirectChange }) => (
  <>
    <Section title="Text">
      <Field label="Text">
        <input type="text" value={layer.text} onChange={(e) => handleDirectChange('text', e.target.value)} />
      </Field>
      <Field label="Font Family">
        <select value={layer.fontFamily} onChange={(e) => handleDirectChange('fontFamily', e.target.value)}>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Inter">Inter</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
          <option value="Impact">Impact</option>
          <option value="Verdana">Verdana</option>
        </select>
      </Field>
      <Field label="Font Size">
        <RangeInput value={sampleParam(layer.fontSize, 0)} min={8} max={200} step={1} onChange={(v) => handleParamChange('fontSize', v)} />
      </Field>
      <Field label="Weight">
        <select value={layer.fontWeight} onChange={(e) => handleDirectChange('fontWeight', e.target.value)}>
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
        </select>
      </Field>
      <Field label="Color">
        <input type="color" value={sampleParam(layer.color, 0)} onChange={(e) => handleParamChange('color', e.target.value)} />
      </Field>
      <Field label="Align">
        <select value={layer.textAlign} onChange={(e) => handleDirectChange('textAlign', e.target.value)}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Position X">
        <RangeInput value={sampleParam(layer.positionX, 0)} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('positionX', v)} />
      </Field>
      <Field label="Position Y">
        <RangeInput value={sampleParam(layer.positionY, 0)} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('positionY', v)} />
      </Field>
    </Section>

    <Section title="Text Audio & Effects">
      <Field label="Audio Pulse">
        <RangeInput value={sampleParam(layer.audioPulseAmount, 0)} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('audioPulseAmount', v)} />
      </Field>
      <Field label="Audio Shake">
        <RangeInput value={sampleParam(layer.audioShakeAmount, 0)} min={0} max={20} step={0.5} onChange={(v) => handleParamChange('audioShakeAmount', v)} />
      </Field>
      <Field label="Glow">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={sampleParam(layer.glowEnabled, 0)} onChange={(e) => handleParamChange('glowEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Enabled
        </label>
      </Field>
      {sampleParam(layer.glowEnabled, 0) && (
        <>
          <Field label="Glow Strength">
            <RangeInput value={sampleParam(layer.glowStrength, 0)} min={0} max={3} step={0.1} onChange={(v) => handleParamChange('glowStrength', v)} />
          </Field>
          <Field label="Glow Color">
            <input type="color" value={sampleParam(layer.glowColor, 0)} onChange={(e) => handleParamChange('glowColor', e.target.value)} />
          </Field>
        </>
      )}
      <Field label="Scroll">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={sampleParam(layer.scrollEnabled, 0)} onChange={(e) => handleParamChange('scrollEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Scroll Text
        </label>
      </Field>
      {sampleParam(layer.scrollEnabled, 0) && (
        <Field label="Scroll Speed">
          <RangeInput value={sampleParam(layer.scrollSpeed, 0)} min={-10} max={10} step={0.1} onChange={(v) => handleParamChange('scrollSpeed', v)} />
        </Field>
      )}
      <Field label="Letter Spacing">
        <RangeInput value={sampleParam(layer.letterSpacing, 0)} min={-5} max={30} step={0.5} onChange={(v) => handleParamChange('letterSpacing', v)} />
      </Field>
      <Field label="Stroke">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={sampleParam(layer.strokeEnabled, 0)} onChange={(e) => handleParamChange('strokeEnabled', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Outline
        </label>
      </Field>
      {sampleParam(layer.strokeEnabled, 0) && (
        <>
          <Field label="Stroke Color">
            <input type="color" value={sampleParam(layer.strokeColor, 0)} onChange={(e) => handleParamChange('strokeColor', e.target.value)} />
          </Field>
          <Field label="Stroke Width">
            <RangeInput value={sampleParam(layer.strokeWidth, 0)} min={0.5} max={10} step={0.5} onChange={(v) => handleParamChange('strokeWidth', v)} />
          </Field>
        </>
      )}
    </Section>
  </>
);
