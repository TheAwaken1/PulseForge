import { Project } from '../types/project';
import { serializeProject, deserializeProject } from './schema';

const AUTOSAVE_KEY = 'pulseforge_autosave';
const RECENT_PROJECTS_KEY = 'pulseforge_recent_projects';

/**
 * Check if we're running in Tauri (native) or browser mode.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Save project to a file path (Tauri mode) or localStorage (browser mode).
 */
export async function saveProject(project: Project, filePath?: string): Promise<string | undefined> {
  const json = serializeProject(project);

  if (isTauri()) {
    let targetPath = filePath;
    if (!targetPath) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      targetPath = await save({
        defaultPath: `${safeFileBase(project.name)}.pulseforge.json`,
        filters: [{ name: 'PulseForge Project', extensions: ['pulseforge.json', 'json'] }],
      }) || undefined;
    }
    if (!targetPath) return undefined;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(targetPath, json);
    addRecentProject(targetPath);
    return targetPath;
  }

  // Browser/Pinokio mode: download to file + keep autosave snapshot.
  localStorage.setItem(AUTOSAVE_KEY, json);
  downloadTextFile(`${safeFileBase(project.name)}.pulseforge.json`, json, 'application/json');
  return undefined;
}

/**
 * Load project from a file path (Tauri) or localStorage (browser).
 */
export async function loadProject(filePath?: string): Promise<Project> {
  const loaded = await loadProjectWithPath(filePath);
  return loaded.project;
}

export async function loadProjectWithPath(filePath?: string): Promise<{ project: Project; filePath?: string }> {
  if (isTauri()) {
    let sourcePath = filePath;
    if (!sourcePath) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PulseForge Project', extensions: ['pulseforge.json', 'json'] }],
      });
      if (!selected || Array.isArray(selected)) throw new Error('Open cancelled');
      sourcePath = selected;
    }
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const json = await readTextFile(sourcePath);
    addRecentProject(sourcePath);
    return { project: deserializeProject(json), filePath: sourcePath };
  }

  // Browser/Pinokio mode: open file picker first, fallback to autosave slot.
  try {
    const json = await pickBrowserProjectFile();
    return { project: deserializeProject(json) };
  } catch {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) throw new Error('No saved project found');
    return { project: deserializeProject(json) };
  }
}

/**
 * Save to autosave slot (localStorage, always available).
 */
export function autosave(project: Project): void {
  try {
    const json = serializeProject(project);
    localStorage.setItem(AUTOSAVE_KEY, json);
  } catch {
    // Silently fail autosave; don't disrupt the user
    console.warn('Autosave failed');
  }
}

/**
 * Check if autosave recovery data exists.
 */
export function hasAutosaveRecovery(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null;
}

/**
 * Load autosave recovery data.
 */
export function loadAutosaveRecovery(): Project | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    return deserializeProject(json);
  } catch {
    return null;
  }
}

/**
 * Clear autosave data.
 */
export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Get/set recent project paths.
 */
export function getRecentProjects(): string[] {
  try {
    const data = localStorage.getItem(RECENT_PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addRecentProject(path: string): void {
  const recent = getRecentProjects().filter((p) => p !== path);
  recent.unshift(path);
  if (recent.length > 10) recent.length = 10;
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
}

function safeFileBase(name: string): string {
  const n = (name || 'pulseforge_project').trim();
  return n.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function pickBrowserProjectFile(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pulseforge.json,.json,application/json';
    input.style.display = 'none';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('Open cancelled'));
          return;
        }
        const text = await file.text();
        resolve(text);
      } catch (e) {
        reject(e);
      } finally {
        input.remove();
      }
    };
    document.body.appendChild(input);
    input.click();
  });
}
