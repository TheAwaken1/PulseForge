/**
 * Shared LRC lyric parsing.
 *
 * One parser for the lyrics layer, the lyrics importer, and the Whisper
 * alignment so every path agrees on what counts as a timed line. Accepts
 * the timestamp spellings seen in the wild, not just the strict
 * `[mm:ss.xx]` form:
 *
 *   [mm:ss]  [mm:ss.x]  [mm:ss.xx]  [mm:ss.xxx]
 *   [mm:ss:xx]            colon used as the decimal separator (karaoke tools)
 *   [hh:mm:ss.xx]         hour-prefixed
 *   [00:12.00][00:45.00]  several stamps on one line = repeated line
 *   <mm:ss.xx>            enhanced-LRC word tags are stripped from the text
 *   [offset:+500]         header applied to every stamp (positive = earlier)
 *
 * Files that used any of the non-strict forms previously fell through to the
 * "untimed text" importer, which spread the lines evenly across the song and
 * left the raw timestamp inside the caption.
 */

export interface LrcLine {
  time: number;
  text: string;
}

const STAMP_SOURCE = String.raw`\[(\d{1,3})(?:[:.](\d{1,3})){1,3}\]`;
const LEADING_STAMPS_RE = new RegExp(String.raw`^\s*(?:${STAMP_SOURCE}\s*)+`);
const STAMP_RE = new RegExp(STAMP_SOURCE, 'g');
const STAMP_LINE_RE = new RegExp(String.raw`^\s*${STAMP_SOURCE}`, 'm');
const WORD_TAG_RE = /<\d{1,3}(?:[:.]\d{1,3}){1,3}>/g;
const OFFSET_RE = /^\s*\[offset:\s*([+-]?\d+)\s*\]/im;

function fractionToSeconds(fraction: string | undefined): number {
  if (!fraction) return 0;
  const digits = fraction.slice(0, 3);
  return Number(digits) / Math.pow(10, digits.length);
}

/**
 * Convert the inside of a timestamp bracket (e.g. "01:05.20", "1:05:20",
 * "00:01:05.20") to seconds. Returns null when it is not a timestamp.
 */
export function stampToSeconds(inside: string): number | null {
  const hasDot = inside.includes('.');
  const parts = inside.split(/[:.]/);
  if (parts.some((p) => !/^\d+$/.test(p))) return null;

  let hours = 0;
  let minutes: number;
  let seconds: number;
  let fraction: string | undefined;

  if (parts.length === 2) {
    [minutes, seconds] = [Number(parts[0]), Number(parts[1])];
  } else if (parts.length === 3) {
    if (hasDot) {
      // mm:ss.xx
      minutes = Number(parts[0]); seconds = Number(parts[1]); fraction = parts[2];
    } else {
      // mm:ss:xx — colon as decimal separator. Treating this as hh:mm:ss would
      // put a 3-minute song's lyrics hours out; the colon-decimal form is far
      // more common in generated LRC files.
      minutes = Number(parts[0]); seconds = Number(parts[1]); fraction = parts[2];
    }
  } else if (parts.length === 4) {
    hours = Number(parts[0]); minutes = Number(parts[1]); seconds = Number(parts[2]); fraction = parts[3];
  } else {
    return null;
  }

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 100) return null;
  return hours * 3600 + minutes * 60 + seconds + fractionToSeconds(fraction);
}

/** True when at least one line starts with a timestamp. */
export function hasLrcTimestamps(content: string): boolean {
  return STAMP_LINE_RE.test(content);
}

/** Global `[offset:±ms]` header in seconds (positive shifts lyrics earlier). */
export function parseLrcOffset(content: string): number {
  const match = content.match(OFFSET_RE);
  return match ? Number(match[1]) / 1000 : 0;
}

/** Strip enhanced-LRC word tags and surrounding whitespace from caption text. */
export function cleanLrcText(text: string): string {
  return text.replace(WORD_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
}

/** Parse LRC content into time-sorted lines. Lines with no text are dropped. */
export function parseLrc(content: string): LrcLine[] {
  const normalized = content.replace(/^﻿/, '');
  const offset = parseLrcOffset(normalized);
  const lines: LrcLine[] = [];

  for (const raw of normalized.split(/\r?\n/)) {
    const lead = raw.match(LEADING_STAMPS_RE);
    if (!lead) continue;
    const text = cleanLrcText(raw.slice(lead[0].length));
    if (!text) continue;

    for (const stamp of lead[0].matchAll(STAMP_RE)) {
      const time = stampToSeconds(stamp[0].slice(1, -1));
      if (time === null) continue;
      lines.push({ time: Math.max(0, time - offset), text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
