import type React from 'react';

export const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 290,
    minWidth: 270,
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--text-muted)',
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    background: 'var(--accent-dim)',
    color: 'var(--accent-bright)',
    textTransform: 'capitalize',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  emptyIcon: {
    fontSize: 22,
    color: 'var(--text-dim)',
    marginBottom: 8,
  },
};

export const sectionStyles: Record<string, React.CSSProperties> = {
  section: {
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    padding: '10px 14px 4px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--text-dim)',
  },
  sectionBody: {
    padding: '6px 14px 12px',
  },
};

export const fieldStyles: Record<string, React.CSSProperties> = {
  field: {
    marginBottom: 8,
  },
  label: {
    display: 'block',
    marginBottom: 4,
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 500,
    letterSpacing: 0.3,
  },
  control: {
    width: '100%',
  },
};
