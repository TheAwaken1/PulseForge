import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { ShakeEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { audioTargetEnergy } from '../audio/reactivity';

/**
 * Shake effect: noise-driven position and rotation offsets.
 * Optionally driven by RMS for audio-reactive shaking.
 */
export class ShakeEffectRuntime implements RuntimeEffect<ShakeEffectConfig> {
  id: string;
  private config: ShakeEffectConfig;
  private originalX = 0;
  private originalY = 0;
  private originalRot = 0;

  constructor(config: ShakeEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {}
  updateConfig(config: ShakeEffectConfig): void { this.config = config; }

  beforeUpdate(target: PIXI.Container, t: number, audio: AudioFrame): void {
    const amountPx = sampleParam(this.config.amountPx, t);
    const amountRot = sampleParam(this.config.amountRot, t);
    const speed = sampleParam(this.config.speed, t);
    const audioAmount = sampleParam(this.config.audioAmount, t);

    const mult = this.config.audioDriven
      ? audioTargetEnergy(audio, this.config.audioTarget) * audioAmount
      : 1;

    // 2D noise-based offset
    const noiseX = (pseudoNoise(t * speed) - 0.5) * 2;
    const noiseY = (pseudoNoise(t * speed + 100) - 0.5) * 2;
    const noiseR = (pseudoNoise(t * speed + 200) - 0.5) * 2;

    target.x += noiseX * amountPx * mult;
    target.y += noiseY * amountPx * mult;
    target.rotation += noiseR * amountRot * mult;
  }

  applyFilters(_target: PIXI.Container): void {}

  destroy(_target: PIXI.Container): void {}
}

function pseudoNoise(x: number): number {
  const s = Math.sin(x * 12.9898 + x * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
