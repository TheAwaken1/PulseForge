import { create } from 'zustand';

interface SelectionState {
  selectedLayerId: string | null;
  selectedEffectId: string | null;

  selectLayer: (id: string | null) => void;
  selectEffect: (id: string | null) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedLayerId: null,
  selectedEffectId: null,

  selectLayer: (id) => set({ selectedLayerId: id, selectedEffectId: null }),
  selectEffect: (id) => set({ selectedEffectId: id }),
  clearSelection: () => set({ selectedLayerId: null, selectedEffectId: null }),
}));
