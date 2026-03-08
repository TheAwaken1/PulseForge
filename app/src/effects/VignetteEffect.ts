import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { VignetteEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/**
 * Vignette effect: darkens the edges of the frame.
 * Implemented as a Graphics overlay with a radial gradient.
 */
export class VignetteEffectRuntime implements RuntimeEffect<VignetteEffectConfig> {
  id: string;
  private config: VignetteEffectConfig;
  private overlay: PIXI.Graphics | null = null;

  constructor(config: VignetteEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  updateConfig(config: VignetteEffectConfig): void { this.config = config; }

  init(target: PIXI.Container, ctx: RenderContext): void {
    this.overlay = new PIXI.Graphics();
    target.addChild(this.overlay);
  }

  beforeUpdate(target: PIXI.Container, t: number, _audio: AudioFrame): void {
    if (!this.overlay) return;

    const strength = sampleParam(this.config.strength, t);
    const radius = sampleParam(this.config.radius, t);

    this.overlay.clear();

    // Draw a semi-transparent black rectangle with alpha based on distance from center
    // Using concentric ellipses to approximate radial gradient vignette
    const w = target.width || 1920;
    const h = target.height || 1080;
    const cx = w / 2;
    const cy = h / 2;
    const maxDim = Math.max(w, h);

    const steps = 20;
    for (let i = steps; i >= 0; i--) {
      const frac = i / steps;
      const alpha = frac > radius ? (frac - radius) / (1 - radius) * strength : 0;
      const rx = cx * (1 + frac);
      const ry = cy * (1 + frac);

      this.overlay
        .ellipse(cx, cy, rx, ry)
        .fill({ color: 0x000000, alpha: alpha * 0.05 });
    }
  }

  applyFilters(_target: PIXI.Container): void {}

  destroy(target: PIXI.Container): void {
    if (this.overlay) {
      target.removeChild(this.overlay);
      this.overlay.destroy();
      this.overlay = null;
    }
  }
}
