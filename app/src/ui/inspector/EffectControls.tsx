import React from 'react';
import {
  type AudioTarget, type EffectAny, type EffectKind, staticParam, sampleParam, createEffectId,
} from '../../types/project';
import { Section, Field, RangeInput } from './SharedWidgets';
import { AUDIO_TARGET_OPTIONS } from '../../audio/reactivity';

export function createEffectConfig(kind: EffectKind): EffectAny {
  const id = createEffectId();
  switch (kind) {
    case 'glow':
      return { id, name: 'Glow', kind: 'glow', enabled: true, distance: staticParam(15), outerStrength: staticParam(2), color: staticParam('#6c5ce7'), quality: staticParam(4) };
    case 'shake':
      return { id, name: 'Shake', kind: 'shake', enabled: true, amountPx: staticParam(3), amountRot: staticParam(0.01), speed: staticParam(8), audioDriven: true, audioAmount: staticParam(2), audioTarget: 'full' };
    case 'pulse':
      return { id, name: 'Pulse', kind: 'pulse', enabled: true, baseScaleAdd: staticParam(0), audioAmount: staticParam(0.15), smoothing: staticParam(0.3), audioTarget: 'full' };
    case 'strobe':
      return { id, name: 'Strobe', kind: 'strobe', enabled: true, rateHz: staticParam(4), dutyCycle: staticParam(0.5), softEdge: staticParam(0.1) };
    case 'blur':
      return { id, name: 'Blur', kind: 'blur', enabled: true, blur: staticParam(4), quality: staticParam(4) };
    case 'chromaticAberration':
      return { id, name: 'Chromatic Aberration', kind: 'chromaticAberration', enabled: true, amountPx: staticParam(3), angle: staticParam(0), audioDriven: false, audioTarget: 'full' };
    case 'vignette':
      return { id, name: 'Vignette', kind: 'vignette', enabled: true, strength: staticParam(0.5), radius: staticParam(0.5) };
    case 'gradientMap':
      return { id, name: 'Gradient Map', kind: 'gradientMap', enabled: true, stops: staticParam([{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }]) };
    case 'bloom':
      return { id, name: 'Bloom', kind: 'bloom', enabled: true, threshold: staticParam(0.35), strength: staticParam(1.8), radius: staticParam(5), softKnee: staticParam(0.5), toneMap: true, audioDriven: true, audioAmount: staticParam(0.6), audioTarget: 'full' };
    case 'colorGrade':
      return { id, name: 'Color Grade', kind: 'colorGrade', enabled: true, hue: staticParam(0), saturation: staticParam(0.15), contrast: staticParam(0.58), brightness: staticParam(1), audioDriven: false, audioAmount: staticParam(90), audioTarget: 'full' };
    case 'pixelate':
      return { id, name: 'Beat Pixelate', kind: 'pixelate', enabled: true, pixelSize: staticParam(6), mix: staticParam(1), audioDriven: true, audioAmount: staticParam(18), audioTarget: 'beat' };
    case 'beatPunch':
      return { id, name: 'Beat Punch', kind: 'beatPunch', enabled: true, zoomAmount: staticParam(0.1), rotationDeg: staticParam(1.5), positionPx: staticParam(6), decayMs: staticParam(180) };
    default:
      throw new Error(`Unknown effect kind: ${kind}`);
  }
}

export const EffectItem: React.FC<{
  effect: EffectAny; layerId: string; selected: boolean;
  onSelect: () => void; onRemove: () => void; onUpdate: (updates: Partial<EffectAny>) => void;
}> = ({ effect, selected, onSelect, onRemove, onUpdate }) => (
  <div
    style={{
      padding: '8px 10px',
      background: selected ? 'var(--accent-dim)' : 'var(--bg-input)',
      borderRadius: 'var(--radius)',
      marginBottom: 4,
      cursor: 'pointer',
      border: selected ? '1px solid var(--accent-glow)' : '1px solid transparent',
      transition: 'all 0.1s',
    }}
    onClick={onSelect}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{effect.name}</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="ghost"
          style={{
            padding: '2px 6px', fontSize: 10, fontWeight: 600,
            color: effect.enabled ? 'var(--success)' : 'var(--text-dim)',
            border: 'none',
          }}
          onClick={(e) => { e.stopPropagation(); onUpdate({ enabled: !effect.enabled } as any); }}
        >
          {effect.enabled ? 'ON' : 'OFF'}
        </button>
        <button
          className="ghost danger"
          style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: 'none' }}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          &times;
        </button>
      </div>
    </div>
    {selected && <div style={{ marginTop: 8 }}><EffectControlsPanel effect={effect} onUpdate={onUpdate} /></div>}
  </div>
);

