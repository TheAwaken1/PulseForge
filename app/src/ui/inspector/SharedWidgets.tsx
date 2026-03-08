import React from 'react';
import { sectionStyles, fieldStyles } from './inspectorStyles';

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={sectionStyles.section}>
    <div style={sectionStyles.sectionTitle}>{title}</div>
    <div style={sectionStyles.sectionBody}>{children}</div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={fieldStyles.field}>
    <label style={fieldStyles.label}>{label}</label>
    <div style={fieldStyles.control}>{children}</div>
  </div>
);

export const RangeInput: React.FC<{
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}> = ({ value, min, max, step, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ flex: 1 }}
    />
    <span style={{
      fontSize: 11, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right',
      fontFamily: 'var(--font-mono)', fontWeight: 500,
    }}>
      {value.toFixed(step < 1 ? 2 : 0)}
    </span>
  </div>
);
