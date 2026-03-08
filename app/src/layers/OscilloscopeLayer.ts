import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { OscilloscopeLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { clamp, hexStringToNumber, lerpColor, bandStatsAudio, DESIGN_WIDTH, DESIGN_HEIGHT } from './layerUtils';

/**
 * Oscilloscope waveform layer: draws audio frequency data as a continuous
 * waveform line in horizontal, mirrored, or circular mode.
 */
export class OscilloscopeLayerRuntime implements RuntimeLayer<OscilloscopeLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: OscilloscopeLayerConfig;
  private main: PIXI.Graphics;
  private fill: PIXI.Graphics;
  private glow: PIXI.Graphics;
  private glowBlur: PIXI.BlurFilter;
  private smoothed: Float32Array;

  constructor(config: OscilloscopeLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.main = new PIXI.Graphics();
    this.fill = new PIXI.Graphics();
    this.glow = new PIXI.Graphics();
    this.glowBlur = new PIXI.BlurFilter();
    this.glow.filters = [this.glowBlur];
    this.glow.blendMode = 'add' as PIXI.BLEND_MODES;

    this.container.addChild(this.fill);
    this.container.addChild(this.glow);
    this.container.addChild(this.main);

    this.smoothed = new Float32Array(256);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: OscilloscopeLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    this.main.clear();
    this.fill.clear();
    this.glow.clear();

    const mode = this.config.mode;
    const lineWidth = clamp(sampleParam(this.config.lineWidth, t), 1, 12);
    const gain = clamp(sampleParam(this.config.gain, t), 0.5, 5);
    const smoothing = clamp(sampleParam(this.config.smoothing, t), 0, 1);
    const sampleCount = clamp(Math.round(sampleParam(this.config.sampleCount, t)), 64, 512);
    const colorHex = sampleParam(this.config.color, t);
    const color = hexStringToNumber(colorHex);
    const glowEnabled = sampleParam(this.config.glowEnabled, t);
    const glowStrength = clamp(sampleParam(this.config.glowStrength, t), 0, 3);
    const glowColorHex = sampleParam(this.config.glowColor, t);
    const glowColor = hexStringToNumber(glowColorHex);
    const fillEnabled = sampleParam(this.config.fillEnabled, t);
    const fillOpacity = clamp(sampleParam(this.config.fillOpacity, t), 0, 1);
    const mirrorY = clamp(sampleParam(this.config.mirrorY, t), 0, 1);
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const circularRadius = clamp(sampleParam(this.config.circularRadius, t) * designScale, 20, 1600);
    const circularAmplitude = clamp(sampleParam(this.config.circularAmplitude, t) * designScale, 5, 800);
    const gradientEnabled = sampleParam(this.config.lineGradient.enabled, t);
    const gradColor1 = hexStringToNumber(sampleParam(this.config.lineGradient.color1, t));
    const gradColor2 = hexStringToNumber(sampleParam(this.config.lineGradient.color2, t));
    const gamma = clamp(sampleParam(this.config.gamma, t), 0.4, 1.8);
    const stereoSpread = clamp(sampleParam(this.config.stereoSpread, t), 0, 1);
    const scanlineEffect = sampleParam(this.config.scanlineEffect, t);

    // Ensure smoothed buffer matches sampleCount
    if (this.smoothed.length !== sampleCount) {
      this.smoothed = new Float32Array(sampleCount);
    }

    const bins = audio.bins;
    const binLen = bins.length;

    // Cubic interpolation helper
    const cubicSample = (pos: number): number => {
      const i1 = Math.floor(pos);
      const i0 = Math.max(0, i1 - 1);
      const i2 = Math.min(binLen - 1, i1 + 1);
      const i3 = Math.min(binLen - 1, i1 + 2);
      const f = pos - i1;
      const v0 = bins[i0] || 0;
      const v1 = bins[Math.min(binLen - 1, i1)] || 0;
      const v2 = bins[i2] || 0;
      const v3 = bins[i3] || 0;
      // Catmull-Rom spline
      const a0 = -0.5 * v0 + 1.5 * v1 - 1.5 * v2 + 0.5 * v3;
      const a1 = v0 - 2.5 * v1 + 2 * v2 - 0.5 * v3;
      const a2 = -0.5 * v0 + 0.5 * v2;
      const a3 = v1;
      return a0 * f * f * f + a1 * f * f + a2 * f + a3;
    };

    // Resample bins into sampleCount points with cubic interpolation
    for (let i = 0; i < sampleCount; i++) {
      const srcPos = (i / Math.max(1, sampleCount - 1)) * Math.max(0, binLen - 1);
      const raw = Math.max(0, cubicSample(srcPos));
      // Smoothing envelope: lerp toward new value
      const prev = this.smoothed[i];
      this.smoothed[i] = prev + (1 - smoothing) * (raw - prev);
    }

    // Apply gain and gamma to produce final values array
    const values = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      values[i] = Math.pow(clamp(this.smoothed[i] * gain, 0, 2), gamma);
    }

    const w = ctx.width;
    const h = ctx.height;
    const baseY = mirrorY * h;

    // Setup glow blur
    this.glowBlur.blur = 2 + glowStrength * 5;
    this.glow.visible = glowEnabled;
    this.fill.visible = fillEnabled;

    // --- Stereo spread ---
    if (stereoSpread > 0) {
      const stats = bandStatsAudio(audio.bins);
      // Build bass-weighted and treble-weighted value arrays
      const bassValues = new Float32Array(sampleCount);
      const trebleValues = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const frac = i / Math.max(1, sampleCount - 1);
        // Bass copy emphasizes low bins, treble copy emphasizes high bins
        bassValues[i] = values[i] * (1 + stats.bass * (1 - frac));
        trebleValues[i] = values[i] * (1 + stats.treble * frac);
      }
      const offset = stereoSpread * 20;
      this.drawWave(mode, bassValues, sampleCount, w, h, baseY - offset, circularRadius, circularAmplitude, lineWidth, color, gradientEnabled, gradColor1, gradColor2, this.main);
      this.drawWave(mode, trebleValues, sampleCount, w, h, baseY + offset, circularRadius, circularAmplitude, lineWidth, color, gradientEnabled, gradColor1, gradColor2, this.main);
      if (fillEnabled) {
        this.drawFill(mode, bassValues, sampleCount, w, h, baseY - offset, circularRadius, circularAmplitude, color, fillOpacity, this.fill);
        this.drawFill(mode, trebleValues, sampleCount, w, h, baseY + offset, circularRadius, circularAmplitude, color, fillOpacity, this.fill);
      }
      if (glowEnabled) {
        this.drawWave(mode, bassValues, sampleCount, w, h, baseY - offset, circularRadius, circularAmplitude, lineWidth, glowColor, false, 0, 0, this.glow);
        this.drawWave(mode, trebleValues, sampleCount, w, h, baseY + offset, circularRadius, circularAmplitude, lineWidth, glowColor, false, 0, 0, this.glow);
      }
    } else {
      // Single wave
      this.drawWave(mode, values, sampleCount, w, h, baseY, circularRadius, circularAmplitude, lineWidth, color, gradientEnabled, gradColor1, gradColor2, this.main);
      if (fillEnabled) {
        this.drawFill(mode, values, sampleCount, w, h, baseY, circularRadius, circularAmplitude, color, fillOpacity, this.fill);
      }
      if (glowEnabled) {
        this.drawWave(mode, values, sampleCount, w, h, baseY, circularRadius, circularAmplitude, lineWidth, glowColor, false, 0, 0, this.glow);
      }
    }

    // --- Scanline effect ---
    if (scanlineEffect) {
      for (let sy = 0; sy < h; sy += 4) {
        this.main.moveTo(0, sy);
        this.main.lineTo(w, sy);
      }
      this.main.stroke({ width: 1, color: 0xffffff, alpha: 0.03 });
    }
  }

  /**
   * Draw the waveform line on the given Graphics object.
   */
  private drawWave(
    mode: string,
    values: Float32Array,
    count: number,
    w: number,
    h: number,
    baseY: number,
    circularRadius: number,
    circularAmplitude: number,
    lineWidth: number,
    color: number,
    gradientEnabled: boolean,
    gradColor1: number,
    gradColor2: number,
    g: PIXI.Graphics,
  ): void {
    if (mode === 'circular') {
      this.drawCircularWave(values, count, w, h, circularRadius, circularAmplitude, lineWidth, color, gradientEnabled, gradColor1, gradColor2, g);
    } else if (mode === 'mirrored') {
      this.drawHorizontalLine(values, count, w, h, baseY, -1, lineWidth, color, gradientEnabled, gradColor1, gradColor2, g);
      this.drawHorizontalLine(values, count, w, h, baseY, 1, lineWidth, color, gradientEnabled, gradColor1, gradColor2, g);
    } else {
      // horizontal
      this.drawHorizontalLine(values, count, w, h, baseY, -1, lineWidth, color, gradientEnabled, gradColor1, gradColor2, g);
    }
  }

  /**
   * Draw a single horizontal waveform line.
   * direction: -1 = above baseY, +1 = below baseY
   */
  private drawHorizontalLine(
    values: Float32Array,
    count: number,
    w: number,
    h: number,
    baseY: number,
    direction: number,
    lineWidth: number,
    color: number,
    gradientEnabled: boolean,
    gradColor1: number,
    gradColor2: number,
    g: PIXI.Graphics,
  ): void {
    if (gradientEnabled) {
      // Draw in segments, each colored by position
      for (let i = 0; i < count - 1; i++) {
        const frac0 = i / Math.max(1, count - 1);
        const frac1 = (i + 1) / Math.max(1, count - 1);
        const x0 = frac0 * w;
        const x1 = frac1 * w;
        const y0 = baseY + direction * values[i] * h * 0.3;
        const y1 = baseY + direction * values[i + 1] * h * 0.3;
        const segColor = lerpColor(gradColor1, gradColor2, (frac0 + frac1) * 0.5);
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke({ width: lineWidth, color: segColor });
      }
    } else {
      // Single continuous path
      for (let i = 0; i < count; i++) {
        const frac = i / Math.max(1, count - 1);
        const x = frac * w;
        const y = baseY + direction * values[i] * h * 0.3;
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      g.stroke({ width: lineWidth, color });
    }
  }

  /**
   * Draw wave wrapped around a circle.
   */
  private drawCircularWave(
    values: Float32Array,
    count: number,
    w: number,
    h: number,
    radius: number,
    amplitude: number,
    lineWidth: number,
    color: number,
    gradientEnabled: boolean,
    gradColor1: number,
    gradColor2: number,
    g: PIXI.Graphics,
  ): void {
    const cx = w / 2;
    const cy = h / 2;

    if (gradientEnabled) {
      for (let i = 0; i < count; i++) {
        const frac0 = i / count;
        const frac1 = ((i + 1) % count) / count;
        const angle0 = frac0 * Math.PI * 2;
        const angle1 = ((i + 1) % count) / count * Math.PI * 2;
        const r0 = radius + values[i] * amplitude;
        const r1 = radius + values[(i + 1) % count] * amplitude;
        const x0 = cx + Math.cos(angle0) * r0;
        const y0 = cy + Math.sin(angle0) * r0;
        const x1 = cx + Math.cos(angle1) * r1;
        const y1 = cy + Math.sin(angle1) * r1;
        const segColor = lerpColor(gradColor1, gradColor2, (frac0 + frac1) * 0.5);
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke({ width: lineWidth, color: segColor });
      }
    } else {
      for (let i = 0; i <= count; i++) {
        const idx = i % count;
        const angle = (idx / count) * Math.PI * 2;
        const r = radius + values[idx] * amplitude;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      g.closePath();
      g.stroke({ width: lineWidth, color });
    }
  }

  /**
   * Draw filled polygon beneath/around the waveform.
   */
  private drawFill(
    mode: string,
    values: Float32Array,
    count: number,
    w: number,
    h: number,
    baseY: number,
    circularRadius: number,
    circularAmplitude: number,
    color: number,
    opacity: number,
    g: PIXI.Graphics,
  ): void {
    if (mode === 'circular') {
      // Filled circular polygon
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i <= count; i++) {
        const idx = i % count;
        const angle = (idx / count) * Math.PI * 2;
        const r = circularRadius + values[idx] * circularAmplitude;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      g.closePath();
      g.fill({ color, alpha: opacity });
    } else if (mode === 'mirrored') {
      // Fill between upper and lower wave
      // Upper wave left to right
      for (let i = 0; i < count; i++) {
        const frac = i / Math.max(1, count - 1);
        const x = frac * w;
        const y = baseY - values[i] * h * 0.3;
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      // Lower wave right to left
      for (let i = count - 1; i >= 0; i--) {
        const frac = i / Math.max(1, count - 1);
        const x = frac * w;
        const y = baseY + values[i] * h * 0.3;
        g.lineTo(x, y);
      }
      g.closePath();
      g.fill({ color, alpha: opacity });
    } else {
      // Horizontal: wave line + straight baseline
      for (let i = 0; i < count; i++) {
        const frac = i / Math.max(1, count - 1);
        const x = frac * w;
        const y = baseY - values[i] * h * 0.3;
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      // Close back along baseline
      g.lineTo(w, baseY);
      g.lineTo(0, baseY);
      g.closePath();
      g.fill({ color, alpha: opacity });
    }
  }

  destroy(): void {
    this.main.destroy();
    this.fill.destroy();
    this.glow.destroy();
    this.container.destroy({ children: true });
  }
}
