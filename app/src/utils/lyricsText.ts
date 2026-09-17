import { secondsToLrc } from './transcribe';

const TIMESTAMP_RE = /^\s*\[\d{1,2}:\d{2}(?:\.\d{2,3})?\]/m;
const SECTION_RE = /^\s*\[[^\]]+\]\s*$/;

export interface LyricsImportResult {
  lrc: string;
  lineCount: number;
  autoTimed: boolean;
  usedSongDuration: boolean;
}

interface UntimedLine {
  text: string;
  gapBefore: number;
  durationWeight: number;
}

/** Convert bracketed, untimed song lyrics into an approximate LRC timeline. */
export function importLyricsText(content: string, songDurationSec: number): LyricsImportResult {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('The lyrics file is empty.');

  if (TIMESTAMP_RE.test(normalized)) {
    const lineCount = normalized.split('\n').filter((line) => TIMESTAMP_RE.test(line)).length;
    if (lineCount === 0) throw new Error('No timed lyric lines were found.');
    return { lrc: normalized, lineCount, autoTimed: false, usedSongDuration: false };
  }

  const lines: UntimedLine[] = [];
  let sectionBreakPending = false;

  for (const rawLine of normalized.split('\n')) {
    const text = rawLine.trim();
    if (!text) continue;
    if (SECTION_RE.test(text)) {
      sectionBreakPending = lines.length > 0;
      continue;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const punctuationPauses = (text.match(/[,.!?;:…]/g) ?? []).length;
    lines.push({
      text,
      gapBefore: sectionBreakPending ? 1.25 : 0,
      durationWeight: Math.max(1.8, wordCount * 0.42 + punctuationPauses * 0.18),
    });
    sectionBreakPending = false;
  }

  if (lines.length === 0) {
    throw new Error('No lyric lines were found after the section headings.');
  }

  const hasSongDuration = Number.isFinite(songDurationSec) && songDurationSec > 1;
  const startPadding = hasSongDuration ? Math.min(2, Math.max(0.5, songDurationSec * 0.008)) : 0;
  const endPadding = hasSongDuration ? Math.min(3, Math.max(1, songDurationSec * 0.012)) : 0;
  const totalWeight = lines.reduce((sum, line) => sum + line.gapBefore + line.durationWeight, 0);
  const timelineDuration = hasSongDuration
    ? Math.max(1, songDurationSec - startPadding - endPadding)
    : totalWeight * 1.15;
  const scale = timelineDuration / Math.max(1, totalWeight);

  let cursor = startPadding;
  const lrcLines = lines.map((line) => {
    cursor += line.gapBefore * scale;
    const timedLine = `[${secondsToLrc(cursor)}]${line.text}`;
    cursor += line.durationWeight * scale;
    return timedLine;
  });

  return {
    lrc: lrcLines.join('\n'),
    lineCount: lines.length,
    autoTimed: true,
    usedSongDuration: hasSongDuration,
  };
}
