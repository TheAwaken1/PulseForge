import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { EnergyRibbonLayerConfig, EnergyRibbonTheme } from '../types/project';
import { sampleParam } from '../types/project';
import { avg, clamp, mapBins, normalizeRate, timeFactor60fps } from './layerUtils';

const DEFAULT_SAMPLES = 192;
const DEFAULT_SPIKES = 96;

type ThemeColors = { white: string; cyan: string; blue: string };

function themeColors(theme: EnergyRibbonTheme): ThemeColors {
  switch (theme) {
    case 'ice':
      return { white: '#ffffff', cyan: '#b8f5ff', blue: '#4da3ff' };
    case 'sunset':
      return { white: '#fff6f0', cyan: '#ff9a52', blue: '#ff2e9e' };
    default:
      return { white: '#ffffff', cyan: '#00f3ff', blue: '#1e54ff' };
  }
}

function makeRibbonTexture(colors: ThemeColors): PIXI.Texture {
  const w = 32;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return PIXI.Texture.WHITE;

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.18, colors.blue);
  grad.addColorStop(0.42, colors.cyan);
  grad.addColorStop(0.5, colors.white);
  grad.addColorStop(0.58, colors.cyan);
  grad.addColorStop(0.82, colors.blue);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  return PIXI.Texture.from(canvas);
}

function makeSpikeTexture(colors: ThemeColors): PIXI.Texture {
  const w = 32;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return PIXI.Texture.WHITE;

  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0.0, colors.white);
  grad.addColorStop(0.38, colors.cyan);
  grad.addColorStop(0.78, colors.blue);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  return PIXI.Texture.from(canvas);
}

export class EnergyRibbonLayerRuntime implements RuntimeLayer<EnergyRibbonLayerConfig> {
  id: string;
  container: PIXI.Container;

  private config: EnergyRibbonLayerConfig;
  private points: PIXI.Point[] = [];
  private pointsMirror: PIXI.Point[] = [];
  private ribbon!: PIXI.MeshRope;
  private ribbonMirror!: PIXI.MeshRope;
  private spikes!: PIXI.MeshSimple;
  private spikesMirror!: PIXI.MeshSimple;
  private core!: PIXI.Sprite;
  private sharpContainer!: PIXI.Container;
  private glowContainer!: PIXI.Container;
  private glowFilter = new PIXI.BlurFilter();
  private ribbonGlow!: PIXI.MeshRope;
  private ribbonMirrorGlow!: PIXI.MeshRope;

  private mapped = new Float32Array(DEFAULT_SAMPLES);
  private smoothBins = new Float32Array(DEFAULT_SAMPLES);
  private displace = new Float32Array(DEFAULT_SAMPLES);

  private spikeVerts = new Float32Array(DEFAULT_SPIKES * 3 * 2) as unknown as Float32Array;
  private spikeVertsMirror = new Float32Array(DEFAULT_SPIKES * 3 * 2) as unknown as Float32Array;

  private ribbonTexture: PIXI.Texture = PIXI.Texture.WHITE;
  private spikeTexture: PIXI.Texture = PIXI.Texture.WHITE;
  private activeTheme: EnergyRibbonTheme | null = null;
  private lastW = 0;
  private lastH = 0;
  private lastT = -1;

  private rmsSmooth = 0;
  private transientSmooth = 0;
  private bassSmooth = 0;
  private prevHigh = 0;
  private glowSmooth = 0;

  constructor(config: EnergyRibbonLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
  }

  init(ctx: RenderContext): void {
    this.ensureTextures();

    // Glow layer: blurred duplicate ribbons for soft ambient glow
    this.glowContainer = new PIXI.Container();
    this.glowFilter.blur = 6;
    this.glowContainer.filters = [this.glowFilter];
    this.glowContainer.filterArea = new PIXI.Rectangle(0, 0, ctx.width, ctx.height);
    this.container.addChild(this.glowContainer);

    // Sharp layer: crisp ribbon, spikes, core (no blur)
    this.sharpContainer = new PIXI.Container();
    this.container.addChild(this.sharpContainer);

    this.buildGeometry(ctx.width, ctx.height);
  }

