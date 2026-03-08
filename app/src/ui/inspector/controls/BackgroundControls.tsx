import React from 'react';
import type { BackgroundLayerConfig, Asset } from '../../../types/project';
import { Section, Field } from '../SharedWidgets';

interface Props {
  layer: BackgroundLayerConfig;
  imageAssets: Asset[];
  handleAssignAsset: (assetId: string) => void;
  handleDirectChange: (path: string, value: any) => void;
}

export const BackgroundControls: React.FC<Props> = ({ layer, imageAssets, handleAssignAsset, handleDirectChange }) => (
  <Section title="Asset">
    <Field label="Image">
      <select
        value={layer.assetId || ''}
        onChange={(e) => handleAssignAsset(e.target.value)}
      >
        <option value="">None</option>
        {imageAssets.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
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
  </Section>
);
