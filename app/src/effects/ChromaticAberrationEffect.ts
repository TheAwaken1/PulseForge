import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { ChromaticAberrationEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { audioTargetEnergy } from '../audio/reactivity';

/**
 * Chromatic Aberration effect: simulates RGB channel offset
 * by applying a slight position jitter to the container.
 * A full GPU implementation would require pixi-filters.
 */
export class ChromaticAberrationEffectRuntime implements RuntimeEffect<ChromaticAberrationEffectConfig> {
  id: string;
  private config: ChromaticAberrationEffectConfig;

  constructor(config: ChromaticAberrationEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {}
  updateConfig(config: ChromaticAberrationEffectConfig): void { this.config = config; }

  beforeUpdate(target: PIXI.Container, t: number, audio: AudioFrame): void {
    let amount = sampleParam(this.config.amountPx, t);
    const angle = sampleParam(this.config.angle, t);

    if (this.config.audioDriven) {
      amount *= audioTargetEnergy(audio, this.config.audioTarget);
    }

    // Simulate chromatic aberration as subtle position offset
    const offsetX = Math.cos(angle) * amount * 0.3;
    const offsetY = Math.sin(angle) * amount * 0.3;
    target.x += offsetX;
    target.y += offsetY;
  }

  applyFilters(_target: PIXI.Container): void {}

  destroy(_target: PIXI.Container): void {}
}
