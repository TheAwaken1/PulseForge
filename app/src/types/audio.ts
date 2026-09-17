/**
 * AudioFrame: the audio analysis data for a single point in time.
 * Used by both real-time preview and offline export rendering.
 */
export type AudioFrame = {
  t: number;           // current time in seconds
  bins: Float32Array;  // log-frequency bins, length K (default 72), values 0..1
  rms: number;         // root mean square energy, 0..1
  beat: boolean;       // true on the frame a beat onset is detected
  beatPhase: number;   // 0→1 sawtooth, resets to 0 on each beat, reaches 1 at next expected beat
  bpm: number;         // estimated tempo in beats per minute
};

/**
 * AnalysisParams: parameters that define how audio analysis is performed.
 * Used as cache key for offline analysis.
 */
export type AnalysisParams = {
  fftSize: number;       // e.g. 2048
  hopSize: number;       // e.g. 1024
  binCount: number;      // e.g. 72
  minHz: number;         // e.g. 20
  maxHz: number;         // e.g. 16000
  compressionPow: number; // e.g. 0.6
};

/**
 * OfflineAnalysisResult: the full precomputed audio analysis.
 */
export type OfflineAnalysisResult = {
  sampleRate: number;
  hopSize: number;
  binCount: number;
  totalFrames: number;
  durationSec: number;
  // Flattened: bins[frame * binCount + bin]
  bins: Float32Array;
  rms: Float32Array;
  beats: Uint8Array;        // 1 = beat detected on that frame, 0 otherwise
  beatPhase: Float32Array;  // 0→1 beat phase per frame
  bpm: Float32Array;        // estimated BPM per frame
};

export const DEFAULT_ANALYSIS_PARAMS: AnalysisParams = {
  fftSize: 2048,
  hopSize: 1024,
  binCount: 72,
  minHz: 20,
  maxHz: 16000,
  compressionPow: 0.6,
};

/**
 * Create an empty AudioFrame (silence).
 */
export function emptyAudioFrame(binCount: number = 72): AudioFrame {
  return {
    t: 0,
    bins: new Float32Array(binCount),
    rms: 0,
    beat: false,
    beatPhase: 0,
    bpm: 120,
  };
}
