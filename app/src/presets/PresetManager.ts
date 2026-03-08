import { ALL_PRESETS, type PresetTemplate } from './templates';
import { useProjectStore } from '../state/projectStore';
import type { LayerAny } from '../types/project';
import { createLayerId, createEffectId } from '../types/project';

/**
 * Manages preset templates: listing, applying, and custom presets.
 */
export class PresetManager {
  /**
   * Get all available presets.
   */
  static getAll(): PresetTemplate[] {
    return ALL_PRESETS;
  }

  /**
   * Get a preset by ID.
   */
  static getById(id: string): PresetTemplate | undefined {
    return ALL_PRESETS.find((p) => p.id === id);
  }

  /**
   * Apply a preset to the current project.
   * Adds the preset's layers to the project (does not remove existing layers).
   * Generates new IDs for all layers and effects to avoid conflicts.
   */
  static apply(presetId: string): void {
    const preset = PresetManager.getById(presetId);
    if (!preset) return;

    const store = useProjectStore.getState();

    // Deep-clone layers with new IDs
    for (const layer of preset.layers) {
      const newLayer = {
        ...JSON.parse(JSON.stringify(layer)),
        id: createLayerId(),
        effects: layer.effects.map((e) => ({
          ...JSON.parse(JSON.stringify(e)),
          id: createEffectId(),
        })),
      } as LayerAny;

      store.addLayer(newLayer);
    }

    // Track preset applied
    store.updateProjectField('presetsApplied', [
      ...(store.project.presetsApplied || []),
      presetId,
    ]);
  }

  /**
   * Replace all layers with a preset's layers, and apply any preset settings.
   */
  static applyExclusive(presetId: string): void {
    const preset = PresetManager.getById(presetId);
    if (!preset) return;

    const store = useProjectStore.getState();

    // Preserve the lyrics layer so transcriptions survive preset switches
    const existingLyricsLayer = store.project.layers.find((l) => l.kind === 'lyrics') ?? null;

    // Remove existing layers
    const existingIds = store.project.layers.map((l) => l.id);
    for (const id of existingIds) {
      store.removeLayer(id);
    }

    // Apply preset settings (e.g. backgroundColor) if specified
    if (preset.settings?.backgroundColor !== undefined) {
      store.updateProjectField('settings', {
        ...store.project.settings,
        backgroundColor: preset.settings.backgroundColor,
      });
    }

    // Apply preset layers
    PresetManager.apply(presetId);

    // Re-add the lyrics layer on top if it existed
    if (existingLyricsLayer) {
      store.addLayer(existingLyricsLayer);
    }

    // Keep dropdown/state stable to the current preset
    store.updateProjectField('presetsApplied', [presetId]);
  }
}
