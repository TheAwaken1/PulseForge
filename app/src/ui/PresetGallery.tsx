import React from 'react';
import { ALL_PRESETS, type PresetTemplate } from '../presets/templates';
import { PresetManager } from '../presets/PresetManager';
import { useProjectStore } from '../state/projectStore';
import type { ShaderLayerConfig, StaticParam } from '../types/project';

interface PresetGalleryProps {
  open: boolean;
  onClose: () => void;
}

export const PresetGallery: React.FC<PresetGalleryProps> = ({ open, onClose }) => {
  if (!open) return null;

  const activePresetId = useProjectStore((s) => {
    const applied = s.project.presetsApplied;
    return applied && applied.length > 0 ? applied[applied.length - 1] : '';
  });

  const handleSelect = (presetId: string) => {
    PresetManager.applyExclusive(presetId);
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>Choose a Preset</span>
          <button className="ghost" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px' }}>
            &times;
          </button>
        </div>
        <div style={styles.grid}>
          {ALL_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={preset.id === activePresetId}
              onClick={() => handleSelect(preset.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const PresetCard: React.FC<{
  preset: PresetTemplate;
  active: boolean;
  onClick: () => void;
}> = ({ preset, active, onClick }) => {
  const colors = extractPresetColors(preset);

  return (
    <div
      className="preset-card"
      style={{
        ...styles.card,
        borderColor: active ? 'var(--accent)' : undefined,
        background: active ? 'var(--accent-dim)' : undefined,
      }}
      onClick={onClick}
    >
      <div style={styles.colorBar}>
        {colors.map((c, i) => (
          <div key={i} style={{ flex: 1, background: c, height: '100%' }} />
        ))}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardName}>{preset.name}</div>
        <div style={styles.cardDesc}>{preset.description}</div>
        <div style={styles.colorDots}>
          {colors.map((c, i) => (
            <div key={i} style={{ ...styles.dot, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Extract representative colors from a preset's layers.
 */
export function extractPresetColors(preset: PresetTemplate): string[] {
  // First try shader layers
  for (const layer of preset.layers) {
    if (layer.kind === 'shader') {
      const sl = layer as ShaderLayerConfig;
      return [
        (sl.color1 as StaticParam<string>).value,
        (sl.color2 as StaticParam<string>).value,
        (sl.color3 as StaticParam<string>).value,
      ];
    }
    if (layer.kind === 'energyRibbon') {
      const theme = (layer as any).colorTheme?.kind === 'static' ? (layer as any).colorTheme.value : 'electric';
      if (theme === 'ice') return ['#ffffff', '#b8f5ff', '#4da3ff'];
      if (theme === 'sunset') return ['#fff6f0', '#ff9a52', '#ff2e9e'];
      return ['#ffffff', '#00f3ff', '#1e54ff'];
    }
  }
  // Fallback: collect from spectrum/waveform layers
  const fallback: string[] = [];
  for (const layer of preset.layers) {
    if (layer.kind === 'radialSpectrum' && fallback.length < 3) {
      const c = (layer as any).color?.solid;
      if (c && c.kind === 'static') fallback.push(c.value);
    }
    if (layer.kind === 'radialWaveform' && fallback.length < 3) {
      const c = (layer as any).color;
      if (c && c.kind === 'static') fallback.push(c.value);
    }
    if (layer.kind === 'bottomSpectrum' && fallback.length < 3) {
      const c = (layer as any).color;
      if (c && c.kind === 'static') fallback.push(c.value);
    }
  }
  while (fallback.length < 3) fallback.push('#6c5ce7');
  return fallback;
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-xl)',
    width: '90%',
    maxWidth: 720,
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px 12px',
    borderBottom: '1px solid var(--border)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    padding: 20,
  },
  card: {
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  colorBar: {
    display: 'flex',
    height: 6,
    width: '100%',
  },
  cardBody: {
    padding: '12px 14px',
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    marginBottom: 8,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  colorDots: {
    display: 'flex',
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.1)',
  },
};
