import * as PIXI from 'pixi.js';

/**
 * Shared utility functions for HD visualizer layers.
 */

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** Resample FFT bins (72 log-frequency) to target count with gain. */
export function mapBins(input: Float32Array, out: Float32Array, count: number, gain: number): void {
  for (let i = 0; i < count; i++) {
    const src = (i / Math.max(1, count - 1)) * Math.max(0, input.length - 1);
    const i0 = Math.floor(src);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const f = src - i0;
    out[i] = (((input[i0] || 0) * (1 - f)) + ((input[i1] || 0) * f)) * gain;
  }
}

/** Extract bass/mid/treble averages from frequency bins. */
export function bandStatsAudio(bins: Float32Array): { bass: number; mid: number; treble: number } {
  return {
    bass: avg(bins, 0, Math.min(10, bins.length - 1)),
    mid: avg(bins, Math.min(11, bins.length - 1), Math.min(35, bins.length - 1)),
    treble: avg(bins, Math.min(36, bins.length - 1), bins.length - 1),
  };
}

/** Average a slice of a Float32Array. */
export function avg(arr: Float32Array, a: number, b: number): number {
  if (b < a) return 0;
  let sum = 0;
  let c = 0;
  for (let i = a; i <= b && i < arr.length; i++) {
    sum += arr[i];
    c++;
  }
  return c > 0 ? sum / c : 0;
}

/** Rainbow color from position t (0..1) with saturation boost. Returns hex number. */
export function rainbowAt(t: number, satBoost: number): number {
  const h = ((1 - t) * 300) % 360;
  const s = clamp(0.84 * satBoost, 0, 1);
  return hsvToRgbHex(h, s, 1);
}

/** Convert HSV (h:0-360, s:0-1, v:0-1) to hex number 0xRRGGBB. */
export function hsvToRgbHex(h: number, s: number, v: number): number {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const rr = Math.round((r + m) * 255);
  const gg = Math.round((g + m) * 255);
  const bb = Math.round((b + m) * 255);
  return (rr << 16) | (gg << 8) | bb;
}

/** Linearly interpolate between two hex color numbers. */
export function lerpColor(colorA: number, colorB: number, t: number): number {
  const rA = (colorA >> 16) & 0xff, gA = (colorA >> 8) & 0xff, bA = colorA & 0xff;
  const rB = (colorB >> 16) & 0xff, gB = (colorB >> 8) & 0xff, bB = colorB & 0xff;
  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);
  return (r << 16) | (g << 8) | b;
}

/** Convert '#rrggbb' hex string to 0xRRGGBB number. */
export function hexStringToNumber(hex: string): number {
  if (hex.startsWith('#')) hex = hex.slice(1);
  return parseInt(hex, 16) || 0;
}

/** Clamp value between a and b. */
export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Clamp integer value between a and b. */
export function clampInt(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v | 0));
}

/** Compute frame-rate normalization factor targeting 60fps. */
export function timeFactor60fps(t: number, lastT: number): number {
  if (!Number.isFinite(lastT) || t <= lastT) return 1;
  const dt = t - lastT;
  return clamp(dt * 60, 0.25, 4);
}

/** Normalize an attack/release rate for frame-rate independence. */
export function normalizeRate(rate: number, factor: number): number {
  return 1 - Math.pow(1 - clamp(rate, 0.001, 0.999), factor);
}

/**
 * Resolve a layer position parameter across resolutions.
 * - `0` keeps legacy "auto/default" behavior via fallback.
 * - `-1..1` is treated as normalized axis space.
 * - Other values are treated as absolute pixels.
 */
export function resolvePositionParam(
  value: number,
  axisSize: number,
  fallback: number,
  designAxisSize: number = axisSize,
): number {
  if (!Number.isFinite(value) || value === 0) return fallback;
  if (Math.abs(value) <= 1) return value * axisSize;
  if (!Number.isFinite(designAxisSize) || designAxisSize <= 0) return value;
  return value * (axisSize / designAxisSize);
}

/**
 * Resolve a layer size parameter across resolutions.
 * - `0` keeps legacy "auto/default" behavior via fallback.
 * - `-1..1` is treated as normalized axis size.
 * - Other values are treated as absolute pixels.
 */
export function resolveSizeParam(
  value: number,
  axisSize: number,
  fallback: number,
  designAxisSize: number = axisSize,
): number {
  if (!Number.isFinite(value) || value === 0) return fallback;
  if (Math.abs(value) <= 1) return value * axisSize;
  if (!Number.isFinite(designAxisSize) || designAxisSize <= 0) return value;
  return value * (axisSize / designAxisSize);
}

/** Draw a vignette (edge darkening) on a Graphics object. */
export function drawVignette(g: PIXI.Graphics, w: number, h: number, ringFraction = 0.07, topBottomAlpha = 0.22, sideAlpha = 0.16): void {
  const ring = Math.max(w, h) * ringFraction;
  g.rect(0, 0, w, ring).fill({ color: 0x000000, alpha: topBottomAlpha });
  g.rect(0, h - ring, w, ring).fill({ color: 0x000000, alpha: topBottomAlpha });
  g.rect(0, 0, ring, h).fill({ color: 0x000000, alpha: sideAlpha });
  g.rect(w - ring, 0, ring, h).fill({ color: 0x000000, alpha: sideAlpha });
}
