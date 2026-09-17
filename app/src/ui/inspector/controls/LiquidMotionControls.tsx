import React from 'react';
import { sampleParam, staticParam, type Param } from '../../../types/project';
import { Field, RangeInput } from '../SharedWidgets';

interface Props {
  enabled?: boolean;
  amount?: Param<number>;
  speed?: Param<number>;
  handleParamChange: (path: string, value: number | string | boolean) => void;
}

export const LiquidMotionControls: React.FC<Props> = ({
  enabled = false,
  amount,
  speed,
  handleParamChange,
}) => (
  <>
    <Field label="Liquid Motion">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => handleParamChange('liquidMotion', event.target.checked)}
        style={{ accentColor: 'var(--accent)' }}
      />
    </Field>
    {enabled && (
      <>
        <Field label="Liquid Amount">
          <RangeInput value={sampleParam(amount ?? staticParam(0.65), 0)} min={0} max={1.5} step={0.05} onChange={(value) => handleParamChange('liquidAmount', value)} />
        </Field>
        <Field label="Liquid Speed">
          <RangeInput value={sampleParam(speed ?? staticParam(1), 0)} min={0.1} max={3} step={0.05} onChange={(value) => handleParamChange('liquidSpeed', value)} />
        </Field>
      </>
    )}
  </>
);
