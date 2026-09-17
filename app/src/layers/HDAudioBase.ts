import type { AudioFrame } from '../types/audio';
import { applyCompression } from '../audio/smoothing';
import { mapBins, clamp } from './layerUtils';

/**
 * Parameters accepted by processAudio().
 * Each layer samples its own config params and passes them in.
 */
export interface AudioProcessParams {
  barCount: number;
  gain: number;
  compressionPow: number;
  attackAdj: number;
  releaseAdj: number;
  gamma: number;
  contrast: number;
  peakEnabled: boolean;
  peakDecayAdj: number;
  /** Per-bin multiplier applied after mapping + compression (e.g. bandBoost or transient). Default 1. */
  boostFactor?: number;
  /** RMS value from the audio frame, used for the rms lift step. */
  rms: number;
}

/**
 * Abstract base class encapsulating the shared audio processing pipeline
 * used by HDBarsReflection, HDSonicSpikes, and HDCircularSpectrum layers.
 *
 * Subclasses keep their own PixiJS rendering logic and call processAudio()
 * once per frame to populate smooth / peaks / shaped arrays.
 */
export abstract class HDAudioBase {
  protected smooth = new Float32Array(96);
  protected peaks = new Float32Array(96);
  protected mapped = new Float32Array(96);
  protected shaped = new Float32Array(96);
  /** Decaying beat-kick multiplier: 1.0 on a beat, decays to 0 over ~200ms. */
  protected beatKick = 0;

  /**
   * Update the beat-kick state. Call once per frame before processAudio().
   * frameFactor from timeFactor60fps() normalizes the decay rate.
   */
  protected updateBeatKick(beat: boolean, frameFactor: number): void {
    if (beat) {
      this.beatKick = 1.0;
    } else {
      this.beatKick *= Math.pow(0.65, frameFactor);
    }
  }

  /**
   * Resize all audio arrays when the bin/bar count changes.
   */
  protected ensureSize(count: number): void {
    if (this.smooth.length === count) return;
    this.smooth = new Float32Array(count);
    this.peaks = new Float32Array(count);
    this.mapped = new Float32Array(count);
    this.shaped = new Float32Array(count);
  }

  /**
   * Full shared audio processing pipeline:
   * 1. mapBins from spectrum
   * 2. compression (pow)
   * 3. rms lift
   * 4. per-bin smoothing (attack/release)
   * 5. gamma + contrast shaping
   * 6. peak hold update
   *
   * After calling this, this.smooth, this.mapped, this.shaped, and this.peaks
   * are populated for the current frame and can be used by the subclass render code.
   */
  protected processAudio(audio: AudioFrame, params: AudioProcessParams): void {
    const {
      barCount,
      gain,
      compressionPow,
      attackAdj,
      releaseAdj,
      gamma,
      contrast,
      peakEnabled,
      peakDecayAdj,
      rms,
    } = params;
    const boostFactor = params.boostFactor ?? 1;

    // 1. Map FFT bins to target count with gain
    mapBins(audio.bins, this.mapped, barCount, gain);

    // 2. Compression
    applyCompression(this.mapped, compressionPow);

    // 3. RMS lift
    const rmsLift = clamp(rms * 0.22, 0, 0.2);
    for (let i = 0; i < barCount; i++) {
      this.mapped[i] = clamp(this.mapped[i] + rmsLift, 0, 1);
    }

    // 4-6. Per-bin: smoothing, gamma/contrast shaping, peak hold
    for (let i = 0; i < barCount; i++) {
      const prev = this.smooth[i];
      const next = this.mapped[i] * boostFactor;
      const rate = next > prev ? attackAdj : releaseAdj;
      const smoothed = prev + (next - prev) * rate;
      this.smooth[i] = smoothed;

      // Gamma + contrast shaping
      let shaped = Math.pow(clamp(smoothed, 0, 1), gamma);
      shaped = clamp((shaped - 0.5) * contrast + 0.5, 0, 1);
      this.shaped[i] = shaped;

      // Peak hold
      if (peakEnabled) {
        this.peaks[i] = Math.max(this.peaks[i] * peakDecayAdj, shaped);
      } else {
        this.peaks[i] = shaped;
      }
    }
  }
}
