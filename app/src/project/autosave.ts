import { useProjectStore } from '../state/projectStore';
import { autosave } from './persistence';

const AUTOSAVE_INTERVAL_MS = 15_000; // 15 seconds
let autosaveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start autosave loop. Saves the project every 15s if dirty.
 */
export function startAutosave(): void {
  stopAutosave();
  autosaveTimer = setInterval(() => {
    const { project, dirty } = useProjectStore.getState();
    if (dirty) {
      autosave(project);
      // Don't mark clean here; only manual save clears dirty flag
    }
  }, AUTOSAVE_INTERVAL_MS);
}

/**
 * Stop autosave loop.
 */
export function stopAutosave(): void {
  if (autosaveTimer !== null) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}
