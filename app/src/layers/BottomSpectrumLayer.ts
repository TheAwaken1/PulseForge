import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { BottomSpectrumLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { DESIGN_HEIGHT, DESIGN_WIDTH, resolvePositionParam, resolveSizeParam } from './layerUtils';

/**
 * Bottom Spectrum visualizer: traditional equalizer bars at screen bottom.
 */
export class BottomSpectrumLayerRuntime implements RuntimeLayer<BottomSpectrumLayerConfig> {
  id: string;
  container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private config: BottomSpectrumLayerConfig;
  private smoothedBins: Float32Array;

  constructor(config: BottomSpectrumLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
    this.smoothedBins = new Float32Array(128);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: BottomSpectrumLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    this.graphics.clear();

    const barCount = Math.round(sampleParam(this.config.barCount, t));
    const gain = sampleParam(this.config.gain, t);
    const colorHex = sampleParam(this.config.color, t);
    const color = parseInt(colorHex.replace('#', ''), 16);
    const attack = sampleParam(this.config.smoothing.attack, t);
    const release = sampleParam(this.config.smoothing.release, t);

    const areaX = resolvePositionParam(sampleParam(this.config.barX, t), ctx.width, 0, DESIGN_WIDTH);
    const areaY = resolvePositionParam(sampleParam(this.config.barY, t), ctx.height, ctx.height * 0.82, DESIGN_HEIGHT);
    const areaWidth = resolveSizeParam(sampleParam(this.config.barWidth, t), ctx.width, ctx.width, DESIGN_WIDTH);
    const areaHeight = resolveSizeParam(sampleParam(this.config.barHeight, t), ctx.height, ctx.height * 0.18, DESIGN_HEIGHT);

    const barWidth = areaWidth / barCount;
    const gap = Math.max(1, barWidth * 0.2);
    const effectiveBarWidth = barWidth - gap;

    // Resample and smooth
    const bins = audio.bins;
    if (this.smoothedBins.length !== barCount) {
      this.smoothedBins = new Float32Array(barCount);
    }
    for (let i = 0; i < barCount; i++) {
      const srcIdx = (i / barCount) * bins.length;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(bins.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      const current = ((bins[idx0] || 0) * (1 - frac) + (bins[idx1] || 0) * frac) * gain;
      const prev = this.smoothedBins[i] || 0;
      const rate = current > prev ? attack : release;
      this.smoothedBins[i] = prev + rate * (current - prev);
    }

    // Draw bars growing upward
    for (let i = 0; i < barCount; i++) {
      const magnitude = Math.max(0, Math.min(1, this.smoothedBins[i]));
      const barHeight = magnitude * areaHeight;
      if (barHeight < 1) continue;

      const x = areaX + i * barWidth + gap / 2;
      const y = areaY + areaHeight - barHeight;

      this.graphics.roundRect(x, y, effectiveBarWidth, barHeight, 2).fill({ color });
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}
