import React from 'react';
import { sampleParam, type BackgroundLayerConfig, type Asset } from '../../../types/project';
import { Section, Field, RangeInput } from '../SharedWidgets';

interface Props {
  layer: BackgroundLayerConfig;
  imageAssets: Asset[];
  handleAssignAsset: (assetId: string) => void;
  handleParamChange: (path: string, value: number | string | boolean) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const BackgroundControls: React.FC<Props> = ({ layer, imageAssets, handleAssignAsset, handleParamChange, handleDirectChange }) => (
  <Section title="Asset">
    <Field label="Background media">
      <select
        value={layer.assetId || ''}
        onChange={(e) => handleAssignAsset(e.target.value)}
      >
        <option value="">None</option>
        {imageAssets.map((a) => (
          <option key={a.id} value={a.id}>{a.name}{a.type === 'video' || a.metadata?.animated ? ' · animated' : ''}</option>
        ))}
      </select>
    </Field>
    <Field label="Fit">
      <select
        value={layer.fit}
        onChange={(e) => handleDirectChange('fit', e.target.value)}
      >
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
        <option value="stretch">Stretch</option>
      </select>
    </Field>
    <Field label="Darkness">
      <RangeInput
        value={layer.darkness ? sampleParam(layer.darkness, 0) : 0}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) => handleParamChange('darkness', value)}
      />
    </Field>
  </Section>
);
