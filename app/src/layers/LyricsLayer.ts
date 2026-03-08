import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { LyricsLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { bandStatsAudio, clamp, DESIGN_WIDTH, DESIGN_HEIGHT } from './layerUtils';

export interface LrcLine {
  time: number;
  text: string;
}

export function parseLrc(content: string): LrcLine[] {
  const lines: LrcLine[] = [];
  // Match [mm:ss.xx], [mm:ss.xxx], or [mm:ss] timestamps
  const lineRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
  for (const raw of content.split('\n')) {
    const match = raw.trim().match(lineRe);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const fracStr = match[3] ?? '0';
    const ms = fracStr.length === 2
      ? parseInt(fracStr, 10) * 10
      : parseInt(fracStr, 10);
    const time = mins * 60 + secs + ms / 1000;
    const text = match[4].trim();
    lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

function findLineIndex(lines: LrcLine[], t: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i;
    else break;
  }
  return idx;
}

const FADE_DURATION = 0.25; // seconds for line fade-in

export class LyricsLayerRuntime implements RuntimeLayer<LyricsLayerConfig> {
  id: string;
  container: PIXI.Container;
  private config: LyricsLayerConfig;

  private currentText: PIXI.Text;
  private nextText: PIXI.Text;
  private glowBlur: PIXI.BlurFilter;
  private glowObj: PIXI.Text | null = null;

  private parsedLines: LrcLine[] = [];
  private lastLrcContent = '';

  private lastLineIdx = -1;
  private lineStartTime = 0;

  constructor(config: LyricsLayerConfig) {
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();

    const style = this.buildStyle(config, sampleParam(config.fontSize, 0), sampleParam(config.color, 0));
    this.currentText = new PIXI.Text({ text: '', style });
    this.nextText = new PIXI.Text({ text: '', style });
    this.nextText.alpha = 0;
    this.glowBlur = new PIXI.BlurFilter();

    this.container.addChild(this.currentText);
    this.container.addChild(this.nextText);

    this.parsedLines = parseLrc(config.lrcContent);
    this.lastLrcContent = config.lrcContent;
  }

  init(_ctx: RenderContext): void {}

  updateConfig(config: LyricsLayerConfig): void {
    this.config = config;
    if (config.lrcContent !== this.lastLrcContent) {
      this.lastLrcContent = config.lrcContent;
      this.parsedLines = parseLrc(config.lrcContent);
      this.lastLineIdx = -1;
    }
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    const cfg = this.config;
    const designScale = Math.min(ctx.width / DESIGN_WIDTH, ctx.height / DESIGN_HEIGHT);
    const fontSize = clamp(sampleParam(cfg.fontSize, t) * designScale, 4, 800);
    const color = sampleParam(cfg.color, t);
    const posX = clamp(sampleParam(cfg.positionX, t), 0, 1);
    const posY = clamp(sampleParam(cfg.positionY, t), 0, 1);
    const glowEnabled = sampleParam(cfg.glowEnabled, t);
    const glowStrength = clamp(sampleParam(cfg.glowStrength, t), 0, 3);
    const glowColor = sampleParam(cfg.glowColor, t);
    const audioPulse = clamp(sampleParam(cfg.audioPulseAmount, t), 0, 1);
    const strokeEnabled = sampleParam(cfg.strokeEnabled, t);
    const strokeColor = sampleParam(cfg.strokeColor, t);
    const strokeWidth = clamp(sampleParam(cfg.strokeWidth, t), 0, 10);

    const lines = this.parsedLines;
    const lineIdx = findLineIndex(lines, t);

    // Detect line change
    if (lineIdx !== this.lastLineIdx) {
      this.lastLineIdx = lineIdx;
      this.lineStartTime = t;
    }

    const currentStr = lineIdx >= 0 ? lines[lineIdx].text : '';
    const nextStr = cfg.showNextLine && lineIdx + 1 < lines.length ? lines[lineIdx + 1].text : '';

    // Fade-in alpha for current line
    const elapsed = t - this.lineStartTime;
    const fadeAlpha = lineIdx < 0 ? 0 : Math.min(1, elapsed / FADE_DURATION);

    const wrapWidth = ctx.width * 0.88;

    const style = this.buildStyleFromValues(
      cfg.fontFamily, fontSize, cfg.fontWeight, color, cfg.textAlign,
      strokeEnabled, strokeColor, strokeWidth, wrapWidth,
    );

    const nextStyle = this.buildStyleFromValues(
      cfg.fontFamily, fontSize * 0.72, cfg.fontWeight, color, cfg.textAlign,
      strokeEnabled, strokeColor, strokeWidth * 0.8, wrapWidth,
    );

    // Audio reactivity
    const bands = bandStatsAudio(audio.bins);
    const bassScale = 1 + bands.bass * audioPulse;

    const anchorX = cfg.textAlign === 'center' ? 0.5 : cfg.textAlign === 'right' ? 1 : 0;
    const x = posX * ctx.width;
    const y = posY * ctx.height;

    // Current line
    this.currentText.text = currentStr;
    this.currentText.style = style;
    this.currentText.anchor.set(anchorX, 0.5);
    this.currentText.position.set(x, y);
    this.currentText.scale.set(bassScale);
    this.currentText.alpha = fadeAlpha;

    // Next line (shown below, dimmer)
    if (cfg.showNextLine && nextStr) {
      this.nextText.visible = true;
      this.nextText.text = nextStr;
      this.nextText.style = nextStyle;
      this.nextText.anchor.set(anchorX, 0.5);
      this.nextText.position.set(x, y + fontSize * 2.2);
      this.nextText.scale.set(1);
      this.nextText.alpha = cfg.nextLineOpacity * fadeAlpha;
    } else {
      this.nextText.visible = false;
    }

    // Glow on current line
    if (glowEnabled && glowStrength > 0 && currentStr) {
      if (!this.glowObj) {
        this.glowObj = new PIXI.Text({ text: currentStr, style });
        this.glowObj.blendMode = 'add' as PIXI.BLEND_MODES;
        this.glowObj.filters = [this.glowBlur];
        this.container.addChildAt(this.glowObj, 0);
      }
      this.glowObj.visible = true;
      this.glowObj.text = currentStr;
      this.glowObj.style = this.buildStyleFromValues(
        cfg.fontFamily, fontSize, cfg.fontWeight, glowColor, cfg.textAlign,
        false, '', 0, wrapWidth,
      );
      this.glowObj.anchor.set(anchorX, 0.5);
      this.glowObj.position.set(x, y);
      this.glowObj.scale.set(bassScale);
      this.glowObj.alpha = fadeAlpha * (0.5 + glowStrength * 0.15);
      this.glowBlur.blur = 4 + glowStrength * 6;
    } else if (this.glowObj) {
      this.glowObj.visible = false;
    }
  }

  destroy(): void {
    this.currentText.destroy();
    this.nextText.destroy();
    if (this.glowObj) this.glowObj.destroy();
    this.container.destroy({ children: true });
  }

  private buildStyle(cfg: LyricsLayerConfig, fontSize: number, color: string): PIXI.TextStyle {
    return this.buildStyleFromValues(
      cfg.fontFamily, fontSize, cfg.fontWeight, color, cfg.textAlign,
      sampleParam(cfg.strokeEnabled, 0),
      sampleParam(cfg.strokeColor, 0),
      sampleParam(cfg.strokeWidth, 0),
    );
  }

  private buildStyleFromValues(
    fontFamily: string, fontSize: number, fontWeight: string,
    color: string, textAlign: string,
    strokeEnabled: boolean, strokeColor: string, strokeWidth: number,
    wordWrapWidth?: number,
  ): PIXI.TextStyle {
    return new PIXI.TextStyle({
      fontFamily: fontFamily || 'Arial',
      fontSize,
      fontWeight: fontWeight as 'normal' | 'bold',
      fill: color,
      align: textAlign as 'left' | 'center' | 'right',
      stroke: strokeEnabled ? { color: strokeColor, width: strokeWidth, join: 'round' } : undefined,
      wordWrap: wordWrapWidth !== undefined,
      wordWrapWidth,
      breakWords: true,
    });
  }
}
