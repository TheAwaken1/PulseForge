import type { OfflineAnalysisResult, AnalysisParams } from '../types/audio';
import type { AudioFrame } from '../types/audio';
import { DEFAULT_ANALYSIS_PARAMS } from '../types/audio';
import { computeBinMapping, applyBinMapping } from './logBins';
import { SmoothingFilter, applyCompression } from './smoothing';

/**
 * Offline audio analyzer: decodes the full audio track and precomputes
 * bins[t][k] and rms[t] for deterministic frame-accurate export rendering.
 *
 * Algorithm:
 *   1) Decode audio to PCM
 *   2) For each hop (hopSize samples):
 *      a) Apply Hann window
 *      b) Compute FFT magnitudes
 *      c) Map to log bins (K=72)
 *      d) Compute RMS from time domain
 *   3) Store flattened arrays
 */
export class OfflineAnalyzer {
  private result: OfflineAnalysisResult | null = null;

  /**
   * Analyze an audio file from a URL (blob URL).
   * Returns the analysis result.
   */
  async analyze(
    url: string,
    params: AnalysisParams = DEFAULT_ANALYSIS_PARAMS,
    onProgress?: (percent: number) => void,
  ): Promise<OfflineAnalysisResult> {
    // Decode audio
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // Create a temporary AudioContext for decoding
    const tempCtx = new AudioContext();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // mono or first channel
    const totalSamples = channelData.length;

    const { fftSize, hopSize, binCount, minHz, maxHz, compressionPow } = params;
    const halfFFT = fftSize / 2;
    const totalFrames = Math.ceil(totalSamples / hopSize);

    // dB mapping constants matching Web Audio API AnalyserNode defaults:
    // minDecibels = -100, maxDecibels = -30
    const DB_MIN = -100;
    const DB_RANGE = 70; // -30 - (-100)

    // Precompute bin mapping
    const binMapping = computeBinMapping(fftSize, sampleRate, binCount, minHz, maxHz);

    // Allocate output arrays
    const bins = new Float32Array(totalFrames * binCount);
    const rms = new Float32Array(totalFrames);

    // Precompute Hann window
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Process each hop
    const fftInput = new Float32Array(fftSize);
    const fftMagnitudes = new Float32Array(halfFFT);
    const binnedFrame = new Float32Array(binCount);
    const sampledRawLevels: number[] = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      const start = frame * hopSize;

      // Fill FFT input with windowed samples (zero-pad if needed)
      for (let i = 0; i < fftSize; i++) {
        const sampleIdx = start + i;
        fftInput[i] = sampleIdx < totalSamples
          ? channelData[sampleIdx] * window[i]
          : 0;
      }

      // Compute FFT magnitudes using a simple DFT approximation
      // For production, you'd want a proper FFT library.
      // Here we use a Cooley-Tukey radix-2 FFT.
      computeFFTMagnitudes(fftInput, fftMagnitudes);

      // Convert linear magnitudes to dB-mapped 0-1, matching Web Audio API
      // getByteFrequencyData() with default minDecibels=-100, maxDecibels=-30.
      // This is the key step: raw linear FFT magnitudes (~0.0001–0.05) are nearly
      // invisible after gain-capping, but dB scale maps -60dB signals to ~0.57,
      // matching the perceptual brightness of the realtime preview.
      for (let i = 0; i < halfFFT; i++) {
        const mag = fftMagnitudes[i];
        const dB = mag > 1e-10 ? 20 * Math.log10(mag) : DB_MIN;
        fftMagnitudes[i] = Math.max(0, Math.min(1, (dB - DB_MIN) / DB_RANGE));
      }

      // Map to log bins
      applyBinMapping(fftMagnitudes, binMapping, binnedFrame);

      // Keep raw bins first; normalization + smoothing + compression are applied
      // in a second pass to better match realtime intensity.
      for (let j = 0; j < binCount; j++) {
        const raw = Math.max(0, binnedFrame[j]);
        bins[frame * binCount + j] = raw;
        if ((frame & 3) === 0 && (j & 1) === 0) {
          sampledRawLevels.push(raw);
        }
      }

      // Compute RMS from time domain
      let rmsSum = 0;
      for (let i = 0; i < fftSize && (start + i) < totalSamples; i++) {
        const s = channelData[start + i];
        rmsSum += s * s;
      }
      rms[frame] = Math.sqrt(rmsSum / fftSize);

      // Yield to the browser every 50 frames so the UI stays responsive.
      // Without this the synchronous FFT loop blocks the main thread for
      // several seconds on typical audio, causing a white/frozen screen.
      if (frame % 50 === 0) {
        if (onProgress) onProgress((frame / totalFrames) * 0.85);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    // Match preview behavior more closely:
    // 1) percentile-based normalization boost
    // 2) temporal smoothing
    // 3) final compression curve
    const normalizationGain = computeNormalizationGain(sampledRawLevels);
    const smoother = new SmoothingFilter(binCount);
    const frameBins = new Float32Array(binCount);
    const compressed = new Float32Array(binCount);
    for (let frame = 0; frame < totalFrames; frame++) {
      const frameBase = frame * binCount;
      for (let j = 0; j < binCount; j++) {
        frameBins[j] = Math.min(1, bins[frameBase + j] * normalizationGain);
      }
      compressed.set(smoother.process(frameBins));
      applyCompression(compressed, compressionPow);
      for (let j = 0; j < binCount; j++) {
        bins[frameBase + j] = compressed[j];
      }
      if (frame % 100 === 0) {
        if (onProgress) onProgress(0.85 + (frame / totalFrames) * 0.15);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    if (onProgress) onProgress(1);

    this.result = {
      sampleRate,
      hopSize,
      binCount,
      totalFrames,
      durationSec: totalSamples / sampleRate,
      bins,
      rms,
    };

    return this.result;
  }

  /**
   * Sample the analysis at a given time t with linear interpolation.
   */
  sampleAtTime(t: number): AudioFrame {
    if (!this.result) {
      return { t, bins: new Float32Array(72), rms: 0 };
    }

    const { hopSize, sampleRate, binCount, totalFrames, bins, rms: rmsArr } = this.result;
    const analysisFps = sampleRate / hopSize;
    const index = t * analysisFps;

    const i0 = Math.max(0, Math.min(totalFrames - 1, Math.floor(index)));
    const i1 = Math.min(totalFrames - 1, i0 + 1);
    const frac = index - i0;

    // Interpolate bins
    const outputBins = new Float32Array(binCount);
    for (let k = 0; k < binCount; k++) {
      const v0 = bins[i0 * binCount + k];
      const v1 = bins[i1 * binCount + k];
      outputBins[k] = v0 + frac * (v1 - v0);
    }

    // Interpolate RMS
    const rms = rmsArr[i0] + frac * (rmsArr[i1] - rmsArr[i0]);

    return { t, bins: outputBins, rms: Math.min(1, rms * 2) };
  }

  get analysisResult(): OfflineAnalysisResult | null {
    return this.result;
  }
}

/**
 * Radix-2 Cooley-Tukey FFT (in-place) and magnitude extraction.
 * Input must be power-of-2 length.
 */
function computeFFTMagnitudes(input: Float32Array, output: Float32Array): void {
  const N = input.length;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  // Bit-reversal permutation
  for (let i = 0; i < N; i++) {
    real[bitReverse(i, N)] = input[i];
  }

  // FFT butterfly
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tReal = real[i + j + halfSize] * cos - imag[i + j + halfSize] * sin;
        const tImag = real[i + j + halfSize] * sin + imag[i + j + halfSize] * cos;
        real[i + j + halfSize] = real[i + j] - tReal;
        imag[i + j + halfSize] = imag[i + j] - tImag;
        real[i + j] += tReal;
        imag[i + j] += tImag;
      }
    }
  }

  // Compute magnitudes for first half (positive frequencies)
  const halfN = N / 2;
  for (let i = 0; i < halfN && i < output.length; i++) {
    output[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / N;
  }
}

function bitReverse(x: number, N: number): number {
  const bits = Math.log2(N);
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

function computeNormalizationGain(
  samples: number[],
  percentile: number = 0.95,
  targetLevel: number = 0.9,
): number {
  if (samples.length === 0) return 1;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(percentile * (sorted.length - 1))));
  const ref = sorted[idx];
  if (!Number.isFinite(ref) || ref <= 1e-6) return 1;
  return Math.max(1, Math.min(24, targetLevel / ref));
}
