import type { AudioFrame } from '../types/audio';
import { clamp } from './layerUtils';

/** Shared organic deformation used by audio geometry layers. */
export function liquidWaveAt(
  index: number,
  count: number,
  t: number,
  speed: number,
  beatPhase: number,
): number {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const flowTime = t * speed;
  const broad = Math.sin(angle * 3 - flowTime * 2.1);
  const detail = Math.sin(angle * 7 + flowTime * 3.2 + beatPhase * Math.PI) * 0.45;
  return (broad + detail) / 1.45;
}

export function liquidMagnitude(
  values: Float32Array,
  index: number,
  t: number,
  audio: AudioFrame,
  amount: number,
  speed: number,
  maxValue = 1,
  wrap = true,
): { magnitude: number; wave: number } {
  const count = values.length;
  const center = values[index] ?? 0;
  const prevIndex = wrap ? (index - 2 + count) % count : Math.max(0, index - 2);
  const nextIndex = wrap ? (index + 2) % count : Math.min(count - 1, index + 2);
  const prev = values[prevIndex] ?? center;
  const next = values[nextIndex] ?? center;
  const localContrast = Math.max(0, center - (prev + next) * 0.5);
  const wave = liquidWaveAt(index, count, t, speed, audio.beatPhase);
  const energyDrive = 0.28 + clamp(audio.rms, 0, 1) * 0.72;
  const magnitude = clamp(
    center * (1 + wave * amount * energyDrive) + localContrast * amount * 0.8,
    0,
    maxValue,
  );

  return { magnitude, wave };
}
