import type { AudioFrame } from '../types/audio';
import { DEFAULT_ANALYSIS_PARAMS } from '../types/audio';
import { computeBinMapping, applyBinMapping, type BinMapping } from './logBins';
import { SmoothingFilter, applyCompression } from './smoothing';
import { BeatDetector } from './BeatDetector';

/**
 * Real-time audio analyzer using WebAudio API.
 * Provides per-frame AudioFrame data from live playback.
 */
export class RealtimeAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;

  private binMapping: BinMapping | null = null;
  private smoother: SmoothingFilter;
  private fftData = new Uint8Array(0);
  private timeDomainData = new Uint8Array(0);
  private binnedData: Float32Array;
  private outputBuf: Float32Array;
  private emptyFrame: AudioFrame;
  private adaptiveRef = 0.25;
  private beatDetector: BeatDetector;
  private lastFrameMs = -1;

  private fftSize: number;
  private binCount: number;
  private compressionPow: number;

  private playing = false;
  private startTime = 0;      // audioContext.currentTime when playback started
  private startOffset = 0;    // offset in seconds into the audio

  constructor(
    binCount: number = DEFAULT_ANALYSIS_PARAMS.binCount,
    fftSize: number = DEFAULT_ANALYSIS_PARAMS.fftSize,
    compressionPow: number = DEFAULT_ANALYSIS_PARAMS.compressionPow,
  ) {
    this.fftSize = fftSize;
    this.binCount = binCount;
    this.compressionPow = compressionPow;
    this.binnedData = new Float32Array(binCount);
    this.outputBuf = new Float32Array(binCount);
    this.emptyFrame = { t: 0, bins: new Float32Array(binCount), rms: 0, beat: false, beatPhase: 0, bpm: 120 };
    this.smoother = new SmoothingFilter(binCount);
    this.beatDetector = new BeatDetector();
  }

  /**
   * Load an audio file from a URL (blob URL or file URL).
   */
  async loadAudio(url: string): Promise<number> {
    this.dispose();
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0; // We do our own smoothing

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.fftData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);

    // Load and decode audio
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Compute bin mapping
    this.binMapping = computeBinMapping(
      this.fftSize,
      this.audioBuffer.sampleRate,
      this.binCount,
      DEFAULT_ANALYSIS_PARAMS.minHz,
      DEFAULT_ANALYSIS_PARAMS.maxHz,
    );

    return this.audioBuffer.duration;
  }

  /**
   * Start playback from a given offset.
   */
  play(offset: number = 0): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return;

    this.stop();

    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(this.gainNode);
    source.start(0, offset);

    this.sourceNode = source;
    this.startTime = this.audioContext.currentTime;
    this.startOffset = offset;
    this.playing = true;

    source.onended = () => {
      this.playing = false;
    };
  }

  /**
   * Stop playback.
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.onended = null; // prevent stale callback from clearing playing flag
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.playing = false;
  }

  /**
   * Pause playback and return current position.
   */
  pause(): number {
    const t = this.getCurrentTime();
    this.stop();
    return t;
  }

  /**
   * Get current playback time in seconds.
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.playing) return this.startOffset;
    return this.startOffset + (this.audioContext.currentTime - this.startTime);
  }

  /**
   * Get the current AudioFrame (call this each animation frame).
   */
  getFrame(): AudioFrame {
    if (!this.analyser || !this.binMapping) {
      return this.emptyFrame;
    }

    // Get raw FFT data (frequency domain, 0..255)
    this.analyser.getByteFrequencyData(this.fftData);

    // Map to log bins
    applyBinMapping(this.fftData, this.binMapping, this.binnedData, true);

    // Apply smoothing
    const smoothed = this.smoother.process(this.binnedData);

    // Apply stable adaptive normalization so preview intensity matches offline export.
    const p95 = percentile(smoothed, 0.95);
    const target = 0.9;
    const rawRef = Math.max(1e-4, p95);
    const refAttack = 0.2;
    const refRelease = 0.02;
    const refRate = rawRef > this.adaptiveRef ? refAttack : refRelease;
    this.adaptiveRef = this.adaptiveRef + (rawRef - this.adaptiveRef) * refRate;
    const gain = clamp(target / Math.max(1e-4, this.adaptiveRef), 1, 24);

    // Apply normalization + compression (reuse buffer)
    const output = this.outputBuf;
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.min(1, smoothed[i] * gain);
    }
    applyCompression(output, this.compressionPow);

    // Compute RMS from time domain
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    let rmsSum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const val = (this.timeDomainData[i] - 128) / 128; // normalize to -1..1
      rmsSum += val * val;
    }
    const rms = Math.sqrt(rmsSum / this.timeDomainData.length);

    // Beat detection — use wall-clock dt so it stays accurate regardless of framerate
    const nowMs = performance.now();
    const dt = this.lastFrameMs < 0 ? 1 / 60 : Math.min(0.2, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    const { beat, beatPhase, bpm } = this.beatDetector.process(output, dt);

    return {
      t: this.getCurrentTime(),
      bins: output,
      rms: Math.min(1, rms * 2), // Scale up for visual impact
      beat,
      beatPhase,
      bpm,
    };
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.audioBuffer?.duration ?? 0;
  }

  get sampleRate(): number {
    return this.audioBuffer?.sampleRate ?? 44100;
  }

  /**
   * Set playback volume (0..1).
   */
  setVolume(vol: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = vol;
    }
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.audioBuffer = null;
    this.smoother.reset();
    this.adaptiveRef = 0.25;
    this.beatDetector.reset();
    this.lastFrameMs = -1;
  }
}

function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  const arr = Array.from(values).sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(p * (arr.length - 1))));
  return arr[idx];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
