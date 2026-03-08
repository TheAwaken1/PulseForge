import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { GradientMapEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

// Gradient map shader: maps pixel luminance to a color gradient
const FRAG_SHADER = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uGradient;

void main() {
    vec4 color = texture2D(uTexture, vTextureCoord);
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec4 mapped = texture2D(uGradient, vec2(luminance, 0.5));
    gl_FragColor = vec4(mapped.rgb, color.a);
}
`;

/**
 * Gradient Map effect: maps pixel intensity to a user-defined gradient.
 * Useful for colorizing spectrum bars with multi-color gradients.
 */
export class GradientMapEffectRuntime implements RuntimeEffect<GradientMapEffectConfig> {
  id: string;
  private config: GradientMapEffectConfig;
  private filter: PIXI.Filter | null = null;
  private gradientTexture: PIXI.Texture | null = null;

  constructor(config: GradientMapEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  updateConfig(config: GradientMapEffectConfig): void { this.config = config; }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    this.updateGradientTexture(0);
  }

  private updateGradientTexture(t: number): void {
    const stops = sampleParam(this.config.stops, t);
    if (!stops || stops.length === 0) return;

    // Create a 256x1 gradient texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx2d = canvas.getContext('2d')!;
    const gradient = ctx2d.createLinearGradient(0, 0, 256, 0);

    for (const stop of stops) {
      gradient.addColorStop(stop.pos, stop.color);
    }

    ctx2d.fillStyle = gradient;
    ctx2d.fillRect(0, 0, 256, 1);

    if (this.gradientTexture) {
      this.gradientTexture.destroy(true);
    }
    this.gradientTexture = PIXI.Texture.from(canvas);
  }

  beforeUpdate(_target: PIXI.Container, _t: number, _audio: AudioFrame): void {
    // Gradient doesn't change per frame in V1
  }

  applyFilters(target: PIXI.Container): void {
    // Gradient map is complex to apply via custom Filter in Pixi v8
    // For V1, we skip actual filter attachment and note this as a TODO
    // In production, this would use a proper Pixi v8 custom filter
  }

  destroy(target: PIXI.Container): void {
    if (this.gradientTexture) {
      this.gradientTexture.destroy(true);
      this.gradientTexture = null;
    }
    if (this.filter && target.filters) {
      target.filters = target.filters.filter((f) => f !== this.filter);
      this.filter = null;
    }
  }
}
