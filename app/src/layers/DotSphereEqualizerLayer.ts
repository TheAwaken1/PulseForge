import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { DotSphereEqualizerLayerConfig, DotSphereGradientPreset } from '../types/project';
import { sampleParam } from '../types/project';
import { mapBins, clamp, hsvToRgbHex, timeFactor60fps, normalizeRate } from './layerUtils';

const MAX_COLUMNS = 128;
const MAX_DOTS = 32;

/** Create a small white circle texture for dot particles. */
function makeDotTexture(size: number): PIXI.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return PIXI.Texture.WHITE;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  // Crisp core with a short feathered edge.
  grad.addColorStop(0.00, 'rgba(255,255,255,1)');
  grad.addColorStop(0.62, 'rgba(255,255,255,1)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

/** Map column fraction (0..1) to a hex color based on gradient preset. */
function gradientColor(t: number, preset: DotSphereGradientPreset): number {
  switch (preset) {
    case 'rainbow': {
      // green(120) -> cyan(180) -> blue(240) -> purple(280) -> red(360/0)
      const h = (120 + t * 240) % 360;
      return hsvToRgbHex(h, 0.92, 1);
    }
    case 'cool': {
      const h = 180 + t * 120; // cyan(180) -> purple(300)
      return hsvToRgbHex(h, 0.85, 1);
    }
    case 'warm': {
      const h = 60 - t * 60; // yellow(60) -> red(0)
      return hsvToRgbHex(h < 0 ? h + 360 : h, 0.9, 1);
    }
    default:
      return 0xffffff;
  }
}

export class DotSphereEqualizerLayerRuntime implements RuntimeLayer<DotSphereEqualizerLayerConfig> {
  id: string;
  container: PIXI.Container;

  private config: DotSphereEqualizerLayerConfig;

  // Particle containers
  private dotTexture!: PIXI.Texture;
  private dotTextureSize = 16;
  private mainPC!: PIXI.ParticleContainer;
  private glowWrap!: PIXI.Container;
  private glowPC!: PIXI.ParticleContainer;
  private glowBlur!: PIXI.BlurFilter;
  private textObj: PIXI.Text | null = null;

  // Particle pools — pre-allocated
  private mainParticles: PIXI.Particle[] = [];
  private glowParticles: PIXI.Particle[] = [];
  private poolSize = 0;

  // Audio state
  private smoothBins = new Float32Array(MAX_COLUMNS);
  private mapped = new Float32Array(MAX_COLUMNS);
  private peaks = new Float32Array(MAX_COLUMNS);

  private lastT = -1;
  private lastW = 0;
  private lastH = 0;

  constructor(config: DotSphereEqualizerLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
  }

  init(ctx: RenderContext): void {
    this.dotTextureSize = this.selectDotTextureSize(ctx.width, ctx.height);
    this.dotTexture = makeDotTexture(this.dotTextureSize);

    // Glow layer: ParticleContainer inside a container with blur
    this.glowWrap = new PIXI.Container();
    this.glowBlur = new PIXI.BlurFilter();
    this.glowBlur.blur = 8;
    this.glowWrap.filters = [this.glowBlur];
    this.glowWrap.blendMode = 'add';

    this.glowPC = new PIXI.ParticleContainer({
      texture: this.dotTexture,
      dynamicProperties: { position: true, color: true, scale: true },
    });
    this.glowWrap.addChild(this.glowPC);
    this.container.addChild(this.glowWrap);

    // Main dot layer
    this.mainPC = new PIXI.ParticleContainer({
      texture: this.dotTexture,
      dynamicProperties: { position: true, color: true, scale: true },
    });
    this.container.addChild(this.mainPC);

    // Pre-allocate particles: max = columns * dotsPerColumn * 2 (upper + mirror)
    this.allocateParticles(MAX_COLUMNS * MAX_DOTS * 2);
  }

  updateConfig(config: DotSphereEqualizerLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    if (!this.mainPC) return;
    this.ensureDotTextureQuality(ctx.width, ctx.height);

    const cfg = this.config;
    const columns = clamp(Math.round(sampleParam(cfg.columns, t)), 32, MAX_COLUMNS);
    const dotsPerCol = clamp(Math.round(sampleParam(cfg.dotsPerColumn, t)), 10, MAX_DOTS);
    const baseRadius = clamp(sampleParam(cfg.baseRadius, t), 2, 8);
    const sphereFrac = clamp(sampleParam(cfg.sphereSize, t), 0.2, 0.5);
    const mirrorEnabled = sampleParam(cfg.mirrorEnabled, t);
    const gain = clamp(sampleParam(cfg.gain, t), 0.1, 5);
    const attack = clamp(sampleParam(cfg.attack, t), 0.01, 0.99);
    const release = clamp(sampleParam(cfg.release, t), 0.01, 0.99);
    const peakEnabled = sampleParam(cfg.peakHoldEnabled, t);
    const peakDecay = clamp(sampleParam(cfg.peakHoldDecay, t), 0.90, 0.99);
    const gradientPreset = cfg.gradientPreset;
    const glowEnabled = sampleParam(cfg.glowEnabled, t);
    const glowStrength = clamp(sampleParam(cfg.glowStrength, t), 0, 3);
    const textEnabled = sampleParam(cfg.textEnabled, t);
    const textString = cfg.textString;

    // Frame-rate normalization
    const frameFactor = timeFactor60fps(t, this.lastT);
    this.lastT = t;
    const aRate = normalizeRate(attack, frameFactor);
    const rRate = normalizeRate(release, frameFactor);

    // Resample audio bins to column count — gain drives amplification directly
    mapBins(audio.bins, this.mapped, columns, gain);

    // Asymmetric smoothing + peak hold (no compression — full dynamic range)
    for (let i = 0; i < columns; i++) {
      const target = clamp(this.mapped[i], 0, 1);
      const prev = this.smoothBins[i];
      const rate = target > prev ? aRate : rRate;
      this.smoothBins[i] = prev + (target - prev) * rate;
      if (peakEnabled) {
        this.peaks[i] = Math.max(this.smoothBins[i], this.peaks[i] * peakDecay);
      }
    }

    // Geometry
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const sphereRx = Math.min(ctx.width, ctx.height) * sphereFrac;
    const sphereRy = sphereRx * 0.85;

    // Glow visibility + blur
    this.glowWrap.visible = glowEnabled;
    if (glowEnabled) {
      this.glowBlur.blur = 6 + glowStrength * 4;
    }

    // Ensure enough particles are allocated
    const dotsNeeded = columns * dotsPerCol * (mirrorEnabled ? 2 : 1) + (peakEnabled ? columns : 0);
    if (dotsNeeded > this.poolSize) {
      this.allocateParticles(dotsNeeded);
    }

    // Base scale for dot radius (texture is 16x16, so scale = radius / 8)
    const baseScale = baseRadius / (this.dotTextureSize * 0.5);

    let pIdx = 0; // particle index

    for (let col = 0; col < columns; col++) {
      const colFrac = col / Math.max(1, columns - 1);
      const colX = cx - sphereRx + colFrac * sphereRx * 2;

      // Sphere silhouette
      const normalizedX = (colX - cx) / sphereRx;
      const sphereH = Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX)) * sphereRy;

      const audioVal = this.smoothBins[col];
      const activeDots = Math.max(1, Math.round(audioVal * dotsPerCol));
      const color = gradientColor(colFrac, gradientPreset);
      const dotSpacing = sphereH / Math.max(1, dotsPerCol);

      // Upper half dots (from center upward)
      // Vertical size gradient: thicker at bottom (d=0, near center), smaller at top
      for (let d = 0; d < dotsPerCol; d++) {
        const dotY = cy - (d + 1) * dotSpacing;
        const isActive = d < activeDots;
        const heightFrac = d / Math.max(1, dotsPerCol - 1); // 0=bottom, 1=top
        const sizeMult = 1.3 - heightFrac * 0.6; // 1.3x at bottom → 0.7x at top
        const alpha = isActive ? clamp(0.7 + audioVal * 0.3, 0, 1) : 0.08;
        const s = isActive
          ? baseScale * (0.8 + audioVal * 0.4) * sizeMult
          : baseScale * 0.5 * sizeMult;

        const p = this.mainParticles[pIdx];
        p.x = colX;
        p.y = dotY;
        p.scaleX = s;
        p.scaleY = s;
        p.tint = color;
        p.alpha = alpha;

        if (glowEnabled && isActive) {
          const gp = this.glowParticles[pIdx];
          gp.x = colX;
          gp.y = dotY;
          gp.scaleX = s * 1.8;
          gp.scaleY = s * 1.8;
          gp.tint = color;
          gp.alpha = alpha * 0.3 * glowStrength;
        } else {
          this.glowParticles[pIdx].alpha = 0;
        }

        pIdx++;
      }

      // Mirror (lower half) — thicker at bottom (d=dotsPerCol-1)
      if (mirrorEnabled) {
        for (let d = 0; d < dotsPerCol; d++) {
          const dotY = cy + (d + 1) * dotSpacing;
          const isActive = d < activeDots;
          const heightFrac = d / Math.max(1, dotsPerCol - 1); // 0=center, 1=bottom
          const sizeMult = 1.0 + heightFrac * 0.3; // 1.0x at center → 1.3x at bottom
          const alpha = isActive ? clamp(0.4 + audioVal * 0.2, 0, 0.6) : 0.04;
          const s = isActive
            ? baseScale * (0.7 + audioVal * 0.3) * sizeMult
            : baseScale * 0.4 * sizeMult;

          const p = this.mainParticles[pIdx];
          p.x = colX;
          p.y = dotY;
          p.scaleX = s;
          p.scaleY = s;
          p.tint = color;
          p.alpha = alpha;

          this.glowParticles[pIdx].alpha = 0;
          pIdx++;
        }
      }

      // Peak hold dot
      if (peakEnabled) {
        const peakDot = Math.max(0, Math.round(this.peaks[col] * dotsPerCol) - 1);
        const peakY = cy - (peakDot + 1) * dotSpacing;
        const p = this.mainParticles[pIdx];
        p.x = colX;
        p.y = peakY;
        p.scaleX = baseScale * 0.7;
        p.scaleY = baseScale * 0.7;
        p.tint = 0xffffff;
        p.alpha = 0.9;
        this.glowParticles[pIdx].alpha = 0;
        pIdx++;
      }
    }

    // Hide unused particles
    for (let i = pIdx; i < this.poolSize; i++) {
      this.mainParticles[i].alpha = 0;
      this.glowParticles[i].alpha = 0;
    }

    // Text overlay
    this.updateText(textEnabled, textString, cx, cy);
  }

  private allocateParticles(count: number): void {
    // Add more particles up to count
    for (let i = this.poolSize; i < count; i++) {
      const mp = new PIXI.Particle({
        texture: this.dotTexture,
        anchorX: 0.5,
        anchorY: 0.5,
      });
      mp.alpha = 0;
      this.mainParticles.push(mp);
      this.mainPC.addParticle(mp);

      const gp = new PIXI.Particle({
        texture: this.dotTexture,
        anchorX: 0.5,
        anchorY: 0.5,
      });
      gp.alpha = 0;
      this.glowParticles.push(gp);
      this.glowPC.addParticle(gp);
    }
    this.poolSize = Math.max(this.poolSize, count);
  }

  private selectDotTextureSize(width: number, height: number): number {
    const minDim = Math.min(width, height);
    if (minDim >= 2000) return 48;
    if (minDim >= 1200) return 40;
    if (minDim >= 900) return 32;
    if (minDim >= 700) return 24;
    return 24;
  }

  private ensureDotTextureQuality(width: number, height: number): void {
    const nextSize = this.selectDotTextureSize(width, height);
    if (nextSize === this.dotTextureSize) return;

    const previousTexture = this.dotTexture;
    this.dotTextureSize = nextSize;
    this.dotTexture = makeDotTexture(nextSize);

    for (const p of this.mainParticles) p.texture = this.dotTexture;
    for (const p of this.glowParticles) p.texture = this.dotTexture;

    if (previousTexture && previousTexture !== PIXI.Texture.WHITE) {
      previousTexture.destroy(true);
    }
  }

  private updateText(enabled: boolean, text: string, cx: number, cy: number): void {
    if (!enabled) {
      if (this.textObj) this.textObj.visible = false;
      return;
    }
    if (!this.textObj) {
      this.textObj = new PIXI.Text({
        text,
        style: {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 28,
          fontWeight: 'bold',
          fill: 0xffffff,
          letterSpacing: 8,
          align: 'center',
        },
      });
      this.textObj.anchor.set(0.5, 0.5);
      this.textObj.alpha = 0.55;
      this.container.addChild(this.textObj);
    }
    this.textObj.visible = true;
    if (this.textObj.text !== text) this.textObj.text = text;
    this.textObj.position.set(cx, cy);
  }

  destroy(): void {
    if (this.dotTexture !== PIXI.Texture.WHITE) this.dotTexture.destroy(true);
    if (this.textObj) this.textObj.destroy();
    this.container.destroy({ children: true });
  }
}
