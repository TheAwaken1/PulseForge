import React from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useSelectionStore } from '../../state/selectionStore';
import { type LayerAny, type EffectKind, staticParam, sampleParam } from '../../types/project';
import { styles } from './inspectorStyles';
import { Section, Field, RangeInput } from './SharedWidgets';
import { deepSet, formatKind } from './helpers';
import { LayerControls } from './LayerControls';
import { EffectItem, createEffectConfig } from './EffectControls';

interface InspectorProps {
  onCollapse?: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({ onCollapse }) => {
  const { project, updateLayer, addEffectToLayer, removeEffectFromLayer, updateEffect } = useProjectStore();
  const { selectedLayerId, selectedEffectId, selectEffect } = useSelectionStore();

  const layer = project.layers.find((l) => l.id === selectedLayerId);

  if (!layer) {
    return (
      <div style={styles.panel} className="scrollable">
        <div style={styles.header}>
          <span style={styles.title}>Inspector</span>
          {onCollapse && (
            <button className="ghost" onClick={onCollapse} style={{ fontSize: 13, padding: '2px 4px', lineHeight: 1 }} title="Collapse panel">
              &#x25B6;
            </button>
          )}
        </div>
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>&larr;</div>
          <div>Select a layer to inspect</div>
        </div>
      </div>
    );
  }

  const handleParamChange = (path: string, value: number | string | boolean) => {
    const updated = deepSet(layer, path, staticParam(value)) as LayerAny;
    updateLayer(layer.id, updated);
  };

  const handleDirectChange = (path: string, value: any) => {
    const updated = deepSet(layer, path, value) as LayerAny;
    updateLayer(layer.id, updated);
  };

  const handleAddEffect = (kind: EffectKind) => {
    const effect = createEffectConfig(kind);
    addEffectToLayer(layer.id, effect);
  };

  const handleAssignAsset = (assetId: string) => {
    if (layer.kind === 'background' || layer.kind === 'logo') {
      updateLayer(layer.id, { assetId } as any);
    }
  };

  const visualAssets = project.assets.filter((a) => a.type === 'image' || a.type === 'video');

  return (
    <div style={styles.panel} className="scrollable">
      <div style={styles.header}>
        <span style={styles.title}>Inspector</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={styles.headerBadge}>{formatKind(layer.kind)}</span>
          {onCollapse && (
            <button className="ghost" onClick={onCollapse} style={{ fontSize: 13, padding: '2px 4px', lineHeight: 1 }} title="Collapse panel">
              &#x25B6;
            </button>
          )}
        </div>
      </div>

      {/* Base layer properties */}
      <Section title="Layer">
        <Field label="Name">
          <input type="text" value={layer.name} onChange={(e) => updateLayer(layer.id, { name: e.target.value })} />
        </Field>
        <Field label="Opacity">
          <RangeInput value={sampleParam(layer.opacity, 0)} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('opacity', v)} />
        </Field>
        <Field label="Blend Mode">
          <select value={layer.blendMode} onChange={(e) => handleDirectChange('blendMode', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="add">Additive</option>
            <option value="screen">Screen</option>
            <option value="multiply">Multiply</option>
          </select>
        </Field>
      </Section>

      {/* Kind-specific controls */}
      <LayerControls
        layer={layer}
        imageAssets={visualAssets}
        handleAssignAsset={handleAssignAsset}
        handleParamChange={handleParamChange}
        handleDirectChange={handleDirectChange}
        updateLayer={updateLayer}
      />

      {/* Effects section */}
      <Section title="Effects">
        <select
          onChange={(e) => { if (e.target.value) handleAddEffect(e.target.value as EffectKind); e.target.value = ''; }}
          value=""
          style={{ marginBottom: 8 }}
        >
          <option value="">+ Add Effect</option>
          <optgroup label="Light & Color">
            <option value="glow">Glow</option>
            <option value="bloom">Bloom / HDR Glow</option>
            <option value="colorGrade">Color Grade</option>
            <option value="vignette">Vignette</option>
          </optgroup>
          <optgroup label="Motion & Audio">
            <option value="beatPunch">Beat Punch</option>
            <option value="pulse">Pulse</option>
            <option value="shake">Shake</option>
            <option value="strobe">Strobe</option>
          </optgroup>
          <optgroup label="Digital Style">
            <option value="pixelate">Beat Pixelate</option>
            <option value="chromaticAberration">Chromatic Aberration</option>
            <option value="blur">Blur</option>
          </optgroup>
        </select>
        {layer.effects.map((effect) => (
          <EffectItem
            key={effect.id}
            effect={effect}
            layerId={layer.id}
            selected={selectedEffectId === effect.id}
            onSelect={() => selectEffect(effect.id)}
            onRemove={() => removeEffectFromLayer(layer.id, effect.id)}
            onUpdate={(updates) => updateEffect(layer.id, effect.id, updates)}
          />
        ))}
        {layer.effects.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0' }}>
            No effects applied
          </div>
        )}
      </Section>
    </div>
  );
};
