import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { GlowEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/**
 * Glow effect using Pixi's built-in blur filter with additive blending
 * to simulate outer glow. A proper GlowFilter would use
 * pixi-filters, but we implement a lightweight version here.
 */
export class GlowEffectRuntime implements RuntimeEffect<GlowEffectConfig> {
  id: string;
  private config: GlowEffectConfig;
  private blurFilter: PIXI.BlurFilter | null = null;

  constructor(config: GlowEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  updateConfig(config: GlowEffectConfig): void { this.config = config; }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    this.blurFilter = new PIXI.BlurFilter({
      strength: sampleParam(this.config.distance, 0),
      quality: sampleParam(this.config.quality, 0),
    });
  }

  beforeUpdate(_target: PIXI.Container, t: number, _audio: AudioFrame): void {
    if (this.blurFilter) {
      this.blurFilter.strength = sampleParam(this.config.distance, t);
      this.blurFilter.quality = sampleParam(this.config.quality, t);
    }
  }

  applyFilters(target: PIXI.Container): void {
    if (!this.blurFilter) return;

    const existing = target.filters || [];
    if (!existing.includes(this.blurFilter)) {
      target.filters = [...existing, this.blurFilter];
    }
  }

  destroy(target: PIXI.Container): void {
    if (this.blurFilter && target.filters) {
      target.filters = target.filters.filter((f) => f !== this.blurFilter);
      this.blurFilter.destroy();
      this.blurFilter = null;
    }
  }
}
