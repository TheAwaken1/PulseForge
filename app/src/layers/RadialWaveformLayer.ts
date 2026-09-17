import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { RadialWaveformLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { DESIGN_HEIGHT, DESIGN_WIDTH, clamp, resolvePositionParam } from './layerUtils';
import { liquidMagnitude } from './liquidMotion';

/**
 * Radial Waveform visualizer: a continuous ring that deforms
 * based on frequency bin amplitudes.
 */
export class RadialWaveformLayerRuntime implements RuntimeLayer<RadialWaveformLayerConfig> {
  id: string;
  container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private config: RadialWaveformLayerConfig;
  private smoothedBins: Float32Array;
  private beatFlash = 0;
  private lastT = -1;

  constructor(config: RadialWaveformLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
    this.smoothedBins = new Float32Array(72);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: RadialWaveformLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    this.graphics.clear();

    // Beat flash: ring amplitude surge on each beat
    const dt = this.lastT >= 0 ? Math.min(0.2, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;
    if (audio.beat) {
      this.beatFlash = 1.0;
    } else {
      this.beatFlash *= Math.pow(0.65, dt * 60);
    }

    const cx = resolvePositionParam(sampleParam(this.config.centerX, t), ctx.width, ctx.width / 2, DESIGN_WIDTH);
    const cy = resolvePositionParam(sampleParam(this.config.centerY, t), ctx.height, ctx.height / 2, DESIGN_HEIGHT);
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const baseRadius = sampleParam(this.config.radius, t) * designScale;
    const amplitude = sampleParam(this.config.amplitude, t) * designScale;
    const lineWidth = clamp(sampleParam(this.config.lineWidth, t) * designScale, 1, 12);
    const colorHex = sampleParam(this.config.color, t);
    const color = parseInt(colorHex.replace('#', ''), 16);
    const attack = sampleParam(this.config.smoothing.attack, t);
    const release = sampleParam(this.config.smoothing.release, t);
    const liquidAmount = this.config.liquidMotion
      ? (this.config.liquidAmount ? sampleParam(this.config.liquidAmount, t) : 0.65)
      : 0;
    const liquidSpeed = this.config.liquidSpeed ? sampleParam(this.config.liquidSpeed, t) : 1;

    const bins = audio.bins;
    const points = bins.length;

    // Smooth
    if (this.smoothedBins.length !== points) {
      this.smoothedBins = new Float32Array(points);
    }
    for (let i = 0; i < points; i++) {
      const current = bins[i] || 0;
      const prev = this.smoothedBins[i] || 0;
      const rate = current > prev ? attack : release;
      this.smoothedBins[i] = prev + rate * (current - prev);
    }

    const angleStep = (2 * Math.PI) / points;
    const beatAmplitude = amplitude * (1 + this.beatFlash * 0.3);

    // Draw closed polygon
    let first = true;
    for (let i = 0; i <= points; i++) {
      const idx = i % points;
      const angle = idx * angleStep - Math.PI / 2;
      const liquid = liquidAmount > 0
        ? liquidMagnitude(this.smoothedBins, idx, t, audio, liquidAmount, liquidSpeed)
        : { magnitude: this.smoothedBins[idx], wave: 0 };
      const energyDrive = 0.2 + clamp(audio.rms, 0, 1) * 0.8;
      const flowingRadius = liquid.wave * liquidAmount * amplitude * 0.08 * energyDrive;
      const r = baseRadius + liquid.magnitude * beatAmplitude + flowingRadius;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);

      if (first) {
        this.graphics.moveTo(px, py);
        first = false;
      } else {
        this.graphics.lineTo(px, py);
      }
    }

    this.graphics.closePath();
    this.graphics.stroke({ width: lineWidth, color });
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}
