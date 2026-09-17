/**
 * Spectral-flux onset detector for beat tracking.
 *
 * Algorithm:
 *   1. Extract bass-band energy (lower ~15% of log bins) each frame.
 *   2. Compute one-sided flux: max(0, energy - prevEnergy).
 *   3. Maintain a rolling window of flux values (~1.7s at 60fps).
 *   4. Adaptive threshold = window mean + sensitivity × window stddev.
 *   5. Detect a beat when flux exceeds the threshold, subject to a
 *      minimum inter-beat interval (240 BPM max).
 *   6. Track inter-beat intervals (IBIs) for BPM estimation.
 *   7. beatPhase: sawtooth 0→1 over one estimated beat period,
 *      resetting to 0 on each detected beat.
 */

const WINDOW_SIZE = 100;
const MIN_BEAT_INTERVAL = 0.25;   // 240 BPM max
const MAX_BEAT_INTERVAL = 2.0;    // 30 BPM min
const IBI_HISTORY_MAX = 8;

export class BeatDetector {
  /** Raise to increase selectivity (fewer false positives, may miss softer beats). */
  sensitivity: number;

  private fluxWindow = new Float32Array(WINDOW_SIZE);
  private fluxIdx = 0;
  private prevBassEnergy = 0;
  private timeSinceLastBeat = MAX_BEAT_INTERVAL;
  private ibiHistory: number[] = [];
  private estimatedBpm = 120;

  constructor(sensitivity = 1.5) {
    this.sensitivity = sensitivity;
  }

  /**
   * Process one audio frame.
   *
   * @param bins  Log-frequency bins (0..1), same array passed to layers.
   * @param dt    Elapsed seconds since the previous frame.
   */
  process(
    bins: Float32Array,
    dt: number,
  ): { beat: boolean; beatPhase: number; bpm: number } {
    // Bass energy: lower ~15% of bins
    const bassEnd = Math.max(1, Math.floor(bins.length * 0.15));
    let bassEnergy = 0;
    for (let i = 0; i < bassEnd; i++) bassEnergy += bins[i];
    bassEnergy /= bassEnd;

    // One-sided spectral flux (onset energy)
    const flux = Math.max(0, bassEnergy - this.prevBassEnergy);
    this.prevBassEnergy = bassEnergy;

    // Rolling window update
    this.fluxWindow[this.fluxIdx] = flux;
    this.fluxIdx = (this.fluxIdx + 1) % WINDOW_SIZE;

    // Adaptive threshold
    let mean = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) mean += this.fluxWindow[i];
    mean /= WINDOW_SIZE;
    let variance = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
      const d = this.fluxWindow[i] - mean;
      variance += d * d;
    }
    const std = Math.sqrt(variance / WINDOW_SIZE);
    const threshold = mean + this.sensitivity * std;

    this.timeSinceLastBeat += dt;

    let beat = false;
    if (
      flux > threshold &&
      flux > 0.005 &&   // ignore sub-noise triggers
      this.timeSinceLastBeat >= MIN_BEAT_INTERVAL
    ) {
      beat = true;
      if (this.timeSinceLastBeat < MAX_BEAT_INTERVAL) {
        this.ibiHistory.push(this.timeSinceLastBeat);
        if (this.ibiHistory.length > IBI_HISTORY_MAX) this.ibiHistory.shift();
        if (this.ibiHistory.length >= 2) {
          const avgIbi =
            this.ibiHistory.reduce((a, b) => a + b, 0) / this.ibiHistory.length;
          this.estimatedBpm = Math.min(240, Math.max(40, 60 / avgIbi));
        }
      }
      this.timeSinceLastBeat = 0;
    }

    const beatPeriod = 60 / this.estimatedBpm;
    const beatPhase = Math.min(1, this.timeSinceLastBeat / beatPeriod);

    return { beat, beatPhase, bpm: this.estimatedBpm };
  }

  reset(): void {
    this.fluxWindow.fill(0);
    this.fluxIdx = 0;
    this.prevBassEnergy = 0;
    this.timeSinceLastBeat = MAX_BEAT_INTERVAL;
    this.ibiHistory = [];
    this.estimatedBpm = 120;
  }
}
