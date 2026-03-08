import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { BackgroundLayerConfig } from '../types/project';

export class BackgroundLayerRuntime implements RuntimeLayer<BackgroundLayerConfig> {
  id: string;
  container: PIXI.Container;
  private sprite: PIXI.Sprite | null = null;
  private config: BackgroundLayerConfig;
  private currentAssetId = '';

  constructor(config: BackgroundLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
  }

  init(ctx: RenderContext): void {
    this.tryCreateSprite(ctx);
  }

  updateConfig(config: BackgroundLayerConfig): void {
    const oldAssetId = this.config.assetId;
    this.config = config;
    if (config.assetId !== oldAssetId) {
      this.destroySprite();
    }
  }

  update(ctx: RenderContext, _t: number, _audio: AudioFrame): void {
    if (!this.sprite || this.currentAssetId !== this.config.assetId) {
      this.destroySprite();
      this.tryCreateSprite(ctx);
    }
    if (this.sprite) {
      this.fitSprite(ctx.width, ctx.height);
    }
  }

  private tryCreateSprite(ctx: RenderContext): void {
    if (!this.config.assetId) return;
    const texture = ctx.getTexture(this.config.assetId);
    if (texture) {
      this.sprite = new PIXI.Sprite(texture);
      this.container.addChild(this.sprite);
      this.currentAssetId = this.config.assetId;
      this.fitSprite(ctx.width, ctx.height);
    }
  }

  private destroySprite(): void {
    if (this.sprite) {
      this.container.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    this.currentAssetId = '';
  }

  private fitSprite(canvasW: number, canvasH: number): void {
    if (!this.sprite || !this.sprite.texture) return;
    const texW = this.sprite.texture.width;
    const texH = this.sprite.texture.height;
    if (texW <= 0 || texH <= 0) return;

    switch (this.config.fit) {
      case 'cover': {
        const scale = Math.max(canvasW / texW, canvasH / texH);
        this.sprite.width = texW * scale;
        this.sprite.height = texH * scale;
        this.sprite.x = (canvasW - this.sprite.width) / 2;
        this.sprite.y = (canvasH - this.sprite.height) / 2;
        break;
      }
      case 'contain': {
        const scale = Math.min(canvasW / texW, canvasH / texH);
        this.sprite.width = texW * scale;
        this.sprite.height = texH * scale;
        this.sprite.x = (canvasW - this.sprite.width) / 2;
        this.sprite.y = (canvasH - this.sprite.height) / 2;
        break;
      }
      case 'stretch':
        this.sprite.width = canvasW;
        this.sprite.height = canvasH;
        this.sprite.x = 0;
        this.sprite.y = 0;
        break;
    }
  }

  destroy(): void {
    this.destroySprite();
    this.container.destroy({ children: true });
  }
}
