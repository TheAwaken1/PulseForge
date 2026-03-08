import React from 'react';
import { sampleParam, staticParam, type LogoLayerConfig, type LogoFrameShape, type LayerAny, type Asset } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: LogoLayerConfig;
  imageAssets: Asset[];
  handleAssignAsset: (assetId: string) => void;
  updateLayer: (id: string, updates: Partial<LayerAny>) => void;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const LogoControls: React.FC<Props> = ({ layer, imageAssets, handleAssignAsset, updateLayer, handleParamChange, handleDirectChange }) => {
  const frameSize = sampleParam(layer.frameSize, 0);
  const padding = sampleParam(layer.padding, 0);
  const cornerRadius = sampleParam(layer.cornerRadius, 0);
  const borderWidth = sampleParam(layer.border.width, 0);
  const borderColor = sampleParam(layer.border.color, 0) as string;

  const handleRefit = () => {
    updateLayer(layer.id, { _refitSeq: (layer._refitSeq ?? 0) + 1 } as any);
  };

  return (
    <>
      <Section title="Asset">
        <Field label="Image">
          <select value={layer.assetId || ''} onChange={(e) => handleAssignAsset(e.target.value)}>
            <option value="">None</option>
            {imageAssets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Logo Frame">
        <Field label="Frame Shape">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['none', 'circle', 'square', 'rounded'] as LogoFrameShape[]).map((shape) => (
              <button
                key={shape}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11,
                  fontWeight: layer.frameShape === shape ? 600 : 400,
                  background: layer.frameShape === shape ? 'var(--accent)' : 'var(--bg-input)',
                  color: layer.frameShape === shape ? '#fff' : 'var(--text-secondary)',
                  border: layer.frameShape === shape ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)', textTransform: 'capitalize',
                }}
                onClick={() => handleDirectChange('frameShape', shape)}
              >
                {shape}
              </button>
            ))}
          </div>
        </Field>
        {layer.frameShape === 'rounded' && (
          <Field label="Corner Radius">
            <RangeInput value={cornerRadius} min={0} max={200} step={1} onChange={(v) => handleParamChange('cornerRadius', v)} />
          </Field>
        )}
        {layer.frameShape !== 'none' && <Field label="Fit Mode">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['fill', 'cover', 'contain'] as const).map((mode) => (
              <button
                key={mode}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11,
                  fontWeight: layer.fitMode === mode ? 600 : 400,
                  background: layer.fitMode === mode ? 'var(--accent)' : 'var(--bg-input)',
                  color: layer.fitMode === mode ? '#fff' : 'var(--text-secondary)',
                  border: layer.fitMode === mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)', textTransform: 'capitalize',
                }}
                onClick={() => handleDirectChange('fitMode', mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </Field>}
        <Field label="Frame Size">
          <RangeInput value={frameSize} min={50} max={800} step={1} onChange={(v) => handleParamChange('frameSize', v)} />
        </Field>
        <Field label="Padding">
          <RangeInput value={padding} min={0} max={100} step={1} onChange={(v) => handleParamChange('padding', v)} />
        </Field>
        <Field label="Auto-fit on Import">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={layer.autoFitOnImport} onChange={(e) => handleDirectChange('autoFitOnImport', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Enabled
          </label>
        </Field>
        <button className="primary" style={{ width: '100%', marginTop: 4, fontSize: 11, padding: '6px 0' }} onClick={handleRefit}>
          Re-Fit to Frame
        </button>
      </Section>

      <Section title="Border">
        <Field label="Enabled">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={layer.border.enabled} onChange={(e) => updateLayer(layer.id, { border: { ...layer.border, enabled: e.target.checked } } as any)} style={{ accentColor: 'var(--accent)' }} />
            Show Border
          </label>
        </Field>
        {layer.border.enabled && (
          <>
            <Field label="Width">
              <RangeInput value={borderWidth as number} min={1} max={20} step={0.5} onChange={(v) => updateLayer(layer.id, { border: { ...layer.border, width: staticParam(v) } } as any)} />
            </Field>
            <Field label="Color">
              <input type="color" value={borderColor} onChange={(e) => updateLayer(layer.id, { border: { ...layer.border, color: staticParam(e.target.value) } } as any)} />
            </Field>
            <Field label="Glow">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={layer.border.glow} onChange={(e) => updateLayer(layer.id, { border: { ...layer.border, glow: e.target.checked } } as any)} style={{ accentColor: 'var(--accent)' }} />
                Neon Glow
              </label>
            </Field>
          </>
        )}
      </Section>
    </>
  );
};
