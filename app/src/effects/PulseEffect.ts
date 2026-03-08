import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { PulseEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/**
 * Pulse effect: scale pulse driven by audio RMS.
 * scale = baseScale + rms * audioAmount
 */
export class PulseEffectRuntime implements RuntimeEffect<PulseEffectConfig> {
  id: string;
  private config: PulseEffectConfig;
  private smoothedRms = 0;

  constructor(config: PulseEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {}
  updateConfig(config: PulseEffectConfig): void { this.config = config; }

  beforeUpdate(target: PIXI.Container, t: number, audio: AudioFrame): void {
    const baseAdd = sampleParam(this.config.baseScaleAdd, t);
    const audioAmount = sampleParam(this.config.audioAmount, t);
    const smoothing = sampleParam(this.config.smoothing, t);

    // Smooth the RMS
    this.smoothedRms += (audio.rms - this.smoothedRms) * smoothing;

    const scaleAdd = baseAdd + this.smoothedRms * audioAmount;
    target.scale.x += scaleAdd;
    target.scale.y += scaleAdd;
  }

  applyFilters(_target: PIXI.Container): void {}

  destroy(_target: PIXI.Container): void {}
}
