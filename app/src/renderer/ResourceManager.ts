import * as PIXI from 'pixi.js';
import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js';

type LoadCallback = () => void;
type MediaSource = HTMLImageElement | HTMLVideoElement;
type GifAnimation = {
  frames: HTMLCanvasElement[];
  durations: number[];
  totalDuration: number;
};

/**
 * Manages loading and caching textures for project assets.
 * Notifies listeners when new textures become available.
 */
export class ResourceManager {
  private textures = new Map<string, PIXI.Texture>();
  private urls = new Map<string, string>();
  private loading = new Set<string>();
  private animatedSources = new Map<string, MediaSource>();
  private animatedCanvases = new Map<string, HTMLCanvasElement>();
  private gifAnimations = new Map<string, GifAnimation>();
  private animatedAssets = new Set<string>();
  private listeners: LoadCallback[] = [];

  /** Subscribe to texture load events. Returns unsubscribe fn. */
  onTextureLoaded(cb: LoadCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyLoaded(): void {
    for (const cb of this.listeners) cb();
  }

  registerUrl(assetId: string, url: string, type: 'image' | 'video' = 'image', animated = false): void {
    this.urls.set(assetId, url);
    if (type === 'video') this.videoAssets.add(assetId);
    if (type === 'video' || animated) this.animatedAssets.add(assetId);
  }

  async loadTexture(assetId: string): Promise<PIXI.Texture> {
    const existing = this.textures.get(assetId);
    if (existing) return existing;
    if (this.loading.has(assetId)) {
      // Already loading, wait for it
      return new Promise((resolve) => {
        const unsub = this.onTextureLoaded(() => {
          const tex = this.textures.get(assetId);
          if (tex) { unsub(); resolve(tex); }
        });
      });
    }

    const url = this.urls.get(assetId);
    if (!url) throw new Error(`No URL registered for asset ${assetId}`);

    this.loading.add(assetId);
    try {
      // Load via HTMLImageElement to handle blob URLs (no file extension).
      // PIXI.Assets.load() can't determine file type from blob URLs.
      const texture = await this.loadMediaAsTexture(assetId, url);
      this.textures.set(assetId, texture);
      this.loading.delete(assetId);
      this.notifyLoaded();
      return texture;
    } catch (e) {
      this.loading.delete(assetId);
      throw e;
    }
  }

  private async loadMediaAsTexture(assetId: string, url: string): Promise<PIXI.Texture> {
    if (!this.videoAssets.has(assetId) && this.animatedAssets.has(assetId)) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const animation = this.decodeGif(buffer);
        if (animation) {
          this.gifAnimations.set(assetId, animation);
          this.animatedCanvases.set(assetId, animation.frames[0]);
          return PIXI.Texture.from(animation.frames[0]);
        }
      } catch (error) {
        console.warn('GIF decode failed, falling back to browser image decoding:', error);
      }
    }

