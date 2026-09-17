import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { ParticleFieldLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { bandStatsAudio, clamp, hexStringToNumber, lerpColor, rainbowAt } from './layerUtils';

/**
 * ParticleFieldLayer: audio-reactive particle system with multiple spawn patterns.
 *
 * Uses SOA (Structure of Arrays) particle pool for cache-friendly updates.
 * Supports radial, orbital, rain, and fountain spawn patterns with
 * audio-driven spawning, speed, size modulation, beat bursts, trails, and glow.
 */
export class ParticleFieldLayerRuntime implements RuntimeLayer<ParticleFieldLayerConfig> {
  id: string;
  container: PIXI.Container;

  private config: ParticleFieldLayerConfig;
  private graphics: PIXI.Graphics;
  private glowGraphics: PIXI.Graphics;
  private glowBlur: PIXI.BlurFilter;

  // SOA particle pool
  private px!: Float32Array;
  private py!: Float32Array;
  private vx!: Float32Array;
  private vy!: Float32Array;
  private life!: Float32Array;
  private maxLife!: Float32Array;
  private size!: Float32Array;
  private hue!: Float32Array;
  private alive = 0;
  private poolSize = 0;

  private lastT = -1;
  private spawnAccumulator = 0;

  constructor(config: ParticleFieldLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.graphics = new PIXI.Graphics();
    this.glowGraphics = new PIXI.Graphics();
    this.glowBlur = new PIXI.BlurFilter();
    this.glowBlur.blur = 8;
    this.glowGraphics.filters = [this.glowBlur];
    this.glowGraphics.blendMode = 'add' as PIXI.BLEND_MODES;

    this.container.addChild(this.glowGraphics);
    this.container.addChild(this.graphics);

    this.allocatePool(Math.round(sampleParam(config.maxParticles, 0)));
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: ParticleFieldLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    const cfg = this.config;

    // Sample all Param values
    const maxParticles = clamp(Math.round(sampleParam(cfg.maxParticles, t)), 50, 2000);
    const spawnRate = clamp(sampleParam(cfg.spawnRate, t), 0, 100);
    const baseSpeed = clamp(sampleParam(cfg.baseSpeed, t), 0, 5);
    const baseSize = clamp(sampleParam(cfg.baseSize, t), 1, 20);
    const sizeVariation = clamp(sampleParam(cfg.sizeVariation, t), 0, 1);
    const lifetime = clamp(sampleParam(cfg.lifetime, t), 0.5, 10);
    const pattern = cfg.pattern;
    const gravityY = clamp(sampleParam(cfg.gravityY, t), -2, 2);
    const colorMode = cfg.colorMode;
    const solidColor = sampleParam(cfg.solidColor, t);
    const gradientColor1 = sampleParam(cfg.gradientColor1, t);
    const gradientColor2 = sampleParam(cfg.gradientColor2, t);
    const audioSpawnBoost = clamp(sampleParam(cfg.audioSpawnBoost, t), 0, 5);
    const audioSpeedBoost = clamp(sampleParam(cfg.audioSpeedBoost, t), 0, 3);
    const audioSizeBoost = clamp(sampleParam(cfg.audioSizeBoost, t), 0, 3);
    const trailLength = clamp(sampleParam(cfg.trailLength, t), 0, 1);
    const glowEnabled = sampleParam(cfg.glowEnabled, t);
    const glowStrength = clamp(sampleParam(cfg.glowStrength, t), 0, 3);
    const burstOnBeat = sampleParam(cfg.burstOnBeat, t);
    const burstThreshold = clamp(sampleParam(cfg.burstThreshold, t), 0, 1);
    const burstCount = clamp(Math.round(sampleParam(cfg.burstCount, t)), 10, 200);

    // Ensure pool size
    if (this.poolSize !== maxParticles) {
      this.resizePool(maxParticles);
    }

    // Compute dt
    let dt: number;
    if (this.lastT < 0 || t <= this.lastT) {
      dt = 1 / 60;
    } else {
      dt = clamp(t - this.lastT, 0, 0.1); // cap at 100ms to avoid explosion
    }
    this.lastT = t;

    // Audio stats
    const { bass, mid, treble } = bandStatsAudio(audio.bins);
    const rms = audio.rms;
    const speedMult = 1 + (bass * 0.5 + mid * 0.3 + treble * 0.2) * audioSpeedBoost;
    const sizeMult = 1 + rms * audioSizeBoost;

    const cx = ctx.width / 2;
    const cy = ctx.height / 2;

    // --- Update alive particles ---
    let writeIdx = 0;
    for (let i = 0; i < this.alive; i++) {
      // Decrease life
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;

      // Apply gravity
      this.vy[i] += gravityY * 100 * dt;

      // Update position
      this.px[i] += this.vx[i] * dt * speedMult;
      this.py[i] += this.vy[i] * dt * speedMult;

      // Compact: copy to writeIdx if it differs
      if (writeIdx !== i) {
        this.px[writeIdx] = this.px[i];
        this.py[writeIdx] = this.py[i];
        this.vx[writeIdx] = this.vx[i];
        this.vy[writeIdx] = this.vy[i];
        this.life[writeIdx] = this.life[i];
        this.maxLife[writeIdx] = this.maxLife[i];
        this.size[writeIdx] = this.size[i];
        this.hue[writeIdx] = this.hue[i];
      }
      writeIdx++;
    }
    this.alive = writeIdx;

    // --- Spawn new particles ---
    const effectiveSpawnRate = spawnRate * (1 + bass * audioSpawnBoost);
    this.spawnAccumulator += effectiveSpawnRate * dt;
    const toSpawn = Math.floor(this.spawnAccumulator);
    this.spawnAccumulator -= toSpawn;
    for (let s = 0; s < toSpawn && this.alive < maxParticles; s++) {
      this.spawnParticle(pattern, cx, cy, ctx.width, ctx.height, baseSpeed, baseSize, sizeVariation, lifetime);
    }

    // --- Beat burst: use true beat detection instead of RMS-delta heuristic ---
    if (burstOnBeat && audio.beat && rms > burstThreshold) {
      for (let b = 0; b < burstCount && this.alive < maxParticles; b++) {
        this.spawnParticle(pattern, cx, cy, ctx.width, ctx.height, baseSpeed * 1.5, baseSize * 1.3, sizeVariation, lifetime * 0.7);
      }
    }

    // --- Precompute color values ---
    const solidHex = hexStringToNumber(solidColor);
    const grad1Hex = hexStringToNumber(gradientColor1);
    const grad2Hex = hexStringToNumber(gradientColor2);

    // --- Draw ---
    this.graphics.clear();
    this.glowGraphics.clear();
    this.glowGraphics.visible = glowEnabled;
    if (glowEnabled) {
      this.glowBlur.blur = 6 + glowStrength * 4;
    }

    for (let i = 0; i < this.alive; i++) {
      const x = this.px[i];
      const y = this.py[i];
      const lifeRatio = clamp(this.life[i] / this.maxLife[i], 0, 1);

      // Alpha: fade out near end of life, quick fade in during first 10%
      let alpha: number;
      if (lifeRatio > 0.9) {
        // Fade in: first 10% of life (lifeRatio goes from 1.0 down)
        alpha = clamp((1.0 - lifeRatio) / 0.1, 0, 1);
      } else {
        alpha = clamp(lifeRatio / 0.2, 0, 1);
      }

      const particleSize = this.size[i] * sizeMult;

      // Determine color
      let color: number;
      switch (colorMode) {
        case 'rainbow':
          color = rainbowAt(this.hue[i], 1.0);
          break;
        case 'solid':
          color = solidHex;
          break;
        case 'gradient':
          color = lerpColor(grad1Hex, grad2Hex, 1 - lifeRatio);
          break;
        default:
          color = solidHex;
      }

      // Draw particle circle
      this.graphics.circle(x, y, particleSize).fill({ color, alpha });

      // Draw trail
      if (trailLength > 0) {
        const tx = x - this.vx[i] * trailLength * 0.05;
        const ty = y - this.vy[i] * trailLength * 0.05;
        this.graphics
          .moveTo(x, y)
          .lineTo(tx, ty)
          .stroke({ color, alpha: alpha * 0.5, width: Math.max(1, particleSize * 0.5) });
      }

      // Draw glow
      if (glowEnabled) {
        const glowAlpha = alpha * 0.25 * glowStrength;
        this.glowGraphics.circle(x, y, particleSize * 1.5).fill({ color, alpha: glowAlpha });
      }
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.glowGraphics.destroy();
    this.container.destroy({ children: true });
  }

  // --- Private helpers ---

  private allocatePool(size: number): void {
    this.poolSize = size;
    this.px = new Float32Array(size);
    this.py = new Float32Array(size);
    this.vx = new Float32Array(size);
    this.vy = new Float32Array(size);
    this.life = new Float32Array(size);
    this.maxLife = new Float32Array(size);
    this.size = new Float32Array(size);
    this.hue = new Float32Array(size);
    this.alive = 0;
  }

  private resizePool(newSize: number): void {
    const oldAlive = Math.min(this.alive, newSize);
    const oldPx = this.px, oldPy = this.py;
    const oldVx = this.vx, oldVy = this.vy;
    const oldLife = this.life, oldMaxLife = this.maxLife;
    const oldSize = this.size, oldHue = this.hue;

    this.allocatePool(newSize);

    // Copy surviving particles
    for (let i = 0; i < oldAlive; i++) {
      this.px[i] = oldPx[i];
      this.py[i] = oldPy[i];
      this.vx[i] = oldVx[i];
      this.vy[i] = oldVy[i];
      this.life[i] = oldLife[i];
      this.maxLife[i] = oldMaxLife[i];
      this.size[i] = oldSize[i];
      this.hue[i] = oldHue[i];
    }
    this.alive = oldAlive;
  }

  private spawnParticle(
    pattern: string,
    cx: number, cy: number,
    width: number, height: number,
    baseSpeed: number, baseSize: number,
    sizeVariation: number, lifetime: number,
  ): void {
    const idx = this.alive;
    if (idx >= this.poolSize) return;

    const angle = Math.random() * Math.PI * 2;
    const speedPx = baseSpeed * 100; // scale to pixels/sec

    switch (pattern) {
      case 'radial': {
        this.px[idx] = cx;
        this.py[idx] = cy;
        this.vx[idx] = Math.cos(angle) * speedPx;
        this.vy[idx] = Math.sin(angle) * speedPx;
        break;
      }
      case 'orbital': {
        const r = 50 + Math.random() * Math.min(width, height) * 0.3;
        this.px[idx] = cx + Math.cos(angle) * r;
        this.py[idx] = cy + Math.sin(angle) * r;
        // Tangential velocity (perpendicular to radius)
        this.vx[idx] = -Math.sin(angle) * speedPx;
        this.vy[idx] = Math.cos(angle) * speedPx;
        break;
      }
      case 'rain': {
        this.px[idx] = Math.random() * width;
        this.py[idx] = -10;
        this.vx[idx] = (Math.random() - 0.5) * speedPx * 0.2;
        this.vy[idx] = speedPx;
        break;
      }
      case 'fountain': {
        this.px[idx] = cx + (Math.random() - 0.5) * 40;
        this.py[idx] = height;
        this.vx[idx] = (Math.random() - 0.5) * speedPx * 0.6;
        this.vy[idx] = -speedPx;
        break;
      }
      default: {
        // Fallback to radial
        this.px[idx] = cx;
        this.py[idx] = cy;
        this.vx[idx] = Math.cos(angle) * speedPx;
        this.vy[idx] = Math.sin(angle) * speedPx;
      }
    }

    this.life[idx] = lifetime * (0.5 + Math.random() * 0.5);
    this.maxLife[idx] = this.life[idx];
    this.size[idx] = baseSize * (1 - sizeVariation + Math.random() * sizeVariation * 2);
    this.hue[idx] = Math.random();
    this.alive++;
  }
}
