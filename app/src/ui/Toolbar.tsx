import React, { useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useExportStore } from '../state/exportStore';
import { useTransportStore } from '../state/transportStore';
import { saveProject, loadProjectWithPath } from '../project/persistence';
import { createDefaultProject, type Project } from '../types/project';
import {
  ExportOrchestrator,
  estimateExportFileSizeBytes,
  downloadVideoBlob,
  downloadVideoUrl,
  type ExportQualityMode,
} from '../export/ExportOrchestrator';
import { importAudioFile, importVisualFileToLayer } from '../utils/audioImport';
import { useHistoryStore } from '../state/historyStore';
import { PresetGallery } from './PresetGallery';

/**
 * Export resolution presets. All 16:9 so layer layout stays identical to the
 * 1920x1080 preview; layers scale proportionally at export time.
 */
const EXPORT_RESOLUTIONS = [
  { id: '720p', label: '720p HD (1280 x 720)', width: 1280, height: 720 },
  { id: '1080p', label: '1080p Full HD (1920 x 1080)', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p 2K (2560 x 1440)', width: 2560, height: 1440 },
  { id: '2160p', label: '2160p 4K (3840 x 2160)', width: 3840, height: 2160 },
] as const;
type ExportResolutionId = (typeof EXPORT_RESOLUTIONS)[number]['id'];
const DEFAULT_RESOLUTION_ID: ExportResolutionId = '1080p';

function resolutionById(id: string): (typeof EXPORT_RESOLUTIONS)[number] {
  return EXPORT_RESOLUTIONS.find((r) => r.id === id) ?? EXPORT_RESOLUTIONS[1];
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

interface ToolbarProps {
  onQuickCreate?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onQuickCreate }) => {
  const { project, setProject, setProjectPath, projectPath, dirty, markClean } = useProjectStore();
  const exportStore = useExportStore();
  const { canUndo, canRedo, undo, redo, clearHistory } = useHistoryStore();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const visualInputRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const exportRef = useRef<ExportOrchestrator | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFps, setExportFps] = useState<number>(() => {
    const saved = Number(localStorage.getItem('pulseforge.export.fps') || 60);
    return Number.isFinite(saved) && saved > 0 ? Math.round(saved) : 60;
  });
  const [exportMode, setExportMode] = useState<ExportQualityMode>(() => {
    const saved = localStorage.getItem('pulseforge.export.mode');
    return saved === 'crisp' ? 'crisp' : 'compatibility';
  });
  const [exportResolutionId, setExportResolutionId] = useState<ExportResolutionId>(() => {
    const saved = localStorage.getItem('pulseforge.export.resolution') || DEFAULT_RESOLUTION_ID;
    return resolutionById(saved).id;
  });
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    const saved = localStorage.getItem('pulseforge.export.autoDownload');
    return saved === null ? true : saved === 'true';
  });
  const exportResolution = resolutionById(exportResolutionId);
  const desktopMode = isTauri();

  const handleNew = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    const transport = useTransportStore.getState();
    transport.pause();
    transport.seek(0);
    transport.setDuration(0);
    setProject(createDefaultProject());
    clearHistory();
    onQuickCreate?.();
  };

  const handleSave = async () => {
    try {
      const savedPath = await saveProject(project, projectPath || undefined);
      if (savedPath) setProjectPath(savedPath);
      markClean();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleOpen = async () => {
    try {
      const loaded = await loadProjectWithPath();
      setProject(loaded.project);
      setProjectPath(loaded.filePath || null);
      clearHistory();
    } catch (err: any) {
      alert('Open failed: ' + err.message);
    }
  };

  const handleImportAudio = () => { audioInputRef.current?.click(); };

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAudioFile(file);
    e.target.value = '';
  };

  const handleImportVisual = () => { visualInputRef.current?.click(); };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importVisualFileToLayer(file);
    e.target.value = '';
  };

  // exportProject is passed explicitly because React state (project) may not
  // have re-rendered yet when the resolution was just changed in the dialog.
  const handleExport = async (exportProject: Project = project) => {
    if (exportStore.status !== 'idle') return;
    const orchestrator = new ExportOrchestrator();
    exportRef.current = orchestrator;
    const audioAsset = exportProject.assets.find((a) => a.id === exportProject.audio.assetId);
    if (!audioAsset) {
      alert('No audio loaded. Import audio first.');
      exportRef.current = null;
      return;
    }
    const transport = useTransportStore.getState();
    const restoreState = {
      wasPlaying: transport.playing,
      time: transport.currentTime,
    };
    transport.pause();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${exportProject.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.mp4`;
    let outputPath = `output/${fileName}`;

    // Desktop build: let the user choose where the video goes instead of
    // silently writing into the app folder.
    if (desktopMode) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const chosen = await save({
          defaultPath: fileName,
          filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
        });
        if (!chosen) {
          exportRef.current = null;
          if (restoreState.wasPlaying) transport.play();
          return;
        }
        outputPath = chosen;
      } catch (err) {
        console.warn('Save dialog unavailable, using output/ folder:', err);
      }
    }

    try {
      await orchestrator.export(exportProject, outputPath, audioAsset.relPath, {
        fps: exportFps,
        mode: exportMode,
        autoDownload,
      });
    } finally {
      const t = useTransportStore.getState();
      t.seek(restoreState.time);
      if (restoreState.wasPlaying) t.play();
      exportRef.current = null;
    }
  };
  const handleDownloadResult = () => {
    const result = useExportStore.getState().result;
    if (result?.downloadUrl) downloadVideoUrl(result.downloadUrl, result.fileName);
    else if (result?.blob) downloadVideoBlob(result.blob, result.fileName);
  };
  const handleCancelExport = () => {
    exportRef.current?.cancel();
  };
  const handleOpenExportSettings = () => {
    if (exportStore.status !== 'idle') return;
    setExportModalOpen(true);
  };
  const handleConfirmExport = () => {
    const nextFps = Math.max(1, Math.min(240, Math.round(Number(exportFps) || 60)));
    setExportFps(nextFps);
    localStorage.setItem('pulseforge.export.fps', String(nextFps));
    localStorage.setItem('pulseforge.export.mode', exportMode);
    localStorage.setItem('pulseforge.export.resolution', exportResolution.id);
    localStorage.setItem('pulseforge.export.autoDownload', String(autoDownload));
    // The export renders at project.resolution; apply the chosen preset there.
    let exportProject = project;
    if (
      project.resolution.width !== exportResolution.width ||
      project.resolution.height !== exportResolution.height
    ) {
      exportProject = {
        ...project,
        resolution: { width: exportResolution.width, height: exportResolution.height },
        updatedAt: new Date().toISOString(),
      };
      setProject(exportProject);
    }
    setExportModalOpen(false);
    void handleExport(exportProject);
  };
  const estimatedBytes = estimateExportFileSizeBytes(
    exportResolution.width,
    exportResolution.height,
    exportFps,
    project.durationSec,
  );
  const estimatedText = formatBytes(estimatedBytes);

  return (
    <div style={styles.toolbar}>
      <div style={styles.left}>
        <div style={styles.logoWrap}>
          <span style={styles.logoIcon}>P</span>
          <span style={styles.logoText}>PulseForge</span>
        </div>
        <div style={styles.divider} />
        <button className="ghost" onClick={handleNew}>New</button>
        <button className="ghost" onClick={handleOpen}>Open</button>
        <button className="ghost" onClick={handleSave}>
          Save{dirty ? <span style={styles.dirtyDot} /> : ''}
        </button>
        <div style={styles.divider} />
        <button onClick={handleImportAudio}>
          <span style={styles.btnIcon}>&#9835;</span> Audio
        </button>
        <button onClick={handleImportVisual}>
          <span style={styles.btnIcon}>&#9638;</span> Visual
        </button>
        <div style={styles.divider} />
        <button className="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ fontSize: 15, padding: '4px 6px', opacity: canUndo ? 1 : 0.3 }}>
          &#8617;
        </button>
        <button className="ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={{ fontSize: 15, padding: '4px 6px', opacity: canRedo ? 1 : 0.3 }}>
          &#8618;
        </button>
      </div>

      <div style={styles.center}>
        <button className="quick-create-button" onClick={onQuickCreate}>
          <span style={styles.btnIcon}>✦</span> Quick Create
        </button>
        <button onClick={() => setGalleryOpen(true)}>
          Presets
        </button>
        <PresetGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      </div>

      <div style={styles.right}>
        <button
          className="primary"
          disabled={exportStore.status !== 'idle' && exportStore.status !== 'done' && exportStore.status !== 'error' && exportStore.status !== 'cancelled'}
          style={exportStore.status !== 'idle' ? { opacity: exportStore.status === 'done' ? 1 : 0.7 } : {}}
          onClick={exportStore.status === 'done' || exportStore.status === 'error' || exportStore.status === 'cancelled' ? () => exportStore.reset() : handleOpenExportSettings}
        >
          {exportStore.status === 'idle' ? 'Export Video' :
           exportStore.status === 'analyzing' ? 'Analyzing...' :
           exportStore.status === 'encoding' ? 'Encoding...' :
           exportStore.status === 'done' ? 'Done!' :
           exportStore.status === 'error' ? 'Error' :
           exportStore.status === 'cancelled' ? 'Cancelled' :
           `Recording ${Math.round(exportStore.progress * 100)}%`}
        </button>
        {(exportStore.status === 'analyzing' || exportStore.status === 'rendering' || exportStore.status === 'encoding') && (
          <button className="ghost" onClick={handleCancelExport}>
            Cancel
          </button>
        )}
      </div>

      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioFile} />
      <input ref={visualInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleImageFile} />
      {exportModalOpen && (
        <div style={styles.modalBackdrop} onClick={() => setExportModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Export Settings</div>
            <label style={styles.modalField}>
              <span>Resolution</span>
              <select
                value={exportResolution.id}
                onChange={(e) => setExportResolutionId(resolutionById(e.target.value).id)}
                style={styles.modalInput}
              >
                {EXPORT_RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
            <label style={styles.modalField}>
              <span>FPS</span>
              <input
                type="number"
                min={1}
                max={240}
                step={1}
                value={exportFps}
                onChange={(e) => setExportFps(Math.max(1, Math.round(Number(e.target.value) || 60)))}
                style={styles.modalInput}
              />
            </label>
            <label style={styles.modalField}>
              <span>Quality</span>
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as ExportQualityMode)}
                style={styles.modalInput}
              >
                <option value="compatibility">Compatibility (CRF 18, balanced)</option>
                <option value="crisp">Crisp (CRF 14, higher quality)</option>
              </select>
            </label>
            {!desktopMode && (
              <label style={styles.modalCheck}>
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                />
                <span>Download the video automatically when the export finishes</span>
              </label>
            )}
            <div style={styles.modalHint}>
              Duration: {project.durationSec.toFixed(2)}s | Frames: {Math.max(1, Math.round(project.durationSec * exportFps))}
            </div>
            <div style={styles.modalHint}>Estimated file size: {estimatedText}</div>
            <div style={styles.modalActions}>
              <button className="ghost" onClick={() => setExportModalOpen(false)}>Cancel</button>
              <button className="primary" onClick={handleConfirmExport}>Start Export</button>
            </div>
          </div>
        </div>
      )}
      {exportStore.status === 'done' && exportStore.result && (
        <div style={styles.modalBackdrop} onClick={() => exportStore.reset()}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Export Complete</div>
            <div style={styles.modalBody}>
              Your video is ready ({exportStore.result.width} x {exportStore.result.height}).
            </div>
            <div style={styles.modalFile}>{exportStore.result.fileName}</div>
            {exportStore.result.savedPath && (
              <div style={styles.modalHint}>
                {desktopMode ? 'Saved to: ' : 'A copy was also saved to the app output folder: '}
                {exportStore.result.savedPath}
              </div>
            )}
            <div style={styles.modalActions}>
              <button className="ghost" onClick={() => exportStore.reset()}>Close</button>
              {(exportStore.result.downloadUrl || exportStore.result.blob) && (
                <button className="primary" onClick={handleDownloadResult}>
                  &#11015; Download Video
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    padding: '0 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: 12,
    zIndex: 10,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  logoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 'var(--radius)',
    background: 'linear-gradient(135deg, var(--accent), #a29bfe)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text-primary)',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 22,
    background: 'var(--border-light)',
    margin: '0 8px',
    flexShrink: 0,
  },
  btnIcon: {
    marginRight: 4,
    fontSize: 13,
    opacity: 0.7,
  },
  dirtyDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--warning)',
    marginLeft: 6,
    verticalAlign: 'middle',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(4, 6, 12, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: 420,
    maxWidth: '92vw',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    boxShadow: '0 18px 55px rgba(0,0,0,0.45)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  modalInput: {
    fontSize: 13,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },
  modalHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    wordBreak: 'break-all',
  },
  modalCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  modalBody: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  modalFile: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    wordBreak: 'break-all',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
};