    return new Promise((resolve, reject) => {
      const isVideo = this.videoAssets.has(assetId);
      const media: MediaSource = isVideo ? document.createElement('video') : new Image();
      if (isVideo) {
        const video = media as HTMLVideoElement;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
      } else {
        (media as HTMLImageElement).crossOrigin = 'anonymous';
      }
      const onReady = () => {
        try {
          const isAnimatedImage = !isVideo && this.animatedAssets.has(assetId);
          let textureSource: TexImageSource = media;
          if (isAnimatedImage) {
            const image = media as HTMLImageElement;
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext || canvas.width <= 0 || canvas.height <= 0) {
              throw new Error(`Failed to create animated image surface: ${url}`);
            }
            canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
            this.animatedCanvases.set(assetId, canvas);
            textureSource = canvas;
          }
          const texture = PIXI.Texture.from(textureSource);
          this.configureTextureSampling(texture);
          if (this.isAnimatedAsset(assetId, media)) this.animatedSources.set(assetId, media);
          if (isVideo) void (media as HTMLVideoElement).play().catch(() => undefined);
          resolve(texture);
        } catch (e) {
          reject(e);
        }
      };
      media.addEventListener(isVideo ? 'loadeddata' : 'load', onReady, { once: true });
      media.addEventListener('error', () => reject(new Error(`Failed to load media: ${url}`)), { once: true });
      media.src = url;
    });
  }

  private decodeGif(buffer: ArrayBuffer): GifAnimation | null {
    const parsed = parseGIF(buffer);
    const frames = decompressFrames(parsed, true).filter((frame): frame is ParsedFrame => 'patch' in frame);
    if (frames.length === 0 || parsed.lsd.width <= 0 || parsed.lsd.height <= 0) return null;

    const composite = document.createElement('canvas');
    composite.width = parsed.lsd.width;
    composite.height = parsed.lsd.height;
    const context = composite.getContext('2d');
    if (!context) return null;

    const canvases: HTMLCanvasElement[] = [];
    const durations: number[] = [];
    let totalDuration = 0;
    let previousFrame: ParsedFrame | null = null;
    let restoreCanvas: ImageData | null = null;

    for (const frame of frames) {
      if (previousFrame?.disposalType === 2) {
        context.clearRect(previousFrame.dims.left, previousFrame.dims.top, previousFrame.dims.width, previousFrame.dims.height);
      } else if (previousFrame?.disposalType === 3 && restoreCanvas) {
        context.putImageData(restoreCanvas, 0, 0);
      }

      restoreCanvas = frame.disposalType === 3 ? context.getImageData(0, 0, composite.width, composite.height) : null;
      const patch = new ImageData(
        frame.patch as unknown as Uint8ClampedArray<ArrayBuffer>,
        frame.dims.width,
        frame.dims.height,
      );
      context.putImageData(patch, frame.dims.left, frame.dims.top);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = composite.width;
      frameCanvas.height = composite.height;
      frameCanvas.getContext('2d')?.drawImage(composite, 0, 0);
      canvases.push(frameCanvas);

      const duration = Math.max(20, frame.delay || 100);
      durations.push(duration);
      totalDuration += duration;
      previousFrame = frame;
    }

    return { frames: canvases, durations, totalDuration };
  }

  private videoAssets = new Set<string>();

  private isAnimatedAsset(assetId: string, media: MediaSource): boolean {
    return media instanceof HTMLVideoElement || this.animatedAssets.has(assetId);
  }

  /** Refresh animated sources and optionally seek video sources for offline export. */
  updateAnimatedTextures(timeSec: number, forceVideoTime = false): void {
    const gifTimeMs = (forceVideoTime ? timeSec * 1000 : performance.now()) as number;
    for (const [assetId, animation] of this.gifAnimations) {
      let frameTime = animation.totalDuration > 0 ? gifTimeMs % animation.totalDuration : 0;
      let frameIndex = 0;
      for (let i = 0; i < animation.durations.length; i++) {
        if (frameTime < animation.durations[i]) {
          frameIndex = i;
          break;
        }
        frameTime -= animation.durations[i];
        frameIndex = i;
      }
      const target = this.animatedCanvases.get(assetId);
      const source = animation.frames[frameIndex];
      if (target && source && target !== source) {
        target.getContext('2d')?.drawImage(source, 0, 0);
        const texture = this.textures.get(assetId);
        const update = (texture as any)?.source?.update;
        if (typeof update === 'function') update.call((texture as any).source);
      }
    }

    for (const [assetId, source] of this.animatedSources) {
      if (source instanceof HTMLVideoElement && source.readyState >= 2) {
        if (forceVideoTime && source.duration > 0) {
          const target = timeSec % source.duration;
          if (Math.abs(source.currentTime - target) > 0.01) source.currentTime = target;
        } else if (source.paused) {
          void source.play().catch(() => undefined);
        }
      }
      const canvas = this.animatedCanvases.get(assetId);
      if (canvas && source instanceof HTMLImageElement) {
        const context = canvas.getContext('2d');
        if (context) context.drawImage(source, 0, 0, canvas.width, canvas.height);
      }
      const texture = this.textures.get(assetId);
      const update = (texture as any)?.source?.update;
      if (typeof update === 'function') update.call((texture as any).source);
    }
  }

  getTexture(assetId: string): PIXI.Texture | null {
    return this.textures.get(assetId) ?? null;
  }

  /**
   * Favor high-quality sampling in export/downscale paths.
   */
  private configureTextureSampling(texture: PIXI.Texture): void {
    const texAny = texture as any;
    const source = texAny.source as any;
    if (source) {
      if ('scaleMode' in source) source.scaleMode = 'linear';
      if ('mipmap' in source) source.mipmap = 'on';
      if ('autoGenerateMipmaps' in source) source.autoGenerateMipmaps = true;
      if (typeof source.updateMipmaps === 'function') {
        try { source.updateMipmaps(); } catch { /* no-op */ }
      }
    }

    const base = texAny.baseTexture as any;
    if (base) {
      if ('scaleMode' in base) base.scaleMode = PIXI.SCALE_MODES.LINEAR;
      if ('mipmap' in base) base.mipmap = 'on';
      if (typeof base.update === 'function') {
        try { base.update(); } catch { /* no-op */ }
      }
    }
  }

  hasTexture(assetId: string): boolean {
    return this.textures.has(assetId);
  }

  releaseTexture(assetId: string): void {
    const tex = this.textures.get(assetId);
    if (tex) {
      tex.destroy(true);
      this.textures.delete(assetId);
    }
    const source = this.animatedSources.get(assetId);
    if (source instanceof HTMLVideoElement) {
      source.pause();
      source.removeAttribute('src');
      source.load();
    }
    this.animatedSources.delete(assetId);
    this.animatedCanvases.delete(assetId);
    this.gifAnimations.delete(assetId);
    this.animatedAssets.delete(assetId);
    this.videoAssets.delete(assetId);
  }

  dispose(): void {
    for (const [, tex] of this.textures) {
      tex.destroy(true);
    }
    this.textures.clear();
    this.urls.clear();
    this.animatedSources.clear();
    this.animatedCanvases.clear();
    this.gifAnimations.clear();
    this.animatedAssets.clear();
    this.videoAssets.clear();
    this.listeners = [];
  }
}
