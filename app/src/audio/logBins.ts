/**
 * Log-frequency binning: maps linear FFT bins to perceptually spaced
 * logarithmic bins across ~20Hz–16kHz.
 *
 * Algorithm:
 *   edges[j] = exp(log(minHz) + j * log(maxHz/minHz) / K)
 *   For each bucket j, average linear bins whose frequency falls in [edges[j], edges[j+1]).
 */

export interface BinMapping {
  /** Number of output bins */
  binCount: number;
  /** For each output bin: [startIndex, endIndex) into the FFT array */
  ranges: [number, number][];
}

/**
 * Precompute the mapping from linear FFT indices to log bins.
 *
 * @param fftSize   FFT size (e.g. 2048)
 * @param sampleRate  Audio sample rate (e.g. 44100)
 * @param binCount  Number of output log bins (e.g. 72)
 * @param minHz     Min frequency (e.g. 20)
 * @param maxHz     Max frequency (e.g. 16000)
 */
export function computeBinMapping(
  fftSize: number,
  sampleRate: number,
  binCount: number,
  minHz: number,
  maxHz: number,
): BinMapping {
  const nyquist = sampleRate / 2;
  const effectiveMaxHz = Math.min(maxHz, nyquist);
  const halfFFT = fftSize / 2;

  // Compute K+1 edges in log space
  const logMin = Math.log(minHz);
  const logMax = Math.log(effectiveMaxHz);
  const edges: number[] = [];
  for (let j = 0; j <= binCount; j++) {
    edges.push(Math.exp(logMin + (j * (logMax - logMin)) / binCount));
  }

  const ranges: [number, number][] = [];
  for (let j = 0; j < binCount; j++) {
    // Convert Hz to FFT index
    const startIdx = Math.max(0, Math.floor((edges[j] / nyquist) * halfFFT));
    const endIdx = Math.min(halfFFT, Math.ceil((edges[j + 1] / nyquist) * halfFFT));
    ranges.push([startIdx, Math.max(startIdx + 1, endIdx)]);
  }

  return { binCount, ranges };
}

/**
 * Apply the bin mapping to a linear FFT magnitude array.
 * Uses mean aggregation for a smooth look.
 *
 * @param fftData   Float magnitude array (0..1), length = fftSize/2
 * @param mapping   Precomputed bin mapping
 * @param output    Output array to fill (length = binCount)
 */
export function applyBinMapping(
  fftData: { readonly length: number; readonly [index: number]: number },
  mapping: BinMapping,
  output: Float32Array,
  normalize255: boolean = false,
): void {
  for (let j = 0; j < mapping.binCount; j++) {
    const [start, end] = mapping.ranges[j];
    let sum = 0;
    let count = 0;
    for (let i = start; i < end && i < fftData.length; i++) {
      const val = normalize255 ? fftData[i] / 255 : fftData[i];
      sum += val;
      count++;
    }
    output[j] = count > 0 ? sum / count : 0;
  }
}
