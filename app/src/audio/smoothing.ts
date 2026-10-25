/**
 * Audio smoothing with separate attack/release rates.
 *
 * If current > prev: smoothed = prev + attack * (current - prev)
 * Else:              smoothed = prev + release * (current - prev)
 *
 * Default attack=0.35, release=0.08
 */
export class SmoothingFilter {
  private values: Float32Array;
  private attack: number;
  private release: number;

  constructor(size: number, attack: number = 0.35, release: number = 0.08) {
    this.values = new Float32Array(size);
    this.attack = attack;
    this.release = release;
  }

  /**
   * Process a frame of values and return the smoothed result.
   *
   * frameFactor scales the per-frame rates for frame-rate independence
   * (1 = one 60fps frame, 2 = one 30fps frame). Without it the response
   * slows down whenever fewer frames are rendered, e.g. during export.
   */
  process(input: Float32Array, frameFactor = 1): Float32Array {
    const attack = frameFactor === 1 ? this.attack : scaleRate(this.attack, frameFactor);
    const release = frameFactor === 1 ? this.release : scaleRate(this.release, frameFactor);
    for (let i = 0; i < this.values.length && i < input.length; i++) {
      const current = input[i];
      const prev = this.values[i];
      const rate = current > prev ? attack : release;
      this.values[i] = prev + rate * (current - prev);
    }
    return this.values;
  }

  /**
   * Update smoothing parameters.
   */
  setParams(attack: number, release: number): void {
    this.attack = attack;
    this.release = release;
  }

  /**
   * Reset all values to zero.
   */
  reset(): void {
    this.values.fill(0);
  }
}

function scaleRate(rate: number, frameFactor: number): number {
  return 1 - Math.pow(1 - Math.max(0.001, Math.min(0.999, rate)), frameFactor);
}

/**
 * Apply dynamic compression: compressed = pow(clamp(value, 0, 1), power)
 * Default power = 0.6 (boosts quieter values to prevent thin-looking spectra)
 */
export function applyCompression(values: Float32Array, power: number = 0.6): void {
  for (let i = 0; i < values.length; i++) {
    const clamped = Math.max(0, Math.min(1, values[i]));
    values[i] = Math.pow(clamped, power);
  }
}
