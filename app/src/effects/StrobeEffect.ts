import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { StrobeEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/**
 * Strobe/Shutter effect: opacity gating based on time.
 * alpha *= (fract(t * rateHz) < dutyCycle ? 1 : 0)
 * With optional soft edge for smoother transitions.
 */
export class StrobeEffectRuntime implements RuntimeEffect<StrobeEffectConfig> {
  id: string;
  private config: StrobeEffectConfig;

  constructor(config: StrobeEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {}
  updateConfig(config: StrobeEffectConfig): void { this.config = config; }

  beforeUpdate(target: PIXI.Container, t: number, _audio: AudioFrame): void {
    const rate = sampleParam(this.config.rateHz, t);
    const duty = sampleParam(this.config.dutyCycle, t);
    const softEdge = sampleParam(this.config.softEdge, t);

    const phase = (t * rate) % 1; // 0..1

    let alpha: number;
    if (softEdge > 0) {
      // Smooth transition
      if (phase < duty) {
        const fadeIn = Math.min(1, phase / softEdge);
        alpha = fadeIn;
      } else {
        const fadeOut = Math.max(0, 1 - (phase - duty) / softEdge);
        alpha = fadeOut;
      }
    } else {
      alpha = phase < duty ? 1 : 0;
    }

    target.alpha *= alpha;
  }

  applyFilters(_target: PIXI.Container): void {}

  destroy(_target: PIXI.Container): void {}
}
