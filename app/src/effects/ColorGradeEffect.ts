import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { ColorGradeEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { audioTargetEnergy } from '../audio/reactivity';

/**
 * GPU color finishing for any layer. Hue can optionally drift with the
 * current audio energy while saturation, contrast, and brightness establish
 * the base grade.
 */
export class ColorGradeEffectRuntime implements RuntimeEffect<ColorGradeEffectConfig> {
  id: string;
  private config: ColorGradeEffectConfig;
  private filter: PIXI.ColorMatrixFilter | null = null;

  constructor(config: ColorGradeEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    this.filter = new PIXI.ColorMatrixFilter();
    this.filter.enabled = this.config.enabled;
  }

  updateConfig(config: ColorGradeEffectConfig): void {
    this.config = config;
    if (this.filter) this.filter.enabled = config.enabled;
  }

  beforeUpdate(_target: PIXI.Container, t: number, audio: AudioFrame): void {
    if (!this.filter) return;
    const audioHue = this.config.audioDriven
      ? audioTargetEnergy(audio, this.config.audioTarget) * sampleParam(this.config.audioAmount, t)
      : 0;

    this.filter.reset();
    this.filter.hue(sampleParam(this.config.hue, t) + audioHue, false);
    this.filter.saturate(sampleParam(this.config.saturation, t), true);
    this.filter.contrast(sampleParam(this.config.contrast, t), true);
    this.filter.brightness(sampleParam(this.config.brightness, t), true);
  }

  applyFilters(target: PIXI.Container): void {
    if (!this.filter) return;
    const existing = target.filters || [];
    if (!existing.includes(this.filter)) target.filters = [...existing, this.filter];
  }

  destroy(target: PIXI.Container): void {
    if (!this.filter) return;
    target.filters = (target.filters || []).filter((filter) => filter !== this.filter);
    this.filter.destroy();
    this.filter = null;
  }
}
