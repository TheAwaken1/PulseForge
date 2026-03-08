import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { RadialSpectrumLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { SmoothingFilter, applyCompression } from '../audio/smoothing';
import { DESIGN_HEIGHT, DESIGN_WIDTH, clamp, hexStringToNumber, lerpColor, resolvePositionParam } from './layerUtils';

/**
 * Radial Spectrum visualizer: bars arranged in a circle around a center point.
 *
 * Each bar extends outward from center with height proportional to the
 * corresponding frequency bin magnitude. Bars are drawn as filled polygons
 * with computed absolute positions (no per-shape transforms).
 */
export class RadialSpectrumLayerRuntime implements RuntimeLayer<RadialSpectrumLayerConfig> {
  id: string;
  container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private config: RadialSpectrumLayerConfig;
  private smoother: SmoothingFilter;
  private peaks: Float32Array;

  constructor(config: RadialSpectrumLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    const bc = sampleParam(config.barCount, 0);
    this.smoother = new SmoothingFilter(
      bc,
      sampleParam(config.smoothing.attack, 0),
      sampleParam(config.smoothing.release, 0),
    );
    this.peaks = new Float32Array(bc);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: RadialSpectrumLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    this.graphics.clear();

    const barCount = Math.round(sampleParam(this.config.barCount, t));
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const radius = sampleParam(this.config.radius, t) * designScale;
    const thickness = sampleParam(this.config.thickness, t) * designScale;
    const gain = sampleParam(this.config.gain, t);
    const compPow = sampleParam(this.config.compressionPow, t);
    const noiseJitter = sampleParam(this.config.noiseJitter, t);
    const barGap = sampleParam(this.config.barGap, t);
    const centerX = sampleParam(this.config.centerX, t);
    const centerY = sampleParam(this.config.centerY, t);
    const peakEnabled = sampleParam(this.config.peakHold.enabled, t);
    const peakDecay = sampleParam(this.config.peakHold.decay, t);

    // Smoothing
    this.smoother.setParams(
      sampleParam(this.config.smoothing.attack, t),
      sampleParam(this.config.smoothing.release, t),
    );

    // Resample audio bins to barCount
    const inputBins = audio.bins;
    const mapped = new Float32Array(barCount);
    for (let i = 0; i < barCount; i++) {
      // Log-style bin mapping for musical balance (more low-end resolution).
      const n = i / Math.max(1, barCount - 1);
      const logN = (Math.pow(10, n) - 1) / 9;
      const srcIdx = logN * Math.max(1, inputBins.length - 1);
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(inputBins.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      mapped[i] = ((inputBins[idx0] || 0) * (1 - frac) + (inputBins[idx1] || 0) * frac) * gain;
    }
    applyCompression(mapped, compPow);

    // Ensure smoother has correct size
    if (this.smoother['values'].length !== barCount) {
      this.smoother = new SmoothingFilter(barCount,
        sampleParam(this.config.smoothing.attack, t),
        sampleParam(this.config.smoothing.release, t),
      );
      this.peaks = new Float32Array(barCount);
    }
    const smoothed = this.smoother.process(mapped);

    // Color
    const colorMode = this.config.color.mode;
    const gradient = this.config.color.gradient ? sampleParam(this.config.color.gradient, t) : undefined;
    const solidColor = hexStringToNumber(sampleParam(this.config.color.solid, t));

    // Center position (default to screen center)
    const cx = resolvePositionParam(centerX, ctx.width, ctx.width / 2, DESIGN_WIDTH);
    const cy = resolvePositionParam(centerY, ctx.height, ctx.height / 2, DESIGN_HEIGHT);

    const angleStep = (2 * Math.PI) / barCount;
    const maxBarHeight = radius * 0.8;
    const halfThick = clamp(thickness / 2, 0.8, 16);

    for (let i = 0; i < barCount; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const angleFrac = i / Math.max(1, barCount - 1);
      const color = gradientColorAtAngle(angleFrac, colorMode, gradient, solidColor);
      let magnitude = Math.max(0, Math.min(1, smoothed[i]));

      // Noise jitter
      if (noiseJitter > 0) {
        const noise = (pseudoNoise(t * 10 + i * 0.1) - 0.5) * noiseJitter;
        magnitude = Math.max(0, magnitude + noise);
      }

      const barHeight = magnitude * maxBarHeight;
      if (barHeight < 0.5) continue;

      // Peak hold
      if (peakEnabled) {
        this.peaks[i] = Math.max(this.peaks[i] * peakDecay, magnitude);
      }

      // Compute bar polygon corners in absolute coords.
      // Bar runs from innerR to innerR + barHeight along angle,
      // with width = thickness perpendicular to the radial direction.
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Perpendicular direction
      const perpX = -sinA * halfThick;
      const perpY = cosA * halfThick;

      const innerX = cx + radius * cosA;
      const innerY = cy + radius * sinA;
      const outerX = cx + (radius + barHeight) * cosA;
      const outerY = cy + (radius + barHeight) * sinA;

      // Draw filled quadrilateral
      this.graphics
        .moveTo(innerX - perpX, innerY - perpY)
        .lineTo(innerX + perpX, innerY + perpY)
        .lineTo(outerX + perpX, outerY + perpY)
        .lineTo(outerX - perpX, outerY - perpY)
        .closePath()
        .fill({ color });

      // Peak cap
      if (peakEnabled && this.peaks[i] > magnitude + 0.02) {
        const peakR = radius + this.peaks[i] * maxBarHeight;
        const pkX = cx + peakR * cosA;
        const pkY = cy + peakR * sinA;
        const capR = peakR + 3;
        const pkX2 = cx + capR * cosA;
        const pkY2 = cy + capR * sinA;

        this.graphics
          .moveTo(pkX - perpX, pkY - perpY)
          .lineTo(pkX + perpX, pkY + perpY)
          .lineTo(pkX2 + perpX, pkY2 + perpY)
          .lineTo(pkX2 - perpX, pkY2 - perpY)
          .closePath()
          .fill({ color: 0xffffff, alpha: 0.7 });
      }
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}

function pseudoNoise(x: number): number {
  const s = Math.sin(x * 12.9898 + x * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function gradientColorAtAngle(
  t: number,
  mode: 'solid' | 'gradient',
  gradient: { stops: { pos: number; color: string }[] } | undefined,
  solidColor: number,
): number {
  if (mode !== 'gradient' || !gradient?.stops || gradient.stops.length === 0) return solidColor;

  const sorted = [...gradient.stops].sort((a, b) => a.pos - b.pos);
  if (sorted.length === 1) return hexStringToNumber(sorted[0].color);

  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT <= sorted[0].pos) return hexStringToNumber(sorted[0].color);
  if (clampedT >= sorted[sorted.length - 1].pos) return hexStringToNumber(sorted[sorted.length - 1].color);

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (clampedT >= a.pos && clampedT <= b.pos) {
      const span = Math.max(1e-6, b.pos - a.pos);
      const localT = (clampedT - a.pos) / span;
      return lerpColor(hexStringToNumber(a.color), hexStringToNumber(b.color), localT);
    }
  }

  return solidColor;
}