const EffectControlsPanel: React.FC<{
  effect: EffectAny; onUpdate: (updates: Partial<EffectAny>) => void;
}> = ({ effect, onUpdate }) => {
  const paramField = (label: string, key: string, min: number, max: number, step: number) => {
    const val = sampleParam((effect as any)[key], 0) as number;
    return (
      <Field label={label} key={key}>
        <RangeInput value={val} min={min} max={max} step={step} onChange={(v) => onUpdate({ [key]: staticParam(v) } as any)} />
      </Field>
    );
  };

  const audioTargetField = () => (
    <Field label="Audio Source">
      <select
        value={((effect as any).audioTarget ?? 'full') as AudioTarget}
        onChange={(event) => onUpdate({ audioTarget: event.target.value as AudioTarget } as any)}
      >
        {AUDIO_TARGET_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );

  const audioDrivenField = (label: string) => (
    <Field label="Audio Driven">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={(effect as any).audioDriven} onChange={(event) => onUpdate({ audioDriven: event.target.checked } as any)} style={{ accentColor: 'var(--accent)' }} />
        {label}
      </label>
    </Field>
  );

  switch (effect.kind) {
    case 'glow':
      return <>{paramField('Distance', 'distance', 0, 50, 1)}{paramField('Quality', 'quality', 1, 10, 1)}</>;
    case 'shake':
      return <>{paramField('Amount (px)', 'amountPx', 0, 30, 1)}{paramField('Rotation', 'amountRot', 0, 0.1, 0.005)}{paramField('Speed', 'speed', 1, 20, 1)}{audioDrivenField('React to audio')}{(effect as any).audioDriven && <>{audioTargetField()}{paramField('Audio Amount', 'audioAmount', 0, 5, 0.05)}</>}</>;
    case 'pulse':
      return <>{audioTargetField()}{paramField('Audio Amount', 'audioAmount', 0, 1, 0.01)}{paramField('Smoothing', 'smoothing', 0.01, 1, 0.01)}</>;
    case 'strobe':
      return <>{paramField('Rate (Hz)', 'rateHz', 0.5, 20, 0.5)}{paramField('Duty Cycle', 'dutyCycle', 0, 1, 0.05)}</>;
    case 'blur':
      return <>{paramField('Blur', 'blur', 0, 30, 1)}</>;
    case 'chromaticAberration':
      return <>{paramField('Amount (px)', 'amountPx', 0, 20, 0.5)}{audioDrivenField('React to audio')}{(effect as any).audioDriven && audioTargetField()}</>;
    case 'vignette':
      return <>{paramField('Strength', 'strength', 0, 1, 0.05)}{paramField('Radius', 'radius', 0, 1, 0.05)}</>;
    case 'bloom':
      return (
        <>
          {paramField('Threshold', 'threshold', 0, 1, 0.02)}
          {paramField('Strength', 'strength', 0, 4, 0.1)}
          {paramField('Radius (px)', 'radius', 1, 20, 0.5)}
          {paramField('Soft Knee', 'softKnee', 0, 1, 0.05)}
          <Field label="Tone Map">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={(effect as any).toneMap} onChange={(e) => onUpdate({ toneMap: e.target.checked } as any)} style={{ accentColor: 'var(--accent)' }} />
              Reinhard Tone Map
            </label>
          </Field>
          {audioDrivenField('React to audio')}
          {(effect as any).audioDriven && <>{audioTargetField()}{paramField('Audio Amount', 'audioAmount', 0, 2, 0.05)}</>}
        </>
      );
    case 'colorGrade':
      return (
        <>
          {paramField('Hue', 'hue', -180, 180, 1)}
          {paramField('Saturation', 'saturation', -1, 1, 0.05)}
          {paramField('Contrast', 'contrast', 0, 1, 0.02)}
          {paramField('Brightness', 'brightness', 0.25, 2, 0.05)}
          {audioDrivenField('Animate hue from audio')}
          {(effect as any).audioDriven && <>{audioTargetField()}{paramField('Audio Range', 'audioAmount', 0, 360, 5)}</>}
        </>
      );
    case 'pixelate':
      return (
        <>
          {paramField('Pixel Size', 'pixelSize', 1, 64, 1)}
          {paramField('Mix', 'mix', 0, 1, 0.05)}
          {audioDrivenField('React to audio')}
          {(effect as any).audioDriven && <>{audioTargetField()}{paramField('Audio Boost', 'audioAmount', 0, 64, 1)}</>}
        </>
      );
    case 'beatPunch':
      return <>{paramField('Zoom', 'zoomAmount', 0, 0.4, 0.01)}{paramField('Rotation (deg)', 'rotationDeg', 0, 12, 0.25)}{paramField('Position (px)', 'positionPx', 0, 40, 1)}{paramField('Decay (ms)', 'decayMs', 60, 800, 10)}</>;
    default:
      return null;
  }
};
