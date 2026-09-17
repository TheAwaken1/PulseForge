import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { HDBarsReflectionLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import {
  bandStatsAudio, rainbowAt, clamp, clampInt,
  timeFactor60fps, normalizeRate, drawVignette,
} from './layerUtils';
import { HDAudioBase } from './HDAudioBase';

export class HDBarsReflectionLayerRuntime extends HDAudioBase implements RuntimeLayer<HDBarsReflectionLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: HDBarsReflectionLayerConfig;
  private backdrop: PIXI.Graphics;
  private glow: PIXI.Graphics;
  private bars: PIXI.Graphics;
  private reflection: PIXI.Graphics;
  private vignette: PIXI.Graphics;
  private reflectionBlur: PIXI.BlurFilter;
  private lastT = 0;

  constructor(config: HDBarsReflectionLayerConfig) {
    super();
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.backdrop = new PIXI.Graphics();
    this.glow = new PIXI.Graphics();
    this.bars = new PIXI.Graphics();
    this.reflection = new PIXI.Graphics();
    this.vignette = new PIXI.Graphics();
    this.reflectionBlur = new PIXI.BlurFilter();
    this.reflection.filters = [this.reflectionBlur];
    this.glow.blendMode = 'add' as PIXI.BLEND_MODES;

    this.container.addChild(this.backdrop);
    this.container.addChild(this.glow);
    this.container.addChild(this.bars);
    this.container.addChild(this.reflection);
    this.container.addChild(this.vignette);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: HDBarsReflectionLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    const barCount = clampInt(Math.round(sampleParam(this.config.barCount, t)), 24, 256);
    this.ensureSize(barCount);
    const gain = sampleParam(this.config.gain, t);
    const attack = clamp(sampleParam(this.config.attack, t), 0.01, 1);
    const release = clamp(sampleParam(this.config.release, t), 0.001, 1);
    const compressionPow = clamp(sampleParam(this.config.compressionPow, t), 0.2, 1.6);
    const peakEnabled = sampleParam(this.config.peakHold.enabled, t);
    const peakDecay = clamp(sampleParam(this.config.peakHold.decay, t), 0.7, 0.999);
    const peakCaps = sampleParam(this.config.peakHold.showCaps, t);
    const glowStrength = clamp(sampleParam(this.config.glowStrength, t), 0, 3);
    const reflectionEnabled = sampleParam(this.config.reflectionEnabled, t);
    const reflectionOpacity = clamp(sampleParam(this.config.reflectionOpacity, t), 0, 1);
    const reflectionBlur = clamp(sampleParam(this.config.reflectionBlur, t), 0, 24);
    const reflectionFade = clamp(sampleParam(this.config.reflectionFade, t), 0.5, 5);
    const gamma = clamp(sampleParam(this.config.gamma, t), 0.4, 1.8);
    const contrast = clamp(sampleParam(this.config.contrast, t), 0.6, 2.5);
    const baselineY = clamp(sampleParam(this.config.baselineY, t), 0.2, 0.9) * ctx.height;
    const heightScale = clamp(sampleParam(this.config.heightScale, t), 0.05, 1) * ctx.height;
    const frameFactor = timeFactor60fps(t, this.lastT);
    this.lastT = t;
    const attackAdj = normalizeRate(attack, frameFactor);
    const releaseAdj = normalizeRate(release, frameFactor);
    const peakDecayAdj = Math.pow(peakDecay, frameFactor);

    this.backdrop.clear().rect(0, 0, ctx.width, ctx.height).fill({ color: 0x000000, alpha: 1 });
    this.glow.clear();
    this.bars.clear();
    this.reflection.clear();
    this.vignette.clear();
    this.reflectionBlur.blur = reflectionBlur;
    this.reflection.visible = reflectionEnabled;

    this.updateBeatKick(audio.beat, frameFactor);
    const stats = bandStatsAudio(audio.bins);
    const bandBoost = clamp(0.95 + stats.bass * 0.25 + stats.mid * 0.18 + stats.treble * 0.1 + this.beatKick * 0.4, 0.9, 2.0);

    this.processAudio(audio, {
      barCount, gain, compressionPow, attackAdj, releaseAdj,
      gamma, contrast, peakEnabled, peakDecayAdj,
      boostFactor: bandBoost, rms: audio.rms,
    });

    const gapRatio = 0.12;
    const column = ctx.width / barCount;
    const gap = Math.max(1, column * gapRatio);
    const barWidth = Math.max(2, column - gap);
    const radius = Math.max(2, barWidth * 0.2);
    const capH = Math.max(2, barWidth * 0.3);
    const glowAlphaBase = 0.12 + 0.1 * glowStrength;

    for (let i = 0; i < barCount; i++) {
      const shaped = this.shaped[i];

      const h = shaped * heightScale;
      if (h <= 0.5) continue;
      const x = i * column + gap * 0.5;
      const y = baselineY - h;
      const color = rainbowAt((i + 0.5) / barCount, 1.12);

      this.glow.roundRect(x - glowStrength, y - glowStrength, barWidth + glowStrength * 2, h + glowStrength * 2, radius + glowStrength)
        .fill({ color, alpha: glowAlphaBase });
      this.bars.roundRect(x, y, barWidth, h, radius).fill({ color, alpha: 0.96 });

      if (peakCaps) {
        const peakY = baselineY - this.peaks[i] * heightScale - capH - 1;
        this.bars.roundRect(x, peakY, barWidth, capH, Math.max(1, radius * 0.45)).fill({ color: 0xffffff, alpha: 0.82 });
      }

      if (reflectionEnabled) {
        const rh = h * 0.92;
        const ry = baselineY + 1;
        const fade = Math.pow(1 - clamp(rh / Math.max(1, ctx.height - baselineY), 0, 1), reflectionFade);
        const alpha = reflectionOpacity * fade;
        this.reflection.roundRect(x, ry, barWidth, rh, radius).fill({ color, alpha });
      }
    }

    drawVignette(this.vignette, ctx.width, ctx.height);
  }

  destroy(): void {
    this.backdrop.destroy();
    this.glow.destroy();
    this.bars.destroy();
    this.reflection.destroy();
    this.vignette.destroy();
    this.container.destroy({ children: true });
  }

}
