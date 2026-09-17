import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { SpectrogramLayerConfig, SpectrogramColorScheme } from '../types/project';
import { sampleParam } from '../types/project';
import { clamp } from './layerUtils';

const BIN_COUNT = 72;
const HISTORY_WIDTH = 512;

function heatColor(v: number): [number, number, number] {
  // black → dark red → orange → yellow → white
  const r = clamp(v * 3.0, 0, 1);
  const g = clamp(v * 3.0 - 1.0, 0, 1);
  const b = clamp(v * 3.0 - 2.0, 0, 1);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function coolColor(v: number): [number, number, number] {
  // black → dark blue → cyan → white
  const b = clamp(v * 2.0, 0, 1);
  const g = clamp(v * 2.0 - 0.5, 0, 1);
  const r = clamp(v * 2.0 - 1.0, 0, 1);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rainbowColor(v: number, binFrac: number): [number, number, number] {
  // Hue varies with frequency (bin), brightness varies with magnitude
  // bass = blue (240°), treble = red (0°)
  const h = (1.0 - binFrac) * 240; // 240° (blue) for bass → 0° (red) for treble
  const s = 1.0;
  const lv = v;
  // HSL → RGB with v controlling lightness
  const hk = h / 60;
  const c = (1 - Math.abs(2 * lv - 1)) * s;
  const x = c * (1 - Math.abs(hk % 2 - 1));
  let r = 0, g = 0, b = 0;
  if (hk < 1) { r = c; g = x; }
  else if (hk < 2) { r = x; g = c; }
  else if (hk < 3) { g = c; b = x; }
  else if (hk < 4) { g = x; b = c; }
  else if (hk < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = lv - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function getColor(v: number, binFrac: number, scheme: SpectrogramColorScheme): [number, number, number] {
  switch (scheme) {
    case 'heat': return heatColor(v);
    case 'cool': return coolColor(v);
    case 'rainbow': return rainbowColor(v, binFrac);
    default: { const bv = Math.round(v * 255); return [bv, bv, bv]; }
  }
}

export class SpectrogramLayerRuntime implements RuntimeLayer<SpectrogramLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: SpectrogramLayerConfig;

  private canvas!: HTMLCanvasElement;
  private ctx2d!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private view32!: Uint32Array;
  private texture!: PIXI.Texture;
  private sprite!: PIXI.Sprite;

  private beatFlash = 0;
  private lastT = -1;

  constructor(config: SpectrogramLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
  }

  init(_ctx: RenderContext): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = HISTORY_WIDTH;
    this.canvas.height = BIN_COUNT;
    this.ctx2d = this.canvas.getContext('2d')!;
    this.imageData = this.ctx2d.createImageData(HISTORY_WIDTH, BIN_COUNT);
    // Pre-fill alpha channel to 255
    const data = this.imageData.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    this.view32 = new Uint32Array(data.buffer);

    this.texture = PIXI.Texture.from(this.canvas);
    this.sprite = new PIXI.Sprite(this.texture);
    this.sprite.anchor.set(0, 0);
    this.container.addChild(this.sprite);
  }

  updateConfig(config: SpectrogramLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    if (!this.sprite) return;

    const cfg = this.config;
    const dt = this.lastT >= 0 ? Math.min(0.2, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;

    if (audio.beat) {
      this.beatFlash = 1.0;
    } else {
      this.beatFlash *= Math.pow(0.65, dt * 60);
    }

    const gain = clamp(sampleParam(cfg.gain, t), 0.1, 5);
    const heightFrac = clamp(sampleParam(cfg.heightFraction, t), 0.05, 1.0);
    const posY = clamp(sampleParam(cfg.positionY, t), 0, 1);
    const scheme = cfg.colorScheme;
    const logScale = cfg.logScale;
    const beatMarker = cfg.beatMarker;

    const view = this.view32;

    // Shift all columns left by 1 using fast Uint32Array.copyWithin per row
    for (let y = 0; y < BIN_COUNT; y++) {
      const rowStart = y * HISTORY_WIDTH;
      view.copyWithin(rowStart, rowStart + 1, rowStart + HISTORY_WIDTH);
    }

    // Write new column on the right edge
    const writeX = HISTORY_WIDTH - 1;

    if (beatMarker && this.beatFlash > 0.7) {
      // Beat marker: white flash column
      const bv = Math.round(this.beatFlash * 255);
      const packed = (0xFF << 24) | (bv << 16) | (bv << 8) | bv;
      for (let bin = 0; bin < BIN_COUNT; bin++) {
        const y = BIN_COUNT - 1 - bin;
        view[y * HISTORY_WIDTH + writeX] = packed;
      }
    } else {
      for (let bin = 0; bin < BIN_COUNT; bin++) {
        // Map canvas y: y=0 is top (high freq), y=BIN_COUNT-1 is bottom (low freq = bass)
        const canvasY = BIN_COUNT - 1 - bin;

        // Map bin → source frequency bin index
        let srcBin: number;
        if (logScale) {
          // Logarithmic frequency mapping: compress bass, expand treble
          const logFrac = Math.log2(1 + (bin / (BIN_COUNT - 1)) * 15) / Math.log2(16);
          srcBin = Math.round(logFrac * (BIN_COUNT - 1));
        } else {
          srcBin = bin;
        }

        const v = clamp((audio.bins[srcBin] || 0) * gain, 0, 1);
        const binFrac = bin / (BIN_COUNT - 1);
        const [r, g, b] = getColor(v, binFrac, scheme);

        // Little-endian RGBA packing: 0xAABBGGRR
        view[canvasY * HISTORY_WIDTH + writeX] = (0xFF << 24) | (b << 16) | (g << 8) | r;
      }
    }

    this.ctx2d.putImageData(this.imageData, 0, 0);
    this.texture.source.update();

    // Position and scale the sprite to fill desired region
    const h = ctx.height * heightFrac;
    const y0 = (ctx.height - h) * posY;

    this.sprite.x = 0;
    this.sprite.y = y0;
    this.sprite.width = ctx.width;
    this.sprite.height = h;
  }

  destroy(): void {
    if (this.texture) this.texture.destroy(true);
    this.container.destroy({ children: true });
  }
}
