import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { BeatPunchEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';

/** A short, deterministic camera-style kick on detected beats. */
export class BeatPunchEffectRuntime implements RuntimeEffect<BeatPunchEffectConfig> {
  id: string;
  private config: BeatPunchEffectConfig;
  private kick = 0;
  private lastT = -1;
  private lastBeatT = -1;
  private direction = 1;
  private ctx: RenderContext | null = null;

  constructor(config: BeatPunchEffectConfig) {
    this.id = config.id;
    this.config = config;
  }

  init(_target: PIXI.Container, ctx: RenderContext): void { this.ctx = ctx; }
  updateConfig(config: BeatPunchEffectConfig): void { this.config = config; }

  beforeUpdate(target: PIXI.Container, t: number, audio: AudioFrame): void {
    if (this.lastT >= 0 && t < this.lastT) {
      this.kick = 0;
      this.lastBeatT = -1;
    }

    const dt = this.lastT >= 0 ? Math.min(0.2, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;

    if (audio.beat && Math.abs(t - this.lastBeatT) > 0.0001) {
      this.kick = 1;
      this.direction *= -1;
      this.lastBeatT = t;
    } else {
      const decaySec = Math.max(0.04, sampleParam(this.config.decayMs, t) / 1000);
      this.kick *= Math.exp(-dt / decaySec);
    }

    if (this.kick < 0.0001) return;
    const easedKick = this.kick * this.kick;
    const zoom = sampleParam(this.config.zoomAmount, t) * easedKick;
    const rotation = sampleParam(this.config.rotationDeg, t) * (Math.PI / 180) * this.direction * easedKick;
    const position = sampleParam(this.config.positionPx, t) * this.direction * easedKick;

    target.scale.x += zoom;
    target.scale.y += zoom;
    target.rotation += rotation;
    target.x -= (this.ctx?.width ?? 0) * 0.5 * zoom;
    target.y -= (this.ctx?.height ?? 0) * 0.5 * zoom;
    target.x += position;
    target.y -= position * 0.35;
  }

  applyFilters(_target: PIXI.Container): void {}
  destroy(_target: PIXI.Container): void {}
}