  updateConfig(config: EnergyRibbonLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    if (!this.ribbon || !this.spikes) return;
    this.ensureTextures();
    if (ctx.width !== this.lastW || ctx.height !== this.lastH) {
      this.buildGeometry(ctx.width, ctx.height);
      this.glowContainer.filterArea = new PIXI.Rectangle(0, 0, ctx.width, ctx.height);
    }

    const samples = this.smoothBins.length;
    const spikes = this.spikeVerts.length / 6;

    const intensity = sampleParam(this.config.intensity, t);
    const glowStrength = sampleParam(this.config.glowStrength, t);
    const spikeSensitivity = sampleParam(this.config.spikeSensitivity, t);
    const thicknessBase = sampleParam(this.config.ribbonThickness, t);
    const attack = clamp(sampleParam(this.config.smoothing.attack, t), 0.01, 0.99);
    const release = clamp(sampleParam(this.config.smoothing.release, t), 0.01, 0.99);
    const mirrorEnabled = sampleParam(this.config.mirrorReflection, t);

    const frameFactor = timeFactor60fps(t, this.lastT);
    this.lastT = t;
    const aRate = normalizeRate(attack, frameFactor);
    const rRate = normalizeRate(release, frameFactor);

    const low = avg(audio.bins, 0, Math.max(0, Math.floor(audio.bins.length * 0.18)));
    const highStart = Math.max(0, Math.floor(audio.bins.length * 0.62));
    const high = avg(audio.bins, highStart, audio.bins.length - 1);
    const transientRaw = clamp((high - this.prevHigh) * 4.0 + high * 0.45, 0, 1.5);
    this.prevHigh = high;

    this.rmsSmooth += (audio.rms - this.rmsSmooth) * (audio.rms > this.rmsSmooth ? aRate : rRate);
    this.bassSmooth += (low - this.bassSmooth) * (low > this.bassSmooth ? aRate : rRate);
    this.transientSmooth += (transientRaw - this.transientSmooth) * (transientRaw > this.transientSmooth ? aRate : rRate);

    mapBins(audio.bins, this.mapped, samples, 0.55 + intensity * 0.35);

    for (let i = 0; i < samples; i++) {
      const target = clamp(this.mapped[i], 0, 1);
      const prev = this.smoothBins[i];
      const rate = target > prev ? aRate : rRate;
      this.smoothBins[i] = prev + (target - prev) * rate;
    }

    const amp = ctx.height * (0.018 + intensity * 0.045);
    const centerY = ctx.height * 0.5;
    const baseThickness = Math.max(1.5, thicknessBase * (0.55 + this.rmsSmooth * 1.8));

    for (let i = 1; i < samples - 1; i++) {
      const local = (this.smoothBins[i - 1] + this.smoothBins[i] + this.smoothBins[i + 1]) / 3;
      const signed = (this.smoothBins[i] - local) * 1.55;
      const prev = this.displace[i];
      const target = signed * amp;
      this.displace[i] = prev + (target - prev) * (0.10 + aRate * 0.24);
      this.displace[i] = clamp(this.displace[i], -ctx.height * 0.08, ctx.height * 0.08);
    }
    this.displace[0] = this.displace[1];
    this.displace[samples - 1] = this.displace[samples - 2];

    for (let i = 0; i < samples; i++) {
      const y = centerY + this.displace[i];
      this.points[i].y = y;
      this.pointsMirror[i].y = centerY + (centerY - y) * 0.7 + 14;
    }

    const coreH = Math.max(1, 1.8 + this.bassSmooth * 6 + baseThickness * 0.08);
    this.core.position.set(ctx.width * 0.5, centerY);
    this.core.width = ctx.width * 0.96;
    this.core.height = coreH;
    this.core.alpha = clamp(0.76 + this.rmsSmooth * 0.22, 0, 1);

    const spikeMax = ctx.height * 0.13;
    const spikeW = 0.75 + this.bassSmooth * 2.6;
    for (let i = 0; i < spikes; i++) {
      const si = Math.round((i / Math.max(1, spikes - 1)) * (samples - 1));
      const x = this.points[si].x;
      const y = this.points[si].y;
      const localE = this.smoothBins[si];
      const h = clamp((this.transientSmooth * 0.62 + localE * 0.3) * spikeSensitivity * spikeMax, 0, spikeMax);
      const bw = spikeW * (0.7 + localE * 0.35);

      const v = i * 6;
      this.spikeVerts[v + 0] = x - bw;
      this.spikeVerts[v + 1] = y;
      this.spikeVerts[v + 2] = x + bw;
      this.spikeVerts[v + 3] = y;
      this.spikeVerts[v + 4] = x;
      this.spikeVerts[v + 5] = y - h;

      const my = this.pointsMirror[si].y;
      this.spikeVertsMirror[v + 0] = x - bw * 0.85;
      this.spikeVertsMirror[v + 1] = my;
      this.spikeVertsMirror[v + 2] = x + bw * 0.85;
      this.spikeVertsMirror[v + 3] = my;
      this.spikeVertsMirror[v + 4] = x;
      this.spikeVertsMirror[v + 5] = my + h * 0.55;
    }

    this.spikes.vertices = this.spikeVerts;
    this.spikesMirror.vertices = this.spikeVertsMirror;
    this.ribbonMirror.visible = mirrorEnabled;
    this.spikesMirror.visible = mirrorEnabled;
    this.ribbonMirrorGlow.visible = mirrorEnabled;

    const glowTarget = clamp((0.24 + this.rmsSmooth * 0.36 + this.transientSmooth * 0.14) * glowStrength, 0, 2.2);
    this.glowSmooth += (glowTarget - this.glowSmooth) * (glowTarget > this.glowSmooth ? aRate : rRate);
    this.glowFilter.blur = 4 + this.glowSmooth * 5;
    this.glowContainer.alpha = clamp(0.35 + this.glowSmooth * 0.3, 0, 0.7);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    if (this.ribbonTexture !== PIXI.Texture.WHITE) this.ribbonTexture.destroy(true);
    if (this.spikeTexture !== PIXI.Texture.WHITE) this.spikeTexture.destroy(true);
  }

