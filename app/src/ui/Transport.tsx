import React, { useCallback, useRef } from 'react';
import { useTransportStore } from '../state/transportStore';
import { useExportStore } from '../state/exportStore';
import { getAnalyzer } from './Preview';

export const Transport: React.FC = () => {
  const { playing, currentTime, duration, togglePlay, seek, play: storePlay } = useTransportStore();
  const exportStatus = useExportStore((s) => s.status);
  const exportProgress = useExportStore((s) => s.progress);
  const exportActive = exportStatus === 'analyzing' || exportStatus === 'rendering' || exportStatus === 'encoding';

  // Track whether we were playing before a scrub drag started
  const wasPlayingRef = useRef(false);

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // On drag start: pause audio so we don't restart it on every pixel of movement
  const handleSeekStart = useCallback(() => {
    if (exportActive) return;
    wasPlayingRef.current = playing;
    if (playing) getAnalyzer()?.pause();
  }, [exportActive, playing]);

  // During drag: update visual position only (no audio restart)
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (exportActive) return;
    seek(parseFloat(e.target.value));
  }, [exportActive, seek]);

  // On drag end: resume audio from the new position if we were playing
  const handleSeekEnd = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    if (exportActive) return;
    const t = parseFloat((e.target as HTMLInputElement).value);
    seek(t);
    if (wasPlayingRef.current) {
      getAnalyzer()?.play(t);
      storePlay();
    }
  }, [exportActive, seek, storePlay]);

  // Restart: always seek analyzer to 0 and play, regardless of current playing state
  const handleRestart = useCallback(() => {
    if (exportActive) return;
    seek(0);
    getAnalyzer()?.play(0);
    storePlay();
  }, [exportActive, seek, storePlay]);

  const handlePlayPause = useCallback(() => {
    if (exportActive) return;
    togglePlay();
  }, [exportActive, togglePlay]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={styles.transport}>
      <div style={styles.controls}>
        <button className="ghost" onClick={handleRestart} disabled={exportActive} style={styles.controlBtn} title="Restart">
          {'\u23EE'}
        </button>
        <button onClick={handlePlayPause} disabled={exportActive} style={styles.playBtn} title={playing ? 'Pause' : 'Play'}>
          {playing ? '\u23F8' : '\u25B6'}
        </button>
      </div>

      <div style={styles.timeDisplay}>
        <span style={styles.timeCurrent}>{formatTime(currentTime)}</span>
        <span style={styles.timeSep}>/</span>
        <span style={styles.timeDuration}>{formatTime(duration)}</span>
      </div>

      <div style={styles.seekContainer}>
        <div style={styles.seekTrack}>
          <div style={{ ...styles.seekFill, width: `${progressPct}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onPointerDown={handleSeekStart}
          onChange={handleSeek}
          onPointerUp={handleSeekEnd}
          disabled={exportActive}
          style={styles.seekInput}
        />
      </div>

      {exportStatus !== 'idle' && (
        <div style={styles.exportIndicator}>
          <span style={styles.exportLabel}>
            {exportStatus === 'done' ? 'Done' : `${Math.round(exportProgress * 100)}%`}
          </span>
          <div style={styles.exportBar}>
            <div style={{ ...styles.exportFill, width: `${exportProgress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  transport: {
    display: 'flex',
    alignItems: 'center',
    height: 52,
    padding: '0 16px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    gap: 14,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  controlBtn: {
    fontSize: 16,
    padding: '4px 8px',
    color: 'var(--text-secondary)',
    border: 'none',
  },
  playBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    boxShadow: '0 2px 8px var(--accent-glow)',
  },
  timeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    minWidth: 125,
    letterSpacing: 0.5,
  },
  timeCurrent: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  timeSep: {
    color: 'var(--text-dim)',
    margin: '0 2px',
  },
  timeDuration: {
    color: 'var(--text-muted)',
  },
  seekContainer: {
    flex: 1,
    position: 'relative',
    height: 24,
    display: 'flex',
    alignItems: 'center',
  },
  seekTrack: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 4,
    transform: 'translateY(-50%)',
    background: 'var(--bg-active)',
    borderRadius: 2,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  seekFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))',
    borderRadius: 2,
    transition: 'width 0.05s linear',
  },
  seekInput: {
    width: '100%',
    cursor: 'pointer',
    position: 'relative',
    zIndex: 1,
    background: 'transparent',
  },
  exportIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  exportLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent-bright)',
    fontFamily: 'var(--font-mono)',
  },
  exportBar: {
    width: 60,
    height: 4,
    background: 'var(--bg-active)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  exportFill: {
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.2s',
  },
};
