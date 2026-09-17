import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { ResourceManager } from './ResourceManager';
import type { LayerAny } from '../types/project';
import type { AudioFrame } from '../types/audio';

export interface PixiAppOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor?: number;
  /** Override resolution (default: window.devicePixelRatio). Use 1 for export. */
  resolution?: number;
  /** Disable CSS density scaling for deterministic offscreen/export rendering. */
  autoDensity?: boolean;
  /**
   * Keep the WebGL drawing buffer after compositing (default: false).
   * Set to true for offscreen export so captureStream/drawImage can read
   * the rendered frame reliably after app.render() returns.
   */
  preserveDrawingBuffer?: boolean;
}

export class PixiApp {
  app!: PIXI.Application;
  scene!: SceneManager;
  resources: ResourceManager;
  private initialized = false;
  private canvas: HTMLCanvasElement;
  private targetWidth: number;
  private targetHeight: number;
  private bgColor: number;
  private resolution: number;
  private autoDensity: boolean;
  private preserveDrawingBuffer: boolean;
  private readbackTexture: PIXI.RenderTexture | null = null;

  constructor(opts: PixiAppOptions) {
    this.canvas = opts.canvas;
    this.targetWidth = opts.width;
    this.targetHeight = opts.height;
    this.bgColor = opts.backgroundColor ?? 0x0c0c14;
    this.resolution = opts.resolution ?? (window.devicePixelRatio || 1);
    this.autoDensity = opts.autoDensity ?? true;
    this.preserveDrawingBuffer = opts.preserveDrawingBuffer ?? false;
    this.resources = new ResourceManager();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width: this.targetWidth,
      height: this.targetHeight,
      backgroundColor: this.bgColor,
      antialias: true,
      autoDensity: this.autoDensity,
      resolution: this.resolution,
      preserveDrawingBuffer: this.preserveDrawingBuffer,
    } as any);

    if (!this.autoDensity) {
      this.canvas.style.width = `${this.targetWidth}px`;
      this.canvas.style.height = `${this.targetHeight}px`;
    }

    this.ensureReadbackTexture(this.targetWidth, this.targetHeight);
    this.scene = new SceneManager(this.app, this.resources);
    this.initialized = true;
  }

  get isReady(): boolean {
    return this.initialized;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  get width(): number {
    return this.app?.screen?.width ?? this.targetWidth;
  }

  get height(): number {
    return this.app?.screen?.height ?? this.targetHeight;
  }

  resize(width: number, height: number): void {
    if (!this.initialized || width <= 0 || height <= 0) return;
    this.targetWidth = width;
    this.targetHeight = height;
    this.app.renderer.resize(width, height);
    if (!this.autoDensity) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    this.ensureReadbackTexture(width, height);
  }

  syncLayers(layers: LayerAny[]): void {
    if (!this.initialized) return;
    this.scene.syncLayers(layers);
  }

  renderFrame(
    t: number,
    audio: AudioFrame,
    layers: LayerAny[],
    opts?: { present?: boolean; syncMediaTime?: boolean },
  ): void {
    if (!this.initialized) return;
    this.resources.updateAnimatedTextures(t, opts?.syncMediaTime ?? false);
    this.scene.update(t, audio, layers);
    if (opts?.present ?? true) {
      this.app.render();
    }
  }

  extractPixels(expectedByteLength?: number): Uint8Array {
    const renderer = this.app.renderer as PIXI.Renderer;
    const { width, height } = this.app.screen;
    this.ensureReadbackTexture(width, height);
    renderer.render({ container: this.app.stage, target: this.readbackTexture!, clear: true });
    const extracted = (renderer as any).extract.pixels(this.readbackTexture);
    const pixels = this.normalizeExtractedPixels(extracted);
    const expected = expectedByteLength ?? (Math.floor(width) * Math.floor(height) * 4);
    if (pixels.length !== expected) {
      throw new Error(
        `RGBA extraction size mismatch: got ${pixels.length}, expected ${expected} (${width}x${height}x4)`,
      );
    }
    return pixels;
  }

  getRenderAuditInfo(): {
    screenWidth: number;
    screenHeight: number;
    rendererWidth: number;
    rendererHeight: number;
    stageScaleX: number;
    stageScaleY: number;
    resolution: number;
  } {
    return {
      screenWidth: Math.floor(this.app.screen.width),
      screenHeight: Math.floor(this.app.screen.height),
      rendererWidth: Math.floor(this.app.renderer.width),
      rendererHeight: Math.floor(this.app.renderer.height),
      stageScaleX: this.app.stage.scale.x,
      stageScaleY: this.app.stage.scale.y,
      resolution: this.app.renderer.resolution,
    };
  }

  /**
   * Renders the current stage to an offscreen canvas and returns it.
   * Unlike canvas.toDataURL() on the main WebGL canvas, this does not require
   * preserveDrawingBuffer and always returns the actual last-rendered frame.
   */
  getSnapshotCanvas(): HTMLCanvasElement | null {
    if (!this.initialized) return null;
    const renderer = this.app.renderer as PIXI.Renderer;
    const { width, height } = this.app.screen;
    this.ensureReadbackTexture(width, height);
    try {
      renderer.render({ container: this.app.stage, target: this.readbackTexture!, clear: true });
      const c = (renderer as any).extract.canvas(this.readbackTexture) as HTMLCanvasElement | null;
      return c ?? null;
    } catch {
      return null;
    }
  }

  private ensureReadbackTexture(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.readbackTexture && this.readbackTexture.width === w && this.readbackTexture.height === h) {
      return;
    }
    if (this.readbackTexture) {
      this.readbackTexture.destroy(true);
      this.readbackTexture = null;
    }
    this.readbackTexture = PIXI.RenderTexture.create({ width: w, height: h, resolution: 1 });
  }

  private normalizeExtractedPixels(extracted: unknown): Uint8Array {
    if (extracted instanceof Uint8Array) return extracted;
    if (ArrayBuffer.isView(extracted)) {
      const view = extracted as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    if (Array.isArray(extracted)) {
      return Uint8Array.from(extracted as number[]);
    }
    const maybe = extracted as { pixels?: unknown };
    if (maybe?.pixels !== undefined) {
      return this.normalizeExtractedPixels(maybe.pixels);
    }
    throw new Error('Failed to normalize extracted Pixi RGBA pixels');
  }

  destroy(): void {
    if (!this.initialized) return;
    if (this.readbackTexture) {
      this.readbackTexture.destroy(true);
      this.readbackTexture = null;
    }
    this.scene.destroy();
    this.resources.dispose();
    // Null out the WEBGL_lose_context extension before destroying.
    // PixiJS's GlContextSystem.destroy() explicitly calls loseContext() to free GPU
    // memory, but this can cause the browser to evict OTHER WebGL contexts (e.g. the
    // live preview canvas) under memory pressure — especially severe at 4K.
    // Clearing the extension makes the call a no-op; the GPU memory is still freed
    // when the WebGL context is garbage-collected after this app is torn down.
    try {
      const ctx = (this.app.renderer as any).context;
      if (ctx?.extensions) ctx.extensions.loseContext = null;
    } catch { /* best-effort */ }
    // Pass (false, false) so PixiJS does NOT call GlobalResourceRegistry.release(),
    // which would clear the global TexturePool and corrupt the live preview renderer.
    this.app.destroy(false, false);
    this.initialized = false;
  }
}
