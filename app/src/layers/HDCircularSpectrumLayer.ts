import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { HDCircularSpectrumLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import {
  bandStatsAudio, rainbowAt, clamp, clampInt,
  timeFactor60fps, normalizeRate, drawVignette,
  hexStringToNumber, lerpColor,
  DESIGN_WIDTH, DESIGN_HEIGHT,
} from './layerUtils';
import { HDAudioBase } from './HDAudioBase';
import { liquidMagnitude } from './liquidMotion';

const RING_SEGMENTS = 64;
const TWO_PI = Math.PI * 2;

export class HDCircularSpectrumLayerRuntime extends HDAudioBase implements RuntimeLayer<HDCircularSpectrumLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: HDCircularSpectrumLayerConfig;
  private backdrop: PIXI.Graphics;
  private glow: PIXI.Graphics;
  private bars: PIXI.Graphics;
  private reflection: PIXI.Graphics;
  private innerRingG: PIXI.Graphics;
  private outerRingG: PIXI.Graphics;
  private vignette: PIXI.Graphics;
  private glowBlur: PIXI.BlurFilter;
  private reflectionBlur: PIXI.BlurFilter;
  private lastT = 0;
  private rotAngle = 0;

  constructor(config: HDCircularSpectrumLayerConfig) {
    super();
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.backdrop = new PIXI.Graphics();
    this.glow = new PIXI.Graphics();
    this.bars = new PIXI.Graphics();
    this.reflection = new PIXI.Graphics();
    this.innerRingG = new PIXI.Graphics();
    this.outerRingG = new PIXI.Graphics();
    this.vignette = new PIXI.Graphics();

    this.glowBlur = new PIXI.BlurFilter();
    this.glow.filters = [this.glowBlur];
    this.glow.blendMode = 'add' as PIXI.BLEND_MODES;

    this.reflectionBlur = new PIXI.BlurFilter();
    this.reflection.filters = [this.reflectionBlur];

    this.container.addChild(this.backdrop);
    this.container.addChild(this.glow);
    this.container.addChild(this.bars);
    this.container.addChild(this.reflection);
    this.container.addChild(this.innerRingG);
    this.container.addChild(this.outerRingG);
    this.container.addChild(this.vignette);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: HDCircularSpectrumLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    const barCount = clampInt(Math.round(sampleParam(this.config.barCount, t)), 12, 256);
    this.ensureSize(barCount);

    const gain = sampleParam(this.config.gain, t);
    const attack = clamp(sampleParam(this.config.attack, t), 0.01, 1);
    const release = clamp(sampleParam(this.config.release, t), 0.001, 1);
    const compressionPow = clamp(sampleParam(this.config.compressionPow, t), 0.2, 1.6);
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const innerRadius = clamp(sampleParam(this.config.innerRadius, t) * designScale, 10, 2000);
    const barMaxHeight = clamp(sampleParam(this.config.barMaxHeight, t) * designScale, 10, 2000);
    const barWidthRatio = clamp(sampleParam(this.config.barWidthRatio, t), 0.1, 1);
    const peakEnabled = sampleParam(this.config.peakHold.enabled, t);
    const peakDecay = clamp(sampleParam(this.config.peakHold.decay, t), 0.7, 0.999);
    const peakCaps = sampleParam(this.config.peakHold.showCaps, t);
    const colorMode = this.config.colorMode;
    const solidColor = hexStringToNumber(sampleParam(this.config.solidColor, t));
    const gradColor1 = hexStringToNumber(sampleParam(this.config.gradientColor1, t));
    const gradColor2 = hexStringToNumber(sampleParam(this.config.gradientColor2, t));
    const glowStrength = clamp(sampleParam(this.config.glowStrength, t), 0, 3);
    const reflectionEnabled = sampleParam(this.config.reflectionEnabled, t);
    const reflectionOpacity = clamp(sampleParam(this.config.reflectionOpacity, t), 0, 1);
    const reflectionFade = clamp(sampleParam(this.config.reflectionFade, t), 0.5, 5);
    const innerRingEnabled = sampleParam(this.config.innerRing.enabled, t);
    const innerRingWidth = clamp(sampleParam(this.config.innerRing.width, t), 0.5, 12);
    const innerRingColor = hexStringToNumber(sampleParam(this.config.innerRing.color, t));
    const innerRingGlow = sampleParam(this.config.innerRing.glowEnabled, t);
    const outerRingEnabled = sampleParam(this.config.outerRing.enabled, t);
    const outerRingWidth = clamp(sampleParam(this.config.outerRing.width, t), 0.5, 12);
    const outerRingColor = hexStringToNumber(sampleParam(this.config.outerRing.color, t));
    const outerRingGlow = sampleParam(this.config.outerRing.glowEnabled, t);
    const gamma = clamp(sampleParam(this.config.gamma, t), 0.4, 1.8);
    const contrast = clamp(sampleParam(this.config.contrast, t), 0.6, 2.5);
    const rotationSpeed = sampleParam(this.config.rotationSpeed, t);
    const liquidAmount = this.config.liquidMotion
      ? (this.config.liquidAmount ? sampleParam(this.config.liquidAmount, t) : 0.65)
      : 0;
    const liquidSpeed = this.config.liquidSpeed ? sampleParam(this.config.liquidSpeed, t) : 1;

    const frameFactor = timeFactor60fps(t, this.lastT);
    const dt = this.lastT > 0 ? t - this.lastT : 1 / 60;
    this.lastT = t;
    const attackAdj = normalizeRate(attack, frameFactor);
    const releaseAdj = normalizeRate(release, frameFactor);
    const peakDecayAdj = Math.pow(peakDecay, frameFactor);

    // Accumulate rotation
    this.rotAngle += rotationSpeed * dt;

    // Clear all graphics
    this.backdrop.clear().rect(0, 0, ctx.width, ctx.height).fill({ color: 0x000000, alpha: 1 });
    this.glow.clear();
    this.bars.clear();
    this.reflection.clear();
    this.innerRingG.clear();
    this.outerRingG.clear();
    this.vignette.clear();

    this.glowBlur.blur = 2 + glowStrength * 5;
    this.reflectionBlur.blur = 3;
    this.reflection.visible = reflectionEnabled;

    // Center of the circular display
    const cx = ctx.width * 0.5;
    const cy = ctx.height * 0.5;

    // --- Audio processing ---
    this.updateBeatKick(audio.beat, frameFactor);
    const stats = bandStatsAudio(audio.bins);
    const bandBoost = clamp(
      0.95 + stats.bass * 0.25 + stats.mid * 0.18 + stats.treble * 0.1 + this.beatKick * 0.45,
      0.9, 2.0,
    );

    this.processAudio(audio, {
      barCount, gain, compressionPow, attackAdj, releaseAdj,
      gamma, contrast, peakEnabled, peakDecayAdj,
      boostFactor: bandBoost, rms: audio.rms,
    });

    const glowAlphaBase = 0.12 + 0.1 * glowStrength;

    // --- Angular geometry ---
    const angularSlot = TWO_PI / barCount;

    // Track the maximum outer radius for the outer ring
    let maxOuterR = innerRadius;

    for (let i = 0; i < barCount; i++) {
      const shaped = liquidAmount > 0
        ? liquidMagnitude(this.shaped, i, t, audio, liquidAmount, liquidSpeed).magnitude
        : this.shaped[i];

      const barHeight = shaped * barMaxHeight;
      if (barHeight <= 0.5) continue;

      const outerR = innerRadius + barHeight;
      if (outerR > maxOuterR) maxOuterR = outerR;

      // Bar center angle (with rotation offset)
      const angle = i * angularSlot + this.rotAngle;

      // Color selection
      let color: number;
      if (colorMode === 'rainbow') {
        color = rainbowAt((i + 0.5) / barCount, 1.12);
      } else if (colorMode === 'solid') {
        color = solidColor;
      } else {
        // gradient
        color = lerpColor(gradColor1, gradColor2, i / Math.max(1, barCount - 1));
      }

      // Compute trapezoid vertices (fan-shaped bar radiating from center)
      const halfInnerArc = angularSlot * barWidthRatio * 0.5;
      const halfOuterArc = angularSlot * barWidthRatio * 0.5;

      const cosA1 = Math.cos(angle - halfInnerArc);
      const sinA1 = Math.sin(angle - halfInnerArc);
      const cosA2 = Math.cos(angle + halfInnerArc);
      const sinA2 = Math.sin(angle + halfInnerArc);
      const cosB1 = Math.cos(angle - halfOuterArc);
      const sinB1 = Math.sin(angle - halfOuterArc);
      const cosB2 = Math.cos(angle + halfOuterArc);
      const sinB2 = Math.sin(angle + halfOuterArc);

      // Inner edge points
      const ix1 = cx + innerRadius * cosA1;
      const iy1 = cy + innerRadius * sinA1;
      const ix2 = cx + innerRadius * cosA2;
      const iy2 = cy + innerRadius * sinA2;

      // Outer edge points (wider due to fan effect)
      const ox1 = cx + outerR * cosB1;
      const oy1 = cy + outerR * sinB1;
      const ox2 = cx + outerR * cosB2;
      const oy2 = cy + outerR * sinB2;

      // Draw main bar (trapezoid)
      this.bars.moveTo(ix1, iy1);
      this.bars.lineTo(ox1, oy1);
      this.bars.lineTo(ox2, oy2);
      this.bars.lineTo(ix2, iy2);
      this.bars.closePath();
      this.bars.fill({ color, alpha: 0.96 });

      // Draw glow bar (slightly larger)
      const glowPad = glowStrength * 2;
      const innerGlowR = Math.max(0, innerRadius - glowPad);
      const outerGlowR = outerR + glowPad;
      const halfGlowArc = halfInnerArc + glowPad / Math.max(1, innerRadius) * 0.5;

      const cosG1 = Math.cos(angle - halfGlowArc);
      const sinG1 = Math.sin(angle - halfGlowArc);
      const cosG2 = Math.cos(angle + halfGlowArc);
      const sinG2 = Math.sin(angle + halfGlowArc);

      this.glow.moveTo(cx + innerGlowR * cosG1, cy + innerGlowR * sinG1);
      this.glow.lineTo(cx + outerGlowR * cosG1, cy + outerGlowR * sinG1);
      this.glow.lineTo(cx + outerGlowR * cosG2, cy + outerGlowR * sinG2);
      this.glow.lineTo(cx + innerGlowR * cosG2, cy + innerGlowR * sinG2);
      this.glow.closePath();
      this.glow.fill({ color, alpha: glowAlphaBase });

      // Peak hold caps (thin trapezoid at peak position)
      if (peakCaps && peakEnabled) {
        const peakH = this.peaks[i] * barMaxHeight;
        if (peakH > barHeight + 2) {
          const capThickness = Math.max(2, barMaxHeight * 0.02);
          const peakInnerR = innerRadius + peakH;
          const peakOuterR = peakInnerR + capThickness;

          const pix1 = cx + peakInnerR * cosA1;
          const piy1 = cy + peakInnerR * sinA1;
          const pix2 = cx + peakInnerR * cosA2;
          const piy2 = cy + peakInnerR * sinA2;
          const pox1 = cx + peakOuterR * cosB1;
          const poy1 = cy + peakOuterR * sinB1;
          const pox2 = cx + peakOuterR * cosB2;
          const poy2 = cy + peakOuterR * sinB2;

          this.bars.moveTo(pix1, piy1);
          this.bars.lineTo(pox1, poy1);
          this.bars.lineTo(pox2, poy2);
          this.bars.lineTo(pix2, piy2);
          this.bars.closePath();
          this.bars.fill({ color: 0xffffff, alpha: 0.82 });
        }
      }

      // Reflection (mirroring inward from innerRadius toward center)
      if (reflectionEnabled) {
        const refHeight = barHeight * 0.92;
        const refOuterR = innerRadius;
        const refInnerR = Math.max(0, innerRadius - refHeight);
        const fade = Math.pow(1 - clamp(refHeight / Math.max(1, innerRadius), 0, 1), reflectionFade);
        const alpha = reflectionOpacity * fade;

        const rix1 = cx + refInnerR * cosA1;
        const riy1 = cy + refInnerR * sinA1;
        const rix2 = cx + refInnerR * cosA2;
        const riy2 = cy + refInnerR * sinA2;
        const rox1 = cx + refOuterR * cosB1;
        const roy1 = cy + refOuterR * sinB1;
        const rox2 = cx + refOuterR * cosB2;
        const roy2 = cy + refOuterR * sinB2;

        this.reflection.moveTo(rox1, roy1);
        this.reflection.lineTo(rix1, riy1);
        this.reflection.lineTo(rix2, riy2);
        this.reflection.lineTo(rox2, roy2);
        this.reflection.closePath();
        this.reflection.fill({ color, alpha });
      }
    }

    // --- Inner ring ---
    if (innerRingEnabled) {
      this.drawRing(this.innerRingG, cx, cy, innerRadius, innerRingWidth, innerRingColor, 0.85);
      if (innerRingGlow) {
        this.drawRing(this.glow, cx, cy, innerRadius, innerRingWidth + glowStrength * 2, innerRingColor, 0.2);
      }
    }

    // --- Outer ring ---
    if (outerRingEnabled) {
      const outerRingR = maxOuterR + outerRingWidth * 0.5 + 2;
      this.drawRing(this.outerRingG, cx, cy, outerRingR, outerRingWidth, outerRingColor, 0.85);
      if (outerRingGlow) {
        this.drawRing(this.glow, cx, cy, outerRingR, outerRingWidth + glowStrength * 2, outerRingColor, 0.2);
      }
    }

    // --- Vignette ---
    drawVignette(this.vignette, ctx.width, ctx.height);
  }

  destroy(): void {
    this.backdrop.destroy();
    this.glow.destroy();
    this.bars.destroy();
    this.reflection.destroy();
    this.innerRingG.destroy();
    this.outerRingG.destroy();
    this.vignette.destroy();
    this.container.destroy({ children: true });
  }

  /**
   * Draw a circle approximation as a series of line segments forming a ring (stroke).
   */
  private drawRing(
    g: PIXI.Graphics,
    cx: number,
    cy: number,
    radius: number,
    lineWidth: number,
    color: number,
    alpha: number,
  ): void {
    const innerR = radius - lineWidth * 0.5;
    const outerR = radius + lineWidth * 0.5;
    for (let s = 0; s < RING_SEGMENTS; s++) {
      const a0 = (s / RING_SEGMENTS) * TWO_PI;
      const a1 = ((s + 1) / RING_SEGMENTS) * TWO_PI;
      const cos0 = Math.cos(a0);
      const sin0 = Math.sin(a0);
      const cos1 = Math.cos(a1);
      const sin1 = Math.sin(a1);

      g.moveTo(cx + innerR * cos0, cy + innerR * sin0);
      g.lineTo(cx + outerR * cos0, cy + outerR * sin0);
      g.lineTo(cx + outerR * cos1, cy + outerR * sin1);
      g.lineTo(cx + innerR * cos1, cy + innerR * sin1);
      g.closePath();
      g.fill({ color, alpha });
    }
  }

}
