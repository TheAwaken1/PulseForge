import React from 'react';

interface PanelCollapseButtonProps {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}

export const PanelCollapseButton: React.FC<PanelCollapseButtonProps> = ({ side, label, onClick }) => (
  <div
    style={{
      width: 28,
      minWidth: 28,
      height: '100%',
      background: 'var(--bg-panel)',
      borderRight: side === 'left' ? '1px solid var(--border)' : 'none',
      borderLeft: side === 'right' ? '1px solid var(--border)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'background 0.15s ease',
    }}
    onClick={onClick}
    title={`Show ${label}`}
    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-panel)'; }}
  >
    <span style={{
      writingMode: 'vertical-rl',
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--text-muted)',
      letterSpacing: 1,
      textTransform: 'uppercase',
      userSelect: 'none',
    }}>
      {label}
    </span>
  </div>
);
