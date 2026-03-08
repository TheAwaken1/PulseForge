import { create } from 'zustand';

export type ExportStatus = 'idle' | 'analyzing' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';

interface ExportState {
  status: ExportStatus;
  progress: number;       // 0..1
  currentFrame: number;
  totalFrames: number;
  errorMessage: string | null;

  startExport: (totalFrames: number) => void;
  updateProgress: (frame: number) => void;
  setStatus: (status: ExportStatus) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useExportStore = create<ExportState>((set, get) => ({
  status: 'idle',
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  errorMessage: null,

  startExport: (totalFrames) =>
    set({
      status: 'rendering',
      progress: 0,
      currentFrame: 0,
      totalFrames,
      errorMessage: null,
    }),

  updateProgress: (frame) => {
    const { totalFrames } = get();
    const progress = totalFrames > 0 ? frame / totalFrames : 0;
    set({ currentFrame: frame, progress });
  },

  setStatus: (status) => set({ status }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      errorMessage: null,
    }),
}));
