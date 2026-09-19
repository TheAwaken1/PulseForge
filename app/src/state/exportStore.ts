import { create } from 'zustand';

export type ExportStatus = 'idle' | 'analyzing' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';

/**
 * Result of a finished export, kept in memory so the UI can offer a
 * "Download video" button right from the editor instead of relying on the
 * user finding the output/ folder on disk.
 */
export interface ExportResult {
  /** File name of the produced video (e.g. MyProject_2026-01-01.mp4). */
  fileName: string;
  /** In-memory video blob (browser / Pinokio export path only). */
  blob: Blob | null;
  /** Path where the video was written on disk, if known. */
  savedPath: string | null;
  /** Streaming download URL for the finalized, seekable browser export. */
  downloadUrl: string | null;
  /** Pixel size of the exported video. */
  width: number;
  height: number;
}

interface ExportState {
  status: ExportStatus;
  progress: number;       // 0..1
  currentFrame: number;
  totalFrames: number;
  errorMessage: string | null;
  result: ExportResult | null;

  startExport: (totalFrames: number) => void;
  updateProgress: (frame: number) => void;
  setStatus: (status: ExportStatus) => void;
  setError: (message: string) => void;
  setResult: (result: ExportResult | null) => void;
  reset: () => void;
}

export const useExportStore = create<ExportState>((set, get) => ({
  status: 'idle',
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  errorMessage: null,
  result: null,

  startExport: (totalFrames) =>
    set({
      status: 'rendering',
      progress: 0,
      currentFrame: 0,
      totalFrames,
      errorMessage: null,
      result: null,
    }),

  updateProgress: (frame) => {
    const { totalFrames } = get();
    const progress = totalFrames > 0 ? frame / totalFrames : 0;
    set({ currentFrame: frame, progress });
  },

  setStatus: (status) => set({ status }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setResult: (result) => set({ result }),
  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      errorMessage: null,
      result: null,
    }),
}));
