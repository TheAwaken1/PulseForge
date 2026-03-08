import { create } from 'zustand';

interface TransportState {
  playing: boolean;
  currentTime: number;    // seconds
  duration: number;       // seconds (from project/audio)
  looping: boolean;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  restart: () => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setLooping: (loop: boolean) => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  playing: false,
  currentTime: 0,
  duration: 0,
  looping: false,

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  restart: () => set({ currentTime: 0, playing: true }),
  setDuration: (duration) => set({ duration }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setLooping: (looping) => set({ looping }),
}));
