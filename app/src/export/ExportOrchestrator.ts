import { PixiApp } from '../renderer/PixiApp';
import { OfflineAnalyzer } from '../audio/OfflineAnalyzer';
import { useExportStore } from '../state/exportStore';
import type { Project } from '../types/project';

export type ExportQualityMode = 'compatibility' | 'crisp';

export interface ExportOptions {
  fps: number;
  mode: ExportQualityMode;
  /**
   * Browser/Pinokio path only: trigger a browser download of the finished
   * video automatically. The video is also kept in the export store so the
   * UI can offer a "Download video" button afterwards.
   */
  autoDownload?: boolean;
}

/**
 * Trigger a browser "Save file" download for a video blob.
 * Used by both the auto-download option and the "Download video" button.
 */
export function downloadVideoBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Download a finalized export from the local Pinokio server without loading it into memory again. */
export function downloadVideoUrl(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Check if running inside Tauri.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * ExportOrchestrator: manages the full export pipeline.
 *
 * Browser path (no Tauri):
 *   Uses canvas.captureStream() + MediaRecorder to produce a video
 *   with audio, rendered in real-time, then triggers a download.
 *
 * Tauri path:
 *   Sends frames to FFmpeg backend via IPC.
 */
export class ExportOrchestrator {
  private cancelled = false;
  private offlineAnalyzer: OfflineAnalyzer;
  private offscreenApp: PixiApp | null = null;
  private cancelBackend: (() => Promise<void>) | null = null;
  private scaleCanvas: HTMLCanvasElement | null = null;
  private scaleCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.offlineAnalyzer = new OfflineAnalyzer();
  }

  async export(
    project: Project,
    outputPath: string,
    audioUrl: string,
    options: ExportOptions,
  ): Promise<void> {
    const exportStore = useExportStore.getState();
    this.cancelled = false;
    this.cancelBackend = null;

    try {
      // Step 1: Offline analysis
      exportStore.setStatus('analyzing');
      await this.offlineAnalyzer.analyze(audioUrl, undefined, (p) => {
        exportStore.updateProgress(Math.floor(p * 100));
      });

      if (this.cancelled) {
        exportStore.setStatus('cancelled');
        return;
      }

      // Step 2: Setup offscreen renderer
      const targetWidth = project.resolution.width;
      const targetHeight = project.resolution.height;
      const renderWidth = targetWidth;
      const renderHeight = targetHeight;
      const fps = Math.max(1, Math.round(options.fps));
      const durationSec = Math.max(0, project.durationSec);
      const totalFrames = Math.max(1, Math.round(durationSec * fps));
      const startSec = Math.max(0, project.audio.startOffsetSec ?? 0);

      exportStore.startExport(totalFrames);

      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = renderWidth;
      canvas.height = renderHeight;

      this.offscreenApp = new PixiApp({
        canvas,
        width: renderWidth,
        height: renderHeight,
        backgroundColor: parseInt(project.settings.backgroundColor.replace('#', ''), 16) || 0x0c0c14,
        resolution: 1, // 1:1 pixels for export, no DPI scaling
        autoDensity: false,
        preserveDrawingBuffer: true, // keep buffer readable for captureStream/drawImage
      });
      await this.offscreenApp.init();
      // Stop the internal PixiJS ticker for the offscreen renderer.
      // By default PIXI.Application auto-starts a ticker that calls app.render() at 60 fps.
      // For export we drive rendering manually frame-by-frame, so the auto-ticker would
      // only double the GPU work and compete with the live preview renderer at 4K.
      this.offscreenApp.app.ticker.stop();
      this.auditExportRenderer(renderWidth, renderHeight, project.settings.previewScale);

      // Load visual textures into the export renderer
      const visualAssets = project.assets.filter((a) => a.type === 'image' || a.type === 'video');
      for (const asset of visualAssets) {
        this.offscreenApp.resources.registerUrl(asset.id, asset.relPath, asset.type === 'video' ? 'video' : 'image', Boolean(asset.metadata?.animated));
        try {
          await this.offscreenApp.resources.loadTexture(asset.id);
        } catch (e) {
          console.warn('Export: texture load failed for', asset.name, e);
        }
      }
      this.auditImageLayerQuality(project, targetWidth, targetHeight);

      this.offscreenApp.syncLayers(project.layers);

      // Step 3: Record
      if (isTauri()) {
        await this.exportViaTauri(
          project,
          outputPath,
          totalFrames,
          fps,
          targetWidth,
          targetHeight,
          startSec,
          options,
        );
      } else {
        await this.exportViaDownload(project, outputPath, totalFrames, fps, targetWidth, targetHeight, audioUrl, options);
      }

      if (!this.cancelled) {
        exportStore.setStatus('done');
      } else {
        exportStore.setStatus('cancelled');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      if (this.cancelled) {
        exportStore.setStatus('cancelled');
      } else {
        exportStore.setError(err.message || 'Export failed');
      }
    } finally {
      this.cleanup();
      this.cancelBackend = null;
    }
  }

  private async exportViaTauri(
    project: Project,
    outputPath: string,
    totalFrames: number,
    fps: number,
    width: number,
    height: number,
    startSec: number,
    options: ExportOptions,
  ): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    const exportStore = useExportStore.getState();
    this.cancelBackend = async () => {
      try {
        await invoke('cancel_export');
      } catch {
        // no-op: process may already be finalized or not started.
      }
    };

    const audioAsset = project.assets.find((a) => a.id === project.audio.assetId);
    if (!audioAsset) throw new Error('Audio asset not found');

    await invoke('start_export', {
      settings: {
        width,
        height,
        fps,
        total_frames: totalFrames,
        audio_path: audioAsset.relPath,
        output_path: outputPath,
        mode: options.mode,
      },
    });

    exportStore.setStatus('rendering');

    for (let frame = 0; frame < totalFrames; frame++) {
      if (this.cancelled) {
        await invoke('cancel_export');
        exportStore.setStatus('cancelled');
        return;
      }

      const t = startSec + frame / fps;
      const audioFrame = this.offlineAnalyzer.sampleAtTime(t);
      this.offscreenApp!.renderFrame(t, audioFrame, project.layers, { present: false, syncMediaTime: true });
      const expectedBytes = width * height * 4;
      const rgba = this.extractScaledPixels(width, height);
      if (rgba.length !== expectedBytes) {
        throw new Error(
          `Frame ${frame + 1}: invalid RGBA byte count ${rgba.length}, expected ${expectedBytes}`,
        );
      }
      await invoke('write_export_frame', {
        frame: rgba,
        frame_index: frame + 1,
      });

      exportStore.updateProgress(frame + 1);

      if (frame % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    exportStore.setStatus('encoding');
    if (this.cancelled) {
      await invoke('cancel_export');
      exportStore.setStatus('cancelled');
      return;
    }
    await invoke('finalize_export');

    exportStore.setResult({
      fileName: outputPath.split(/[\/]/).pop() || 'export.mp4',
      blob: null,
      savedPath: outputPath,
      downloadUrl: null,
      width,
      height,
    });
  }

  /**
   * Browser export using captureStream + MediaRecorder.
   * Records in real-time with audio, then triggers a download.
   */
  private async exportViaDownload(
    project: Project,
    outputPath: string,
    totalFrames: number,
    fps: number,
    width: number,
    height: number,
    audioUrl: string,
    options: ExportOptions,
  ): Promise<void> {
    const exportStore = useExportStore.getState();
    exportStore.setStatus('rendering');

    const sourceCanvas = this.offscreenApp!.getCanvas();
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = width;
    captureCanvas.height = height;
    const captureCtx = captureCanvas.getContext('2d');
    if (!captureCtx) {
      throw new Error('Failed to initialize export scaling context');
    }

    // Create capture stream with manual frame control
    const stream = captureCanvas.captureStream(0);

    // Decode audio and create a stream track
    let audioCtx: AudioContext | null = null;
    let audioSource: AudioBufferSourceNode | null = null;
    let audioClock: AudioWorkletNode | null = null;

    try {
      audioCtx = new AudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const dest = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioClock = await createAudioExportClock(audioCtx, fps, audioBuffer.numberOfChannels);
      audioSource.connect(audioClock);
      audioClock.connect(dest);

      // Add the audio track into the combined stream
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (e) {
      console.warn('Could not include audio in export:', e);
    }

    // Use MP4 codecs only.
    const mimeType = pickMimeType();

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: computeVideoBitrate(width, height, fps),
      audioBitsPerSecond: 192_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Start recording with a timeslice so encoded data is handed over in
    // small blobs as it is produced. Without a timeslice the recorder keeps
    // the entire video in a single in-page buffer until stop(), which grows
    // past several GB at 1440p/4K on long tracks and crashes the renderer
    // (white screen). Chunked blobs can be paged out by the browser instead.
    recorder.start(RECORDER_TIMESLICE_MS);

    // Start audio playback
    let audioClockStartedAt = 0;
    if (audioSource && audioCtx) {
      await audioCtx.resume();
      audioClockStartedAt = audioCtx.currentTime;
      audioSource.start(0);
    }

    // requestAnimationFrame stops when a browser tab or window is hidden. The
    // AudioWorklet clock above remains part of the actively recorded audio
    // graph, so it can keep driving video frames while another window covers
    // PulseForge. A timer is retained only as a silent-export fallback.
    const startWall = performance.now();
    const duration = project.durationSec;
    const videoTrack = stream.getVideoTracks()[0];
    let lastRenderedFrame = -1;
    let fallbackTimer: number | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const tick = () => {
          if (settled) return;
          if (this.cancelled) { finish(); return; }

          try {
            const elapsed = audioClock && audioCtx
              ? Math.max(0, audioCtx.currentTime - audioClockStartedAt)
              : Math.max(0, (performance.now() - startWall) / 1000);
            const targetFrame = Math.min(totalFrames - 1, Math.floor(elapsed * fps));

            // If rendering temporarily falls behind, jump to the current audio
            // frame instead of stretching the video or blocking to catch up.
            if (targetFrame > lastRenderedFrame) {
              const t = Math.min(targetFrame / fps, duration);
              const audioFrame = this.offlineAnalyzer.sampleAtTime(t);
              this.offscreenApp!.renderFrame(t, audioFrame, project.layers);
              captureCtx.drawImage(sourceCanvas, 0, 0, width, height);

              if ('requestFrame' in videoTrack) {
                (videoTrack as any).requestFrame();
              }

              lastRenderedFrame = targetFrame;
              exportStore.updateProgress(targetFrame + 1);
            }

            if (elapsed >= duration && lastRenderedFrame >= totalFrames - 1) {
              finish();
            }
          } catch (error) {
            if (settled) return;
            settled = true;
            reject(error);
          }
        };

        if (audioClock) {
          audioClock.port.onmessage = tick;
          tick();
        } else {
          fallbackTimer = window.setInterval(tick, Math.max(4, Math.floor(1000 / fps)));
          tick();
        }
      });
    } finally {
      if (audioClock) audioClock.port.onmessage = null;
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
    }

    // Stop audio
    if (audioSource) {
      try { audioSource.stop(); } catch { /* already stopped */ }
    }
    if (audioClock) audioClock.disconnect();
    if (audioCtx) {
      audioCtx.close();
    }

    // Stop recorder and wait for final data
    exportStore.setStatus('encoding');
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (this.cancelled) {
      exportStore.setStatus('cancelled');
      return;
    }

    // Build the output blob
    const blob = new Blob(chunks, { type: mimeType });
    const ext = mimeType.startsWith('video/webm') ? 'webm' : 'mp4';
    const fallbackName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.${ext}`;
    const baseName = (outputPath.split('/').pop() || fallbackName).replace(/\.\w+$/, `.${ext}`);

    // Try saving directly to the output/ folder via the Vite dev server middleware
    let savedPath: string | null = null;
    let downloadUrl: string | null = null;
    try {
      const response = await fetch('/api/save-export', {
        method: 'POST',
        headers: { 'Content-Type': mimeType, 'x-filename': baseName },
        body: blob,
      });
      if (response.ok) {
        const info = await response.json();
        savedPath = typeof info?.path === 'string' ? info.path : `output/${baseName}`;
        downloadUrl = typeof info?.downloadUrl === 'string' ? info.downloadUrl : null;
        console.info('[PulseForge] Export saved to', savedPath);
      } else {
        const message = await response.text();
        throw new Error(`Could not finalize the exported video${message ? `: ${message}` : ''}`);
      }
    } catch (error: any) {
      console.warn('[PulseForge] Could not save/finalize export:', error);
      throw new Error(
        `The recording finished, but PulseForge could not finalize it with duration and seek metadata: ${error?.message || error}`,
      );
    }

    // Prefer the finalized file URL so the large, fragmented recording blob
    // can be released before the user downloads it.
    exportStore.setResult({
      fileName: baseName,
      blob: downloadUrl ? null : blob,
      savedPath,
      downloadUrl,
      width,
      height,
    });

    // Download straight from the visualizer screen when requested, or when we
    // could not write to the output/ folder at all.
    if (options.autoDownload !== false || !savedPath) {
      if (downloadUrl) downloadVideoUrl(downloadUrl, baseName);
      else downloadVideoBlob(blob, baseName);
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.cancelBackend) {
      void this.cancelBackend();
    }
  }

  private cleanup(): void {
    if (this.offscreenApp) {
      this.offscreenApp.destroy();
      this.offscreenApp = null;
    }
    this.scaleCanvas = null;
    this.scaleCtx = null;
  }

  private auditExportRenderer(width: number, height: number, previewScale: number): void {
    if (!this.offscreenApp) return;
    const info = this.offscreenApp.getRenderAuditInfo();

    if (previewScale !== 1) {
      console.info(
        `Export audit: ignoring previewScale=${previewScale}. Export uses exact project resolution ${width}x${height}.`,
      );
    }

    const exactMatch =
      info.screenWidth === width &&
      info.screenHeight === height &&
      info.rendererWidth === width &&
      info.rendererHeight === height &&
      info.resolution === 1;

    if (!exactMatch) {
      throw new Error(
        `Export renderer mismatch. expected=${width}x${height}@1 screen=${info.screenWidth}x${info.screenHeight} ` +
        `renderer=${info.rendererWidth}x${info.rendererHeight} resolution=${info.resolution}`,
      );
    }

    if (info.stageScaleX !== 1 || info.stageScaleY !== 1) {
      console.warn(
        `Export audit: stage scale is ${info.stageScaleX}x${info.stageScaleY} (expected 1x1). ` +
        'Output may look soft if stage is globally scaled.',
      );
    }
  }

  private auditImageLayerQuality(project: Project, exportW: number, exportH: number): void {
    if (!this.offscreenApp) return;
    const warnedAssets = new Set<string>();

    for (const layer of project.layers) {
      if (!layer.enabled) continue;
      if (layer.kind !== 'background' && layer.kind !== 'logo') continue;
      if (!layer.assetId || warnedAssets.has(layer.assetId)) continue;

      const tex = this.offscreenApp.resources.getTexture(layer.assetId);
      if (!tex) continue;
      const src = (tex as any).source as { width?: number; height?: number; pixelWidth?: number; pixelHeight?: number } | undefined;
      const texW = Math.floor(src?.pixelWidth ?? src?.width ?? tex.width ?? 0);
      const texH = Math.floor(src?.pixelHeight ?? src?.height ?? tex.height ?? 0);

      if (layer.kind === 'background' && (texW < exportW || texH < exportH)) {
        console.warn(
          `Export warning: background asset "${layer.assetId}" is ${texW}x${texH}, below export ${exportW}x${exportH}; upscaling can look blurry.`,
        );
      }
      if (layer.kind === 'logo' && (texW <= 0 || texH <= 0)) {
        console.warn(`Export warning: logo asset "${layer.assetId}" has invalid texture size ${texW}x${texH}.`);
      }

      warnedAssets.add(layer.assetId);
    }
  }

  private extractScaledPixels(width: number, height: number): Uint8Array {
    if (!this.offscreenApp) throw new Error('Offscreen renderer not initialized');
    if (!this.scaleCanvas || this.scaleCanvas.width !== width || this.scaleCanvas.height !== height) {
      this.scaleCanvas = document.createElement('canvas');
      this.scaleCanvas.width = width;
      this.scaleCanvas.height = height;
      this.scaleCtx = this.scaleCanvas.getContext('2d', { willReadFrequently: true });
      if (!this.scaleCtx) {
        throw new Error('Failed to initialize export pixel scaler');
      }
    }
    this.scaleCtx!.drawImage(this.offscreenApp.getCanvas(), 0, 0, width, height);
    const imageData = this.scaleCtx!.getImageData(0, 0, width, height);
    return new Uint8Array(imageData.data);
  }

}

/**
 * Build an audio-thread clock that passes the export audio through unchanged
 * and notifies the main thread once per requested video frame. Audio worklets
 * continue servicing an active MediaStream recording when visual animation
 * callbacks are suspended for a hidden or occluded window.
 */
async function createAudioExportClock(
  context: AudioContext,
  fps: number,
  sourceChannels: number,
): Promise<AudioWorkletNode> {
  const processorSource = `
    class PulseForgeExportClock extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const fps = Math.max(1, Number(options.processorOptions?.fps) || 30);
        this.samplesPerTick = sampleRate / fps;
        this.samplesUntilTick = 0;
      }

      process(inputs, outputs) {
        const input = inputs[0] || [];
        const output = outputs[0] || [];
        for (let channel = 0; channel < output.length; channel++) {
          const source = input[Math.min(channel, Math.max(0, input.length - 1))];
          if (source) output[channel].set(source);
          else output[channel].fill(0);
        }

        const blockSize = output[0]?.length || 128;
        this.samplesUntilTick -= blockSize;
        if (this.samplesUntilTick <= 0) {
          this.port.postMessage(0);
          do this.samplesUntilTick += this.samplesPerTick;
          while (this.samplesUntilTick <= 0);
        }
        return true;
      }
    }

    registerProcessor('pulseforge-export-clock', PulseForgeExportClock);
  `;

  const moduleUrl = URL.createObjectURL(new Blob([processorSource], { type: 'text/javascript' }));
  try {
    await context.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  return new AudioWorkletNode(context, 'pulseforge-export-clock', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [Math.max(1, Math.min(2, sourceChannels))],
    processorOptions: { fps },
  });
}

/**
 * Pick the best supported MIME type for MediaRecorder.
 * Prefers MP4/H.264 but falls back to WebM (VP9/VP8) since many Electron
 * builds do not include H.264 in their MediaRecorder support.
 */
function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  throw new Error('No supported video codec found. Try running via the desktop (Tauri) export path.');
}

/** Recorder timeslice: how often MediaRecorder hands over an encoded chunk. */
const RECORDER_TIMESLICE_MS = 1000;

/**
 * Measured on Chromium's H.264 MediaRecorder: the encoder lands at roughly
 * 1.9x the requested bitrate for 720p/1080p, and the hardware encoder clamps
 * around 150 Mbps at 4K. Used for the file-size estimate.
 */
const ENCODER_OVERSHOOT = 1.9;
const ENCODER_ACTUAL_CAP = 160_000_000;

function computeVideoBitrate(width: number, height: number, fps: number): number {
  // Bits-per-pixel heuristic tuned for music visuals. A single curve for all
  // resolutions: the previous "high-res" branch made 1440p request more data
  // per second than 4K actually produced, which pushed the recording buffer
  // past renderer memory limits on long tracks.
  const pixelsPerSecond = Math.max(1, width * height * fps);
  const bpp = 0.32;
  const estimated = Math.round(pixelsPerSecond * bpp);
  return Math.max(12_000_000, Math.min(150_000_000, estimated));
}

export function estimateExportFileSizeBytes(
  width: number,
  height: number,
  fps: number,
  durationSec: number,
): number {
  const duration = Math.max(0, durationSec);
  const requested = computeVideoBitrate(width, height, fps);
  const actual = Math.min(ENCODER_ACTUAL_CAP, requested * ENCODER_OVERSHOOT);
  const videoBits = actual * duration;
  const audioBits = 192_000 * duration;
  return Math.round(((videoBits + audioBits) / 8) * 1.03);
}
