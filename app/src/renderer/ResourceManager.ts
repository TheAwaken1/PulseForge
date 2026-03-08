import * as PIXI from 'pixi.js';

type LoadCallback = () => void;

/**
 * Manages loading and caching textures for project assets.
 * Notifies listeners when new textures become available.
 */
export class ResourceManager {
  private textures = new Map<string, PIXI.Texture>();
  private urls = new Map<string, string>();
  private loading = new Set<string>();
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

  registerUrl(assetId: string, url: string): void {
    this.urls.set(assetId, url);
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
      const texture = await this.loadImageAsTexture(url);
      this.textures.set(assetId, texture);
      this.loading.delete(assetId);
      this.notifyLoaded();
      return texture;
    } catch (e) {
      this.loading.delete(assetId);
      throw e;
    }
  }

  private loadImageAsTexture(url: string): Promise<PIXI.Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const texture = PIXI.Texture.from(img);
          this.configureTextureSampling(texture);
          resolve(texture);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
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
  }

  dispose(): void {
    for (const [, tex] of this.textures) {
      tex.destroy(true);
    }
    this.textures.clear();
    this.urls.clear();
    this.listeners = [];
  }
}
