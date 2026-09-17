import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { HDSonicSpikesLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import {
  bandStatsAudio, rainbowAt, clamp, clampInt,
  timeFactor60fps, normalizeRate, drawVignette,
} from './layerUtils';
import { HDAudioBase } from './HDAudioBase';

export class HDSonicSpikesLayerRuntime extends HDAudioBase implements RuntimeLayer<HDSonicSpikesLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: HDSonicSpikesLayerConfig;
  private backdrop: PIXI.Graphics;
  private glow: PIXI.Graphics;
  private spikes: PIXI.Graphics;
  private coreLine: PIXI.Graphics;
  private vignette: PIXI.Graphics;
  private glowBlur: PIXI.BlurFilter;
  private lastT = 0;

  constructor(config: HDSonicSpikesLayerConfig) {
    super();
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.backdrop = new PIXI.Graphics();
    this.glow = new PIXI.Graphics();
    this.spikes = new PIXI.Graphics();
    this.coreLine = new PIXI.Graphics();
    this.vignette = new PIXI.Graphics();
    this.glowBlur = new PIXI.BlurFilter();
    this.glow.filters = [this.glowBlur];
    this.glow.blendMode = 'add' as PIXI.BLEND_MODES;
    this.spikes.blendMode = 'add' as PIXI.BLEND_MODES;
    this.coreLine.blendMode = 'add' as PIXI.BLEND_MODES;

    this.container.addChild(this.backdrop);
    this.container.addChild(this.glow);
    this.container.addChild(this.spikes);
    this.container.addChild(this.coreLine);
    this.container.addChild(this.vignette);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: HDSonicSpikesLayerConfig): void {
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
    const peakDecay = clamp(sampleParam(this.config.peakHold.decay, t), 0.75, 0.999);
    const glowStrength = clamp(sampleParam(this.config.glowStrength, t), 0, 3);
    const mirror = sampleParam(this.config.mirror, t);
    const lineThickness = clamp(sampleParam(this.config.lineThickness, t), 2, 16);
    const gamma = clamp(sampleParam(this.config.gamma, t), 0.4, 1.8);
    const contrast = clamp(sampleParam(this.config.contrast, t), 0.6, 2.5);
    const spikeScale = clamp(sampleParam(this.config.spikeScale, t), 0.1, 1.2);
    const transientBoost = clamp(sampleParam(this.config.transientBoost, t), 0, 2);
    const frameFactor = timeFactor60fps(t, this.lastT);
    this.lastT = t;
    const attackAdj = normalizeRate(attack, frameFactor);
    const releaseAdj = normalizeRate(release, frameFactor);
    const peakDecayAdj = Math.pow(peakDecay, frameFactor);

    this.backdrop.clear().rect(0, 0, ctx.width, ctx.height).fill({ color: 0x000000, alpha: 1 });
    this.glow.clear();
    this.spikes.clear();
    this.coreLine.clear();
    this.vignette.clear();

    this.glowBlur.blur = 2 + glowStrength * 5;

    this.updateBeatKick(audio.beat, frameFactor);
    const bands = bandStatsAudio(audio.bins);
    const transient = clamp(
      1 + (audio.rms * 0.85 + bands.treble * 0.85) * transientBoost + this.beatKick * 0.5,
      1, 3.5,
    );

    this.processAudio(audio, {
      barCount, gain, compressionPow, attackAdj, releaseAdj,
      gamma, contrast, peakEnabled, peakDecayAdj,
      boostFactor: transient, rms: audio.rms,
    });

    const midY = ctx.height * 0.52;
    const col = ctx.width / barCount;
    const spikeWBase = Math.max(3, col * 0.72);
    const maxH = ctx.height * 0.42 * spikeScale;

    for (let i = 0; i < barCount; i++) {
      const bassBias = 1 - i / Math.max(1, barCount - 1);
      const widthScale = 0.8 + bassBias * 0.55;
      const spikeW = spikeWBase * widthScale;
      const x = i * col + (col - spikeW) * 0.5;

      const v = this.shaped[i];

      const h = v * maxH;
      if (h <= 0.5) continue;

      const color = rainbowAt((i + 0.5) / barCount, 1.1);
      const glowA = 0.11 + 0.08 * glowStrength;
      this.glow.rect(x - glowStrength, midY - h - glowStrength, spikeW + glowStrength * 2, h + glowStrength * 2).fill({ color, alpha: glowA });
      this.spikes.roundRect(x, midY - h, spikeW, h, Math.max(1, spikeW * 0.2)).fill({ color, alpha: 0.9 });

      if (mirror) {
        this.glow.rect(x - glowStrength, midY - glowStrength, spikeW + glowStrength * 2, h + glowStrength * 2).fill({ color, alpha: glowA * 0.82 });
        this.spikes.roundRect(x, midY, spikeW, h, Math.max(1, spikeW * 0.2)).fill({ color, alpha: 0.82 });
      }

      const peakH = this.peaks[i] * maxH;
      if (peakEnabled && peakH > h + 2) {
        const py = midY - peakH - 1;
        this.spikes.rect(x, py, spikeW, Math.max(1.5, lineThickness * 0.4)).fill({ color: 0xffffff, alpha: 0.7 });
        if (mirror) {
          this.spikes.rect(x, midY + peakH, spikeW, Math.max(1.5, lineThickness * 0.4)).fill({ color: 0xffffff, alpha: 0.55 });
        }
      }
    }

    this.coreLine.rect(0, midY - lineThickness * 0.5, ctx.width, lineThickness).fill({ color: 0xffffff, alpha: 0.66 });
    this.glow.rect(0, midY - lineThickness, ctx.width, lineThickness * 2).fill({ color: 0xffffff, alpha: 0.11 + glowStrength * 0.05 });

    drawVignette(this.vignette, ctx.width, ctx.height, 0.08, 0.2, 0.14);
  }

  destroy(): void {
    this.backdrop.destroy();
    this.glow.destroy();
    this.spikes.destroy();
    this.coreLine.destroy();
    this.vignette.destroy();
    this.container.destroy({ children: true });
  }

}
