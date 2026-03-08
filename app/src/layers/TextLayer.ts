import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { TextLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { bandStatsAudio, clamp, hexStringToNumber, DESIGN_WIDTH, DESIGN_HEIGHT } from './layerUtils';

export class TextLayerRuntime implements RuntimeLayer<TextLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: TextLayerConfig;
  private textObj: PIXI.Text;
  private glowObj: PIXI.Text | null = null;
  private glowBlur: PIXI.BlurFilter;
  private scrollOffset = 0;
  private lastT = 0;
  private lastText = '';
  private lastFontFamily = '';
  private lastFontSize = 0;
  private lastFontWeight = '';
  private lastLetterSpacing = 0;
  private lastStrokeEnabled = false;
  private lastStrokeColor = '';
  private lastStrokeWidth = 0;
  private lastColor = '';

  constructor(config: TextLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    this.textObj = new PIXI.Text({ text: config.text, style: this.buildStyle(config) });
    this.glowBlur = new PIXI.BlurFilter();
    this.container.addChild(this.textObj);
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: TextLayerConfig): void {
    this.config = config;
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    const cfg = this.config;
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const fontSize = clamp(sampleParam(cfg.fontSize, t) * designScale, 4, 1600);
    const color = sampleParam(cfg.color, t);
    const posX = clamp(sampleParam(cfg.positionX, t), 0, 1);
    const posY = clamp(sampleParam(cfg.positionY, t), 0, 1);
    const glowEnabled = sampleParam(cfg.glowEnabled, t);
    const glowStrength = clamp(sampleParam(cfg.glowStrength, t), 0, 3);
    const glowColor = sampleParam(cfg.glowColor, t);
    const audioPulse = clamp(sampleParam(cfg.audioPulseAmount, t), 0, 1);
    const audioShake = clamp(sampleParam(cfg.audioShakeAmount, t), 0, 20);
    const scrollEnabled = sampleParam(cfg.scrollEnabled, t);
    const scrollSpeed = sampleParam(cfg.scrollSpeed, t);
    const letterSpacing = sampleParam(cfg.letterSpacing, t);
    const strokeEnabled = sampleParam(cfg.strokeEnabled, t);
    const strokeColor = sampleParam(cfg.strokeColor, t);
    const strokeWidth = clamp(sampleParam(cfg.strokeWidth, t), 0, 10);

    const dt = t > this.lastT ? t - this.lastT : 1 / 60;
    this.lastT = t;

    // Rebuild style only when relevant props change
    const needsStyleUpdate =
      cfg.text !== this.lastText ||
      cfg.fontFamily !== this.lastFontFamily ||
      fontSize !== this.lastFontSize ||
      cfg.fontWeight !== this.lastFontWeight ||
      letterSpacing !== this.lastLetterSpacing ||
      strokeEnabled !== this.lastStrokeEnabled ||
      strokeColor !== this.lastStrokeColor ||
      strokeWidth !== this.lastStrokeWidth ||
      color !== this.lastColor;

    if (needsStyleUpdate) {
      this.lastText = cfg.text;
      this.lastFontFamily = cfg.fontFamily;
      this.lastFontSize = fontSize;
      this.lastFontWeight = cfg.fontWeight;
      this.lastLetterSpacing = letterSpacing;
      this.lastStrokeEnabled = strokeEnabled;
      this.lastStrokeColor = strokeColor;
      this.lastStrokeWidth = strokeWidth;
      this.lastColor = color;

      this.textObj.text = cfg.text;
      this.textObj.style = this.buildStyleFromValues(
        cfg.fontFamily, fontSize, cfg.fontWeight, color, cfg.textAlign,
        letterSpacing, strokeEnabled, strokeColor, strokeWidth,
      );
    }

    // Audio reactivity
    const bands = bandStatsAudio(audio.bins);
    const bassScale = 1 + bands.bass * audioPulse;
    const shakeX = audioShake > 0 ? (Math.random() - 0.5) * 2 * bands.treble * audioShake : 0;
    const shakeY = audioShake > 0 ? (Math.random() - 0.5) * 2 * bands.treble * audioShake : 0;

    // Scroll
    if (scrollEnabled) {
      this.scrollOffset += scrollSpeed * dt * 60;
      // Wrap around
      if (this.textObj.width > 0) {
        const totalW = ctx.width + this.textObj.width;
        this.scrollOffset = ((this.scrollOffset % totalW) + totalW) % totalW;
      }
    } else {
      this.scrollOffset = 0;
    }

    // Position
    const anchorX = cfg.textAlign === 'center' ? 0.5 : cfg.textAlign === 'right' ? 1 : 0;
    this.textObj.anchor.set(anchorX, 0.5);
    let x = posX * ctx.width + shakeX;
    const y = posY * ctx.height + shakeY;

    if (scrollEnabled) {
      x = -this.textObj.width * anchorX + this.scrollOffset - this.textObj.width;
    }

    this.textObj.position.set(x, y);
    this.textObj.scale.set(bassScale);

    // Glow
    if (glowEnabled && glowStrength > 0) {
      if (!this.glowObj) {
        this.glowObj = new PIXI.Text({ text: cfg.text, style: this.textObj.style });
        this.glowObj.blendMode = 'add' as PIXI.BLEND_MODES;
        this.glowObj.filters = [this.glowBlur];
        this.container.addChildAt(this.glowObj, 0);
      }
      this.glowObj.visible = true;
      this.glowObj.text = cfg.text;
      this.glowObj.style = this.buildStyleFromValues(
        cfg.fontFamily, fontSize, cfg.fontWeight, glowColor, cfg.textAlign,
        letterSpacing, false, '', 0,
      );
      this.glowObj.anchor.set(anchorX, 0.5);
      this.glowObj.position.set(x, y);
      this.glowObj.scale.set(bassScale);
      this.glowObj.alpha = 0.5 + glowStrength * 0.15;
      this.glowBlur.blur = 4 + glowStrength * 6;
    } else if (this.glowObj) {
      this.glowObj.visible = false;
    }
  }

  destroy(): void {
    this.textObj.destroy();
    if (this.glowObj) this.glowObj.destroy();
    this.container.destroy({ children: true });
  }

  private buildStyle(cfg: TextLayerConfig): PIXI.TextStyle {
    return this.buildStyleFromValues(
      cfg.fontFamily,
      sampleParam(cfg.fontSize, 0),
      cfg.fontWeight,
      sampleParam(cfg.color, 0),
      cfg.textAlign,
      sampleParam(cfg.letterSpacing, 0),
      sampleParam(cfg.strokeEnabled, 0),
      sampleParam(cfg.strokeColor, 0),
      sampleParam(cfg.strokeWidth, 0),
    );
  }

  private buildStyleFromValues(
    fontFamily: string, fontSize: number, fontWeight: string,
    color: string, textAlign: string,
    letterSpacing: number, strokeEnabled: boolean, strokeColor: string, strokeWidth: number,
  ): PIXI.TextStyle {
    return new PIXI.TextStyle({
      fontFamily: fontFamily || 'Arial',
      fontSize,
      fontWeight: fontWeight as 'normal' | 'bold',
      fill: color,
      align: textAlign as 'left' | 'center' | 'right',
      letterSpacing,
      stroke: strokeEnabled ? { color: strokeColor, width: strokeWidth } : undefined,
    });
  }
}
