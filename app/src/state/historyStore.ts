import { create } from 'zustand';
import { useProjectStore } from './projectStore';
import type { Project } from '../types/project';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

interface HistoryState {
  past: Project[];
  future: Project[];
  canUndo: boolean;
  canRedo: boolean;

  /** Push a snapshot (called by subscription, debounced). */
  _push: (project: Project) => void;

  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

/** True while we are applying an undo/redo (prevents re-recording). */
let _applying = false;

/** Debounce timer for coalescing rapid slider changes. */
let _timer: ReturnType<typeof setTimeout> | null = null;

/** Last serialized snapshot to skip duplicates. */
let _lastJson = '';

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  _push: (project) => {
    const json = JSON.stringify(project);
    if (json === _lastJson) return; // no meaningful change
    _lastJson = json;

    const clone: Project = structuredClone(project);
    set((s) => {
      const past = s.past.length >= MAX_HISTORY
        ? [...s.past.slice(s.past.length - MAX_HISTORY + 1), clone]
        : [...s.past, clone];
      return { past, future: [], canUndo: past.length > 0, canRedo: false };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0 || _applying) return;

    _applying = true;

    // Current project becomes a future entry
    const currentProject: Project = structuredClone(useProjectStore.getState().project);

    // Pop the last past entry
    const prevProject = past[past.length - 1];
    const newPast = past.slice(0, -1);

    set({
      past: newPast,
      future: [...get().future, currentProject],
      canUndo: newPast.length > 0,
      canRedo: true,
    });

    // Apply the snapshot
    useProjectStore.getState().setProject(prevProject);
    useProjectStore.getState().markDirty();
    _lastJson = JSON.stringify(prevProject);

    queueMicrotask(() => { _applying = false; });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0 || _applying) return;

    _applying = true;

    const currentProject: Project = structuredClone(useProjectStore.getState().project);

    const nextProject = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    set({
      past: [...get().past, currentProject],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });

    useProjectStore.getState().setProject(nextProject);
    useProjectStore.getState().markDirty();
    _lastJson = JSON.stringify(nextProject);

    queueMicrotask(() => { _applying = false; });
  },

  clearHistory: () => {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    _lastJson = '';
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));

/* ---- Subscription setup ---- */

let _unsubscribe: (() => void) | null = null;

/**
 * Call once at app startup to begin tracking project changes.
 */
export function initHistory(): void {
  if (_unsubscribe) return;

  // Capture initial state so first real change becomes undoable
  _lastJson = JSON.stringify(useProjectStore.getState().project);

  let prevProjectRef = useProjectStore.getState().project;

  _unsubscribe = useProjectStore.subscribe((state) => {
    // Only act when the project reference actually changed
    if (state.project === prevProjectRef) return;
    prevProjectRef = state.project;

    if (_applying) return;

    // Debounce: coalesce rapid changes (e.g. slider drags)
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => {
      _timer = null;
      useHistoryStore.getState()._push(state.project);
    }, DEBOUNCE_MS);
  });
}
