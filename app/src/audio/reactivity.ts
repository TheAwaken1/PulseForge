import type { AudioFrame } from '../types/audio';
import type { AudioTarget } from '../types/project';

export const AUDIO_TARGET_OPTIONS: Array<{ value: AudioTarget; label: string }> = [
  { value: 'full', label: 'Full Mix' },
  { value: 'bass', label: 'Bass' },
  { value: 'mids', label: 'Mids' },
  { value: 'highs', label: 'Highs' },
  { value: 'beat', label: 'Beat' },
];

/** Resolve a stable 0..1 energy value from the shared realtime/offline audio frame. */
export function audioTargetEnergy(audio: AudioFrame, target: AudioTarget = 'full'): number {
  if (target === 'full') return clamp01(audio.rms);
  if (target === 'beat') return audio.beat ? 1 : 0;

  const length = audio.bins.length;
  if (length === 0) return 0;

  const bassEnd = Math.max(1, Math.floor(length * 0.18));
  const midsEnd = Math.max(bassEnd + 1, Math.floor(length * 0.58));
  if (target === 'bass') return average(audio.bins, 0, bassEnd);
  if (target === 'mids') return average(audio.bins, bassEnd, midsEnd);
  return average(audio.bins, midsEnd, length);
}

function average(values: Float32Array, start: number, end: number): number {
  let sum = 0;
  const safeEnd = Math.min(values.length, Math.max(start + 1, end));
  for (let index = start; index < safeEnd; index++) sum += values[index];
  return clamp01(sum / Math.max(1, safeEnd - start));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