  private ensureTextures(): void {
    const theme = sampleParam(this.config.colorTheme, 0);
    if (theme === this.activeTheme) return;
    this.activeTheme = theme;
    const colors = themeColors(theme);

    if (this.ribbonTexture !== PIXI.Texture.WHITE) this.ribbonTexture.destroy(true);
    if (this.spikeTexture !== PIXI.Texture.WHITE) this.spikeTexture.destroy(true);
    this.ribbonTexture = makeRibbonTexture(colors);
    this.spikeTexture = makeSpikeTexture(colors);

    if (this.ribbon) this.ribbon.texture = this.ribbonTexture;
    if (this.ribbonMirror) this.ribbonMirror.texture = this.ribbonTexture;
    if (this.ribbonGlow) this.ribbonGlow.texture = this.ribbonTexture;
    if (this.ribbonMirrorGlow) this.ribbonMirrorGlow.texture = this.ribbonTexture;
    if (this.spikes) this.spikes.texture = this.spikeTexture;
    if (this.spikesMirror) this.spikesMirror.texture = this.spikeTexture;
  }

  private buildGeometry(width: number, height: number): void {
    this.lastW = width;
    this.lastH = height;
    const sampleCount = clamp(Math.round(sampleParam(this.config.sampleCount, 0)), 64, 384);
    const spikeCount = clamp(Math.round(sampleParam(this.config.spikeCount, 0)), 16, 192);

    this.points = new Array(sampleCount);
    this.pointsMirror = new Array(sampleCount);
    this.mapped = new Float32Array(sampleCount);
    this.smoothBins = new Float32Array(sampleCount);
    this.displace = new Float32Array(sampleCount);

    const y = height * 0.5;
    for (let i = 0; i < sampleCount; i++) {
      const x = (i / Math.max(1, sampleCount - 1)) * width;
      this.points[i] = new PIXI.Point(x, y);
      this.pointsMirror[i] = new PIXI.Point(x, y + 12);
    }

    const newRibbon = new PIXI.MeshRope({
      texture: this.ribbonTexture,
      points: this.points,
      textureScale: 1,
    });
    newRibbon.blendMode = 'add';
    newRibbon.alpha = 0.92;

    const newRibbonMirror = new PIXI.MeshRope({
      texture: this.ribbonTexture,
      points: this.pointsMirror,
      textureScale: 1,
    });
    newRibbonMirror.blendMode = 'add';
    newRibbonMirror.alpha = 0.28;

    const { mesh: newSpikes, vertices: newSpikeVerts } = this.createSpikeMesh(spikeCount);
    newSpikes.texture = this.spikeTexture;
    newSpikes.blendMode = 'add';
    newSpikes.alpha = 0.8;

    const { mesh: newSpikesMirror, vertices: newSpikeVertsMirror } = this.createSpikeMesh(spikeCount);
    newSpikesMirror.texture = this.spikeTexture;
    newSpikesMirror.blendMode = 'add';
    newSpikesMirror.alpha = 0.25;

    const newCore = new PIXI.Sprite(PIXI.Texture.WHITE);
    newCore.anchor.set(0.5, 0.5);
    newCore.tint = 0xffffff;
    newCore.blendMode = 'add';
    newCore.alpha = 0.9;

    // Glow ribbon duplicates (share same point arrays — auto-track position)
    const newRibbonGlow = new PIXI.MeshRope({
      texture: this.ribbonTexture,
      points: this.points,
      textureScale: 1,
    });
    newRibbonGlow.blendMode = 'add';
    newRibbonGlow.alpha = 0.7;

    const newRibbonMirrorGlow = new PIXI.MeshRope({
      texture: this.ribbonTexture,
      points: this.pointsMirror,
      textureScale: 1,
    });
    newRibbonMirrorGlow.blendMode = 'add';
    newRibbonMirrorGlow.alpha = 0.3;

    if (this.core) {
      this.sharpContainer.removeChildren();
      this.glowContainer.removeChildren();
      this.ribbon.destroy();
      this.ribbonMirror.destroy();
      this.spikes.destroy();
      this.spikesMirror.destroy();
      this.core.destroy();
      this.ribbonGlow.destroy();
      this.ribbonMirrorGlow.destroy();
    }

    this.ribbon = newRibbon;
    this.ribbonMirror = newRibbonMirror;
    this.spikes = newSpikes;
    this.spikesMirror = newSpikesMirror;
    this.core = newCore;
    this.ribbonGlow = newRibbonGlow;
    this.ribbonMirrorGlow = newRibbonMirrorGlow;
    this.spikeVerts = newSpikeVerts as unknown as Float32Array;
    this.spikeVertsMirror = newSpikeVertsMirror as unknown as Float32Array;

    // Glow container: blurred ribbons for ambient glow
    this.glowContainer.addChild(this.ribbonMirrorGlow);
    this.glowContainer.addChild(this.ribbonGlow);

    // Sharp container: crisp ribbon, spikes, core
    this.sharpContainer.addChild(this.ribbonMirror);
    this.sharpContainer.addChild(this.spikesMirror);
    this.sharpContainer.addChild(this.ribbon);
    this.sharpContainer.addChild(this.spikes);
    this.sharpContainer.addChild(this.core);
  }

  private createSpikeMesh(count: number): { mesh: PIXI.MeshSimple; vertices: Float32Array } {
    const vertices = new Float32Array(count * 3 * 2);
    const uvs = new Float32Array(count * 3 * 2);
    const indices = new Uint32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const v = i * 6;
      const ui = i * 6;
      const ii = i * 3;

      vertices[v + 0] = 0;
      vertices[v + 1] = 0;
      vertices[v + 2] = 0;
      vertices[v + 3] = 0;
      vertices[v + 4] = 0;
      vertices[v + 5] = 0;

      uvs[ui + 0] = 0;
      uvs[ui + 1] = 1;
      uvs[ui + 2] = 1;
      uvs[ui + 3] = 1;
      uvs[ui + 4] = 0.5;
      uvs[ui + 5] = 0;

      indices[ii + 0] = i * 3 + 0;
      indices[ii + 1] = i * 3 + 1;
      indices[ii + 2] = i * 3 + 2;
    }

    const mesh = new PIXI.MeshSimple({
      texture: this.spikeTexture,
      vertices,
      uvs,
      indices,
      topology: 'triangle-list',
    });
    return { mesh, vertices };
  }
}
