import { create } from 'zustand';
import {
  Project, LayerAny, EffectAny, Asset, createDefaultProject,
  createLayerId, createEffectId, staticParam
} from '../types/project';

interface ProjectState {
  project: Project;
  dirty: boolean;
  projectPath: string | null; // path to saved project folder

  // Actions
  setProject: (project: Project) => void;
  setProjectPath: (path: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
  updateProjectField: <K extends keyof Project>(key: K, value: Project[K]) => void;

  // Asset actions
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;

  // Layer actions
  addLayer: (layer: LayerAny) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<LayerAny>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleLayerEnabled: (id: string) => void;

  // Effect actions
  addEffectToLayer: (layerId: string, effect: EffectAny) => void;
  removeEffectFromLayer: (layerId: string, effectId: string) => void;
  updateEffect: (layerId: string, effectId: string, updates: Partial<EffectAny>) => void;

  // Audio
  setAudioAsset: (assetId: string, durationSec: number) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  dirty: false,
  projectPath: null,

  setProject: (project) => set({ project, dirty: false }),
  setProjectPath: (path) => set({ projectPath: path }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),

  updateProjectField: (key, value) =>
    set((state) => ({
      project: { ...state.project, [key]: value, updatedAt: new Date().toISOString() },
      dirty: true,
    })),

  addAsset: (asset) =>
    set((state) => ({
      project: {
        ...state.project,
        assets: [...state.project.assets, asset],
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  removeAsset: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        assets: state.project.assets.filter((a) => a.id !== id),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  addLayer: (layer) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: [...state.project.layers, layer],
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  removeLayer: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.filter((l) => l.id !== id),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  updateLayer: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === id ? { ...l, ...updates } as LayerAny : l
        ),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  reorderLayers: (fromIndex, toIndex) =>
    set((state) => {
      const layers = [...state.project.layers];
      const [moved] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, moved);
      return {
        project: { ...state.project, layers, updatedAt: new Date().toISOString() },
        dirty: true,
      };
    }),

  toggleLayerEnabled: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === id ? { ...l, enabled: !l.enabled } : l
        ),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  addEffectToLayer: (layerId, effect) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === layerId ? { ...l, effects: [...l.effects, effect] } : l
        ),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  removeEffectFromLayer: (layerId, effectId) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === layerId
            ? { ...l, effects: l.effects.filter((e) => e.id !== effectId) }
            : l
        ),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  updateEffect: (layerId, effectId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                effects: l.effects.map((e) =>
                  e.id === effectId ? { ...e, ...updates } as EffectAny : e
                ),
              }
            : l
        ),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),

  setAudioAsset: (assetId, durationSec) =>
    set((state) => ({
      project: {
        ...state.project,
        audio: { ...state.project.audio, assetId },
        durationSec,
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
}));
