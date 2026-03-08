import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { LogoLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './layerUtils';

/**
 * Vizzy-style Logo Layer with frame masking, auto-fit, and optional border ring.
 *
 * Container structure:
 *   container
 *     ├── maskGraphic    (Graphics – clip mask)
 *     ├── contentContainer (Container – masked)
 *     │     └── sprite   (Sprite)
 *     └── borderGraphic  (Graphics – stroke overlay, not masked)
 */
export class LogoLayerRuntime implements RuntimeLayer<LogoLayerConfig> {
  id: string;
  container: PIXI.Container;

  private maskGraphic: PIXI.Graphics;
  private contentContainer: PIXI.Container;
  private borderGraphic: PIXI.Graphics;
  private sprite: PIXI.Sprite | null = null;

  private config: LogoLayerConfig;
  private currentAssetId = '';
  private lastRefitSeq = 0;

  constructor(config: LogoLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.lastRefitSeq = config._refitSeq ?? 0;

    this.container = new PIXI.Container();

    // Mask graphic – filled shape used as stencil
    this.maskGraphic = new PIXI.Graphics();
    this.container.addChild(this.maskGraphic);

    // Content sits behind the mask
    this.contentContainer = new PIXI.Container();
    this.contentContainer.mask = this.maskGraphic;
    this.container.addChild(this.contentContainer);

    // Border overlay – drawn on top, not masked
    this.borderGraphic = new PIXI.Graphics();
    this.container.addChild(this.borderGraphic);
  }

  init(ctx: RenderContext): void {
    this.tryCreateSprite(ctx);
  }

  updateConfig(config: LogoLayerConfig): void {
    const oldAssetId = this.config.assetId;
    this.config = config;
    if (config.assetId !== oldAssetId) {
      this.destroySprite();
    }
  }

  update(ctx: RenderContext, t: number, _audio: AudioFrame): void {
    const assetChanged = this.currentAssetId !== this.config.assetId;

    // Create sprite if needed
    if (!this.sprite || assetChanged) {
      this.destroySprite();
      this.tryCreateSprite(ctx);
    }

    // Track refit seq (no-op now — scale is always computed dynamically)
    this.lastRefitSeq = this.config._refitSeq ?? 0;

    // Sample params
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const frameSize = sampleParam(this.config.frameSize, t) * designScale;
    const padding = sampleParam(this.config.padding, t) * designScale;
    const cornerRadius = sampleParam(this.config.cornerRadius, t) * designScale;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;

    const innerSize = Math.max(1, frameSize - padding * 2);

    // Toggle mask — 'none' frame shows the image unclipped
    if (this.config.frameShape === 'none') {
      this.contentContainer.mask = null;
    } else {
      this.contentContainer.mask = this.maskGraphic;
      this.drawMask(cx, cy, innerSize, cornerRadius);
    }

    // Update sprite — scale is computed dynamically so it always fills the frame
    if (this.sprite) {
      this.sprite.anchor.set(0.5);
      this.sprite.x = cx;
      this.sprite.y = cy;
      this.sprite.rotation = 0;

      const imgW = this.sprite.texture.width;
      const imgH = this.sprite.texture.height;
      if (imgW > 0 && imgH > 0) {
        const sx = innerSize / imgW;
        const sy = innerSize / imgH;
        if (this.config.frameShape === 'none' || this.config.fitMode === 'contain') {
          // contain: full image visible, may leave empty space inside frame
          this.sprite.scale.set(Math.min(sx, sy));
        } else if (this.config.fitMode === 'fill') {
          // fill: stretch image to exactly fill the frame bounding box — entire image
          // visible, circle mask clips only the corners, no empty space inside circle
          this.sprite.scale.x = sx;
          this.sprite.scale.y = sy;
        } else {
          // cover: uniform scale to fill, clips overflow
          this.sprite.scale.set(Math.max(sx, sy));
        }
      }
    }

    // Update border
    this.drawBorder(cx, cy, frameSize, cornerRadius, t, designScale);
  }

  private tryCreateSprite(ctx: RenderContext): void {
    if (!this.config.assetId) return;
    const texture = ctx.getTexture(this.config.assetId);
    if (texture) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.contentContainer.addChild(this.sprite);
      this.currentAssetId = this.config.assetId;
    }
  }

  private drawMask(cx: number, cy: number, innerSize: number, cornerRadius: number): void {
    const g = this.maskGraphic;
    g.clear();

    const half = innerSize / 2;
    switch (this.config.frameShape) {
      case 'circle':
        g.circle(cx, cy, half);
        break;
      case 'square':
        g.rect(cx - half, cy - half, innerSize, innerSize);
        break;
      case 'rounded': {
        const cr = Math.min(cornerRadius, half);
        g.roundRect(cx - half, cy - half, innerSize, innerSize, cr);
        break;
      }
    }
    g.fill({ color: 0xffffff });
  }

  private blurFilter: PIXI.BlurFilter | null = null;

  private drawBorder(
    cx: number, cy: number, frameSize: number, cornerRadius: number, t: number, designScale: number,
  ): void {
    const g = this.borderGraphic;
    g.clear();

    if (!this.config.border.enabled) {
      this.removeGlowFilter();
      return;
    }

    const bw = sampleParam(this.config.border.width, t) * designScale;
    const colorStr = sampleParam(this.config.border.color, t);
    const colorNum = parseInt(colorStr.replace('#', ''), 16) || 0xffffff;

    if (bw <= 0) {
      this.removeGlowFilter();
      return;
    }

    const half = frameSize / 2;

    // If glow enabled, draw a wider semi-transparent stroke first
    if (this.config.border.glow) {
      this.drawShape(g, cx, cy, half, frameSize, cornerRadius);
      g.stroke({ width: bw + 8, color: colorNum, alpha: 0.3 });

      // Apply blur filter for soft glow effect
      if (!this.blurFilter) {
        this.blurFilter = new PIXI.BlurFilter({ strength: 6, quality: 2 });
      }
      const existing = g.filters || [];
      if (!existing.includes(this.blurFilter)) {
        g.filters = [...existing, this.blurFilter];
      }
    } else {
      this.removeGlowFilter();
    }

    // Main border stroke
    this.drawShape(g, cx, cy, half, frameSize, cornerRadius);
    g.stroke({ width: bw, color: colorNum });
  }

  private drawShape(
    g: PIXI.Graphics, cx: number, cy: number, half: number, size: number, cornerRadius: number,
  ): void {
    switch (this.config.frameShape) {
      case 'circle':
        g.circle(cx, cy, half);
        break;
      case 'square':
        g.rect(cx - half, cy - half, size, size);
        break;
      case 'rounded': {
        const cr = Math.min(cornerRadius, half);
        g.roundRect(cx - half, cy - half, size, size, cr);
        break;
      }
    }
  }

  private removeGlowFilter(): void {
    if (this.blurFilter) {
      const existing = this.borderGraphic.filters || [];
      this.borderGraphic.filters = existing.filter((f) => f !== this.blurFilter);
      this.blurFilter.destroy();
      this.blurFilter = null;
    }
  }

  private destroySprite(): void {
    if (this.sprite) {
      this.contentContainer.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    this.currentAssetId = '';
  }

  destroy(): void {
    this.destroySprite();
    this.removeGlowFilter();
    this.maskGraphic.destroy();
    this.borderGraphic.destroy();
    this.contentContainer.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
