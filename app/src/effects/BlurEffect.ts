import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { BlurEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/**
 * Blur effect: applies Pixi's BlurFilter.
 */
export class BlurEffectRuntime implements RuntimeEffect<BlurEffectConfig> {
  id: string;
  private config: BlurEffectConfig;
  private filter: PIXI.BlurFilter | null = null;

  constructor(config: BlurEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  updateConfig(config: BlurEffectConfig): void { this.config = config; }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    this.filter = new PIXI.BlurFilter({
      strength: sampleParam(this.config.blur, 0),
      quality: sampleParam(this.config.quality, 0),
    });
  }

  beforeUpdate(_target: PIXI.Container, t: number, _audio: AudioFrame): void {
    if (this.filter) {
      this.filter.strength = sampleParam(this.config.blur, t);
      this.filter.quality = sampleParam(this.config.quality, t);
    }
  }

  applyFilters(target: PIXI.Container): void {
    if (!this.filter) return;
    const existing = target.filters || [];
    if (!existing.includes(this.filter)) {
      target.filters = [...existing, this.filter];
    }
  }

  destroy(target: PIXI.Container): void {
    if (this.filter && target.filters) {
      target.filters = target.filters.filter((f) => f !== this.filter);
      this.filter.destroy();
      this.filter = null;
    }
  }
}
