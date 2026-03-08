import React, { useRef, useEffect, useState, useCallback } from 'react';
// Canvas layout is applied imperatively (not via React state) to bypass React's
// style-diffing, which would skip re-applying properties that haven't changed in
// the JS object even though PixiJS has already overwritten them on the DOM.
import { PixiApp } from '../renderer/PixiApp';

// Preview is always rendered at this fixed resolution regardless of project export resolution.
// This prevents layers from shifting when the user changes export resolution.
const PREVIEW_WIDTH = 1920;
const PREVIEW_HEIGHT = 1080;
import { RealtimeAnalyzer } from '../audio/RealtimeAnalyzer';
import { useProjectStore } from '../state/projectStore';
import { useTransportStore } from '../state/transportStore';
import { useExportStore } from '../state/exportStore';
import { emptyAudioFrame } from '../types/audio';
import { importAudioFile, importImageFile } from '../utils/audioImport';

// Singleton instances surviving across renders
let pixiApp: PixiApp | null = null;
let analyzer: RealtimeAnalyzer | null = null;

export function getAnalyzer(): RealtimeAnalyzer | null { return analyzer; }
export function getPixiApp(): PixiApp | null { return pixiApp; }

export const Preview: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const initedRef = useRef(false);

  // Use refs to avoid re-creating the render loop on every state change
  const projectRef = useRef(useProjectStore.getState().project);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const [resDebug, setResDebug] = useState(false);
  const [rendererSize, setRendererSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const rendererSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const exportActiveRef = useRef(false);
  const frozenCapturedRef = useRef(false);
  const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
  const [showExportOverlay, setShowExportOverlay] = useState(false);

  // Keep refs in sync with store (subscription, not useEffect deps)
  useEffect(() => {
    const unsub1 = useProjectStore.subscribe((s) => { projectRef.current = s.project; });
    const unsub2 = useTransportStore.subscribe((s) => {
      playingRef.current = s.playing;
      timeRef.current = s.currentTime;
    });
    const unsub3 = useExportStore.subscribe((s) => {
      const active = s.status === 'analyzing' || s.status === 'rendering' || s.status === 'encoding';
      const wasActive = exportActiveRef.current;
      exportActiveRef.current = active;

      if (active) {
        setShowExportOverlay(true);
        if (!frozenCapturedRef.current) {
          frozenCapturedRef.current = true;
          try {
            // Use PixiJS extract to capture the current stage content.
            // canvas.toDataURL() on a WebGL canvas without preserveDrawingBuffer
            // returns a blank image because the drawing buffer is cleared after
            // each frame. getSnapshotCanvas() does a dedicated render pass to a
            // fresh canvas that is always readable.
            const snap = pixiApp?.getSnapshotCanvas();
            setFrozenFrameUrl(snap ? snap.toDataURL('image/png') : null);
          } catch {
            setFrozenFrameUrl(null);
          }
        }
      } else if (wasActive) {
        // Export just finished. exportActiveRef is already false so the render
        // loop will resume on the very next rAF tick. Delay hiding the overlay
        // by one frame so the canvas renders fresh content before it is revealed,
        // preventing a momentary white flash caused by WebGL context recovery or
        // GPU state settling after the 4K offscreen renderer is torn down.
        frozenCapturedRef.current = false;
        requestAnimationFrame(() => {
          setFrozenFrameUrl(null);
          setShowExportOverlay(false);
        });
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    const read = () => setResDebug(localStorage.getItem('pulseforge.debugResolution') === '1');
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      if (typeof ce.detail === 'boolean') setResDebug(ce.detail);
      else read();
    };
    read();
    window.addEventListener('pulseforge-debug-resolution', onToggle as EventListener);
    return () => window.removeEventListener('pulseforge-debug-resolution', onToggle as EventListener);
  }, []);

  // Initialize Pixi + audio once
  useEffect(() => {
    if (initedRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    initedRef.current = true;

    const setup = async () => {
      pixiApp = new PixiApp({ canvas, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, backgroundColor: 0x0c0c14, resolution: 1 });
      await pixiApp.init();
      fitPreviewCanvas();
      analyzer = new RealtimeAnalyzer();

      // When textures finish loading, re-sync layers so sprites appear
      pixiApp.resources.onTextureLoaded(() => {
        if (pixiApp) pixiApp.syncLayers(projectRef.current.layers);
      });

      // Start render loop
      startLoop();
    };

    setup();

    // Resize observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          fitPreviewCanvas();
        }
      }
    });
    if (container) observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      if (pixiApp) { pixiApp.destroy(); pixiApp = null; }
      if (analyzer) { analyzer.dispose(); analyzer = null; }
      initedRef.current = false;
    };
  }, []);

  function fitPreviewCanvas() {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const containerW = Math.max(1, rect.width);
    const containerH = Math.max(1, rect.height);
    const aspect = PREVIEW_WIDTH / PREVIEW_HEIGHT;

    let displayW = containerW;
    let displayH = displayW / aspect;
    if (displayH > containerH) {
      displayH = containerH;
      displayW = displayH * aspect;
    }

    const w = Math.max(1, Math.floor(displayW));
    const h = Math.max(1, Math.floor(displayH));
    const left = Math.floor((containerW - displayW) / 2);
    const top = Math.floor((containerH - displayH) / 2);

    // Apply directly to the DOM element rather than via React setState.
    // React's style diffing would skip re-applying properties whose JS values
    // haven't changed, even though PixiJS's autoDensity resize has already
    // overwritten them on the DOM (e.g. canvas.style.width = '3840px').
    // Direct assignment always wins over any stale PixiJS inline style.
    canvas.style.position = 'absolute';
    canvas.style.display = 'block';
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
  }

  function startLoop() {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!pixiApp?.isReady) return;
      if (exportActiveRef.current) return;

      const project = projectRef.current;
      let t: number;
      let audioFrame;

      if (playingRef.current && analyzer?.isPlaying) {
        t = analyzer.getCurrentTime();
        audioFrame = analyzer.getFrame();
        // Update store time (batched by React)
        useTransportStore.getState().setCurrentTime(t);

        if (analyzer.duration > 0 && t >= analyzer.duration) {
          useTransportStore.getState().pause();
          return;
        }
      } else {
        t = timeRef.current;
        audioFrame = emptyAudioFrame();
      }

      pixiApp.syncLayers(project.layers);
      pixiApp.renderFrame(t, audioFrame, project.layers);
      if (resDebug) {
        const next = { w: Math.round(pixiApp.width), h: Math.round(pixiApp.height) };
        const prev = rendererSizeRef.current;
        if (next.w !== prev.w || next.h !== prev.h) {
          rendererSizeRef.current = next;
          setRendererSize(next);
        }
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  // Load audio when audio asset changes
  const project = useProjectStore((s) => s.project);
  useEffect(() => {
    const audioAsset = project.assets.find((a) => a.id === project.audio.assetId);
    if (!audioAsset || !analyzer) return;
    analyzer.loadAudio(audioAsset.relPath).then((dur) => {
      useTransportStore.getState().setDuration(dur);
    }).catch((e) => console.warn('Audio load failed:', e));
  }, [project.audio.assetId]);

  // Load textures when image assets change
  useEffect(() => {
    if (!pixiApp?.isReady) return;
    const imageAssets = project.assets.filter((a) => a.type === 'image');
    for (const asset of imageAssets) {
      if (!pixiApp.resources.hasTexture(asset.id)) {
        pixiApp.resources.registerUrl(asset.id, asset.relPath);
        pixiApp.resources.loadTexture(asset.id).catch((e) => console.warn('Texture load failed:', e));
      }
    }
  }, [project.assets]);

  // Handle play/pause
  const playing = useTransportStore((s) => s.playing);
  useEffect(() => {
    if (!analyzer) return;
    if (playing) {
      analyzer.play(timeRef.current);
    } else {
      analyzer.pause();
    }
  }, [playing]);

  // Volume control
  const [volume, setVolume] = useState<number>(() =>
    parseFloat(localStorage.getItem('pulseforge.volume') ?? '1'),
  );
  const volumeRef = useRef(volume);
  const handleVolumeChange = useCallback((val: number) => {
    volumeRef.current = val;
    setVolume(val);
    localStorage.setItem('pulseforge.volume', String(val));
    analyzer?.setVolume(val);
  }, []);

  // Apply saved volume whenever a new audio file is loaded
  useEffect(() => {
    analyzer?.setVolume(volumeRef.current);
  }, [project.audio.assetId]);

  // Drag-and-drop for audio/image files
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        await importAudioFile(file);
      } else if (file.type.startsWith('image/')) {
        importImageFile(file);
      }
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={styles.container}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />
      {showExportOverlay && (
        <div style={styles.exportOverlay}>
          {frozenFrameUrl && <img src={frozenFrameUrl} alt="Frozen preview" style={styles.exportFrozenImage} />}
          <div style={styles.exportOverlayTint} />
          <div style={styles.exportOverlayLabel}>
            <div style={styles.exportTitle}>Exporting</div>
            <div style={styles.exportSub}>Preview is frozen while offline render runs</div>
          </div>
        </div>
      )}
      <div style={styles.volumeControl}>
        <span style={styles.volumeIcon}>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          style={styles.volumeSlider}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        {(() => {
          const audioAsset = project.assets.find((a) => a.id === project.audio.assetId);
          return audioAsset ? (
            <span style={styles.audioName} title={audioAsset.name}>{audioAsset.name}</span>
          ) : null;
        })()}
      </div>
      {dragOver && (
        <div style={styles.dropOverlay}>
          <div style={styles.dropLabel}>Drop audio or image file</div>
        </div>
      )}
      {resDebug && (
        <div style={styles.debugHud}>
          Preview: {rendererSize.w}x{rendererSize.h} | Export: {project.resolution.width}x{project.resolution.height}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#0c0c14',
    borderRadius: 0,
  },
  dropOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(108, 92, 231, 0.15)',
    border: '3px dashed var(--accent)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  dropLabel: {
    color: 'var(--accent-bright)',
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 24px',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 'var(--radius-lg)',
  },
  debugHud: {
    position: 'absolute',
    left: 10,
    top: 10,
    background: 'rgba(0,0,0,0.72)',
    color: '#9cff9c',
    border: '1px solid rgba(156,255,156,0.45)',
    borderRadius: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    padding: '4px 8px',
    pointerEvents: 'none',
    zIndex: 5,
  },
  exportOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  exportFrozenImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#0c0c14',
  },
  exportOverlayTint: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10, 12, 20, 0.62)',
    backdropFilter: 'blur(2px)',
  },
  exportOverlayLabel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#f2f4ff',
    textAlign: 'center',
  },
  exportTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  exportSub: {
    fontSize: 13,
    opacity: 0.85,
    fontFamily: 'var(--font-mono)',
  },
  volumeControl: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(12, 12, 20, 0.72)',
    borderRadius: 20,
    padding: '4px 10px',
    zIndex: 5,
    backdropFilter: 'blur(4px)',
  },
  volumeIcon: {
    fontSize: 14,
    lineHeight: 1,
    userSelect: 'none',
  },
  volumeSlider: {
    width: 80,
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
  audioName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'var(--font-mono)',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderLeft: '1px solid rgba(255,255,255,0.15)',
    paddingLeft: 8,
  },
};
