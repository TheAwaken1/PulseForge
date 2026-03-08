import { Project } from '../types/project';

const CURRENT_VERSION = 1;

/**
 * Validate a project JSON object. Returns errors if invalid.
 */
export function validateProject(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Project data must be an object'] };
  }

  const p = data as Record<string, unknown>;

  if (p.version !== CURRENT_VERSION) {
    errors.push(`Unsupported project version: ${p.version} (expected ${CURRENT_VERSION})`);
  }

  if (typeof p.name !== 'string') errors.push('Missing or invalid project name');
  if (typeof p.fps !== 'number' || p.fps <= 0) errors.push('Invalid fps');
  if (!p.resolution || typeof p.resolution !== 'object') errors.push('Missing resolution');
  if (!Array.isArray(p.assets)) errors.push('Missing assets array');
  if (!Array.isArray(p.layers)) errors.push('Missing layers array');
  if (!p.audio || typeof p.audio !== 'object') errors.push('Missing audio config');
  if (!p.settings || typeof p.settings !== 'object') errors.push('Missing settings');

  return { valid: errors.length === 0, errors };
}

/**
 * Serialize a project to JSON string.
 */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Deserialize a project from JSON string.
 */
export function deserializeProject(json: string): Project {
  const data = JSON.parse(json);
  const { valid, errors } = validateProject(data);
  if (!valid) {
    throw new Error(`Invalid project file: ${errors.join(', ')}`);
  }
  return data as Project;
}
