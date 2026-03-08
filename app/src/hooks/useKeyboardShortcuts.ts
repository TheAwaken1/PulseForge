import { useEffect } from 'react';
import { useTransportStore } from '../state/transportStore';
import { useHistoryStore } from '../state/historyStore';
import { useSelectionStore } from '../state/selectionStore';
import { useProjectStore } from '../state/projectStore';
import { saveProject } from '../project/persistence';

/**
 * Global keyboard shortcut handler.
 * Call once in the root App component.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inputType = (e.target as HTMLInputElement)?.type;

      // Skip when typing in text inputs (but allow Space on non-text inputs)
      const isTextInput = tag === 'TEXTAREA' ||
        (tag === 'INPUT' && inputType !== 'range' && inputType !== 'checkbox' && inputType !== 'color') ||
        tag === 'SELECT';

      const isMeta = e.metaKey || e.ctrlKey;

      // Space = Play/Pause
      if (e.key === ' ' || e.code === 'Space') {
        if (isTextInput) return;
        e.preventDefault();
        useTransportStore.getState().togglePlay();
        return;
      }

      // Ctrl+Z / Cmd+Z = Undo
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y / Cmd+Shift+Z = Redo
      if ((isMeta && e.key === 'z' && e.shiftKey) || (isMeta && e.key === 'y')) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      // Delete/Backspace = Remove selected layer (when not in text input)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTextInput) return;
        const { selectedLayerId } = useSelectionStore.getState();
        if (selectedLayerId) {
          e.preventDefault();
          useProjectStore.getState().removeLayer(selectedLayerId);
          useSelectionStore.getState().clearSelection();
        }
        return;
      }

      // Ctrl+S / Cmd+S = Save
      if (isMeta && e.key === 's') {
        e.preventDefault();
        const { project, projectPath, markClean, setProjectPath } = useProjectStore.getState();
        saveProject(project, projectPath || undefined).then((savedPath) => {
          if (savedPath) setProjectPath(savedPath);
          markClean();
        }).catch((err) => {
          console.warn('Save failed:', err);
        });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
