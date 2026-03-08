import React, { useRef, useState } from 'react';
import { ALL_PRESETS, type PresetTemplate } from '../presets/templates';
import { PresetManager } from '../presets/PresetManager';
import { importAudioFile } from '../utils/audioImport';
import { extractPresetColors } from './PresetGallery';

type Step = 'choose' | 'audio' | 'presets';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export const WelcomeOverlay: React.FC<Props> = ({ visible, onDismiss }) => {
  const [step, setStep] = useState<Step>('choose');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        await importAudioFile(file);
        onDismiss();
        return;
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAudioFile(file);
    e.target.value = '';
    onDismiss();
  };

  const handlePreset = (presetId: string) => {
    PresetManager.applyExclusive(presetId);
    onDismiss();
  };

  return (
    <div style={styles.overlay}>
      {step === 'choose' && (
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>P</div>
            <span style={styles.logoText}>PulseForge</span>
          </div>
          <h2 style={styles.heading}>How do you want to start?</h2>
          <p style={styles.subtitle}>Choose your starting point</p>

          <div style={styles.choiceRow}>
            <button
              style={styles.choiceCard}
              className="welcome-choice-card"
              onClick={() => setStep('audio')}
            >
              <div style={styles.choiceIcon}>♫</div>
              <div style={styles.choiceTitle}>Load Audio</div>
              <div style={styles.choiceDesc}>Import an audio file and build a custom visualization</div>
            </button>

            <button
              style={styles.choiceCard}
              className="welcome-choice-card"
              onClick={() => setStep('presets')}
            >
              <div style={styles.choiceIcon}>⬛</div>
              <div style={styles.choiceTitle}>Browse Presets</div>
              <div style={styles.choiceDesc}>Start from a ready-made visual template</div>
            </button>
          </div>

          <div style={styles.footer}>
            <span style={styles.footerText}>
              Space to play &middot; Ctrl+Z to undo &middot; Ctrl+S to save
            </span>
          </div>
        </div>
      )}

      {step === 'audio' && (
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => setStep('choose')}>
            ← Back
          </button>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>♫</div>
            <span style={styles.logoText}>Load Audio</span>
          </div>
          <h2 style={styles.heading}>Drop your audio file</h2>
          <p style={styles.subtitle}>MP3, WAV, OGG, FLAC supported</p>

          <div
            className={`welcome-dropzone${dragActive ? ' drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={styles.dropIcon}>&#9835;</div>
            <div style={styles.dropText}>
              {dragActive ? 'Drop your audio file' : 'Drag & drop audio file here'}
            </div>
            <div style={styles.dropHint}>or click to browse</div>
            <div style={styles.dropFormats}>MP3 &middot; WAV &middot; OGG &middot; FLAC</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          <div style={styles.footer}>
            <span style={styles.footerText}>You can add more audio later from the toolbar</span>
          </div>
        </div>
      )}

      {step === 'presets' && (
        <div style={{ ...styles.card, maxWidth: 700 }}>
          <button style={styles.backBtn} onClick={() => setStep('choose')}>
            ← Back
          </button>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>P</div>
            <span style={styles.logoText}>Choose a Preset</span>
          </div>
          <h2 style={styles.heading}>Pick a visual template</h2>
          <p style={styles.subtitle}>You can customize everything after selecting</p>

          <div style={styles.presetsGrid}>
            {ALL_PRESETS.map((preset) => (
              <PresetMiniCard
                key={preset.id}
                preset={preset}
                onClick={() => handlePreset(preset.id)}
              />
            ))}
          </div>

          <div style={styles.footer}>
            <span style={styles.footerText}>Load audio anytime from the toolbar after selecting a preset</span>
          </div>
        </div>
      )}
    </div>
  );
};

const PresetMiniCard: React.FC<{
  preset: PresetTemplate;
  onClick: () => void;
}> = ({ preset, onClick }) => {
  const colors = extractPresetColors(preset);

  return (
    <div className="preset-card" style={styles.miniCard} onClick={onClick}>
      <div style={styles.miniColorBar}>
        {colors.map((c, i) => (
          <div key={i} style={{ flex: 1, background: c, height: '100%' }} />
        ))}
      </div>
      <div style={styles.miniBody}>
        <div style={styles.miniName}>{preset.name}</div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: 18,
    padding: '36px 40px',
    width: '92%',
    maxWidth: 560,
    maxHeight: '92vh',
    overflow: 'auto',
    boxShadow: '0 28px 90px rgba(0,0,0,0.7)',
    textAlign: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 18,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    letterSpacing: 0.3,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  logoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), #a29bfe)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 20,
    color: 'var(--text-primary)',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: '0 0 28px',
  },
  choiceRow: {
    display: 'flex',
    gap: 16,
    marginBottom: 24,
  },
  choiceCard: {
    flex: 1,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    borderRadius: 14,
    padding: '28px 20px',
    cursor: 'pointer',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    transition: 'all 0.15s ease',
  },
  choiceIcon: {
    fontSize: 36,
    lineHeight: 1,
    marginBottom: 4,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  choiceDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  dropIcon: {
    fontSize: 36,
    color: 'var(--accent-bright)',
    marginBottom: 10,
  },
  dropText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  dropHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginBottom: 8,
  },
  dropFormats: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 10,
    marginBottom: 20,
    textAlign: 'left',
  },
  miniCard: {
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    transition: 'all 0.15s ease',
  },
  miniColorBar: {
    display: 'flex',
    height: 5,
    width: '100%',
  },
  miniBody: {
    padding: '8px 10px',
  },
  miniName: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    paddingTop: 10,
    borderTop: '1px solid var(--border)',
  },
  footerText: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 0.3,
  },
};
