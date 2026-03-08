import { PixiApp } from '../renderer/PixiApp';
import { OfflineAnalyzer } from '../audio/OfflineAnalyzer';
import { useExportStore } from '../state/exportStore';
import type { Project } from '../types/project';

export type ExportQualityMode = 'compatibility' | 'crisp';

export interface ExportOptions {
  fps: number;
  mode: ExportQualityMode;
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

      // Load image textures into the export renderer
      const imageAssets = project.assets.filter((a) => a.type === 'image');
      for (const asset of imageAssets) {
        this.offscreenApp.resources.registerUrl(asset.id, asset.relPath);
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
        await this.exportViaDownload(project, outputPath, totalFrames, fps, targetWidth, targetHeight, audioUrl);
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
      this.offscreenApp!.renderFrame(t, audioFrame, project.layers, { present: false });
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

    try {
      audioCtx = new AudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const dest = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(dest);

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

    // Start recording
    recorder.start();

    // Start audio playback
    if (audioSource && audioCtx) {
      audioSource.start(0);
    }

    // Render frames one at a time per animation frame to keep the browser responsive.
    // The previous while-loop catch-up pattern could block the event loop for many
    // seconds on complex / high-resolution scenes, causing the browser tab to freeze
    // (appearing as a white screen). Rendering at most one frame per rAF tick prevents
    // that while still maintaining correct wall-clock timing for A/V sync.
    const duration = project.durationSec;
    const videoTrack = stream.getVideoTracks()[0];
    const startWall = performance.now();
    let frame = 0;

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.cancelled) {
          resolve();
          return;
        }

        if (frame >= totalFrames) {
          resolve();
          return;
        }

        const elapsed = (performance.now() - startWall) / 1000;
        // Only render when it's time for the next frame according to wall clock.
        // At most one frame per rAF tick — never block the event loop.
        if (frame <= Math.floor(elapsed * fps)) {
          const t = Math.min(frame / fps, duration);
          const audioFrame = this.offlineAnalyzer.sampleAtTime(t);
          this.offscreenApp!.renderFrame(t, audioFrame, project.layers);
          captureCtx.drawImage(sourceCanvas, 0, 0, width, height);

          if ('requestFrame' in videoTrack) {
            (videoTrack as any).requestFrame();
          }

          frame++;
          exportStore.updateProgress(frame);
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });

    // Stop audio
    if (audioSource) {
      try { audioSource.stop(); } catch { /* already stopped */ }
    }
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
    let savedToServer = false;
    try {
      const response = await fetch('/api/save-export', {
        method: 'POST',
        headers: { 'Content-Type': mimeType, 'x-filename': baseName },
        body: blob,
      });
      if (response.ok) {
        savedToServer = true;
        console.info('[PulseForge] Export saved to output/', baseName);
      }
    } catch {
      // Dev server endpoint not available — fall through to browser download
    }

    if (!savedToServer) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = baseName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
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

function computeVideoBitrate(width: number, height: number, fps: number): number {
  // Bits-per-pixel heuristic tuned for music visuals.
  // 4K particle-heavy scenes need more bitrate to avoid soft/blocky dots.
  const pixelsPerSecond = Math.max(1, width * height * fps);
  const isHighRes = width >= 2560 || height >= 1440;
  const bpp = isHighRes ? 0.55 : 0.35;
  const estimated = Math.round(pixelsPerSecond * bpp);
  const maxCap = isHighRes ? 220_000_000 : 140_000_000;
  return Math.max(12_000_000, Math.min(maxCap, estimated));
}

export function estimateExportFileSizeBytes(
  width: number,
  height: number,
  fps: number,
  durationSec: number,
): number {
  const duration = Math.max(0, durationSec);
  const videoBits = computeVideoBitrate(width, height, fps) * duration;
  const audioBits = 192_000 * duration;
  return Math.round(((videoBits + audioBits) / 8) * 1.03);
}
