import { secondsToLrc, type TranscribeChunk } from './transcribe';

interface LyricLine {
  time: number;
  text: string;
  tokens: string[];
}

interface TranscriptWord {
  token: string;
  time: number;
}

export interface LyricsAlignmentResult {
  lrc: string;
  lineCount: number;
  matchedLines: number;
  confidence: number;
}

const LRC_RE = /^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;

function tokenize(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(Boolean);
}

function parseLyrics(content: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const match = raw.match(LRC_RE);
    if (!match) continue;
    const fraction = match[3] ?? '0';
    const milliseconds = fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
    const text = match[4].trim();
    const tokens = tokenize(text);
    if (!text || tokens.length === 0) continue;
    lines.push({
      time: Number(match[1]) * 60 + Number(match[2]) + milliseconds / 1000,
      text,
      tokens,
    });
  }
  return lines;
}

function transcriptWords(chunks: TranscribeChunk[]): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const tokens = tokenize(chunk.text);
    if (tokens.length === 0 || !Number.isFinite(chunk.timestamp[0])) continue;
    const start = chunk.timestamp[0];
    const nextStart = chunks[chunkIndex + 1]?.timestamp?.[0];
    const end = chunk.timestamp[1] ?? (Number.isFinite(nextStart) ? nextStart : start + tokens.length * 0.4);
    const duration = Math.max(0.05, end - start);
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
      words.push({ token: tokens[tokenIndex], time: start + duration * tokenIndex / tokens.length });
    }
  }
  return words;
}

function diceScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2);
    const available = counts.get(pair) ?? 0;
    if (available > 0) {
      overlap++;
      counts.set(pair, available - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

/** Match supplied lyric lines against Whisper word timestamps in song order. */
export function alignLyricsToTranscript(content: string, chunks: TranscribeChunk[]): LyricsAlignmentResult {
  const lyrics = parseLyrics(content);
  const words = transcriptWords(chunks);
  if (lyrics.length === 0) throw new Error('No lyric lines are loaded to synchronize.');
  if (words.length === 0) throw new Error('Whisper did not detect enough vocals to synchronize.');

  const aligned: Array<number | null> = new Array(lyrics.length).fill(null);
  const scores = new Float32Array(lyrics.length);
  let cursor = 0;

  for (let lineIndex = 0; lineIndex < lyrics.length && cursor < words.length; lineIndex++) {
    const lyric = lyrics[lineIndex];
    const target = lyric.tokens.join('');
    const minLength = Math.max(1, lyric.tokens.length - 2);
    const maxLength = lyric.tokens.length + 3;
    const searchEnd = Math.min(words.length - 1, cursor + Math.max(120, lyric.tokens.length * 14));
    let bestScore = 0;
    let bestStart = -1;
    let bestLength = lyric.tokens.length;

    for (let start = cursor; start <= searchEnd; start++) {
      for (let length = minLength; length <= maxLength && start + length <= words.length; length++) {
        const candidate = words.slice(start, start + length).map((word) => word.token).join('');
        const textScore = diceScore(target, candidate);
        const proximityBonus = 0.06 * (1 - (start - cursor) / Math.max(1, searchEnd - cursor));
        const score = textScore + proximityBonus;
        if (score > bestScore) {
          bestScore = score;
          bestStart = start;
          bestLength = length;
        }
      }
    }

    if (bestStart >= 0 && bestScore >= 0.30) {
      aligned[lineIndex] = words[bestStart].time;
      scores[lineIndex] = Math.min(1, bestScore);
      cursor = bestStart + Math.max(1, bestLength);
    }
  }

  const matchedIndices = aligned.map((time, index) => time === null ? -1 : index).filter((index) => index >= 0);
  if (matchedIndices.length === 0) {
    throw new Error('The loaded lyrics could not be matched to the detected vocals. Try a larger Whisper model.');
  }

  // Preserve every supplied line. Lines Whisper missed are interpolated between
  // neighboring matched anchors using their original approximate timeline.
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i] !== null) continue;
    const previous = [...matchedIndices].reverse().find((index) => index < i);
    const next = matchedIndices.find((index) => index > i);
    if (previous !== undefined && next !== undefined) {
      const originalSpan = lyrics[next].time - lyrics[previous].time;
      const ratio = originalSpan > 0
        ? (lyrics[i].time - lyrics[previous].time) / originalSpan
        : (i - previous) / (next - previous);
      aligned[i] = aligned[previous]! + (aligned[next]! - aligned[previous]!) * Math.max(0, Math.min(1, ratio));
    } else if (next !== undefined) {
      aligned[i] = Math.max(0, aligned[next]! - (next - i) * 2.5);
    } else if (previous !== undefined) {
      const sourceDelta = Math.max(1.5, lyrics[i].time - lyrics[previous].time);
      aligned[i] = aligned[previous]! + sourceDelta;
    }
  }

  let lastTime = -0.15;
  const lrc = lyrics.map((line, index) => {
    const time = Math.max(lastTime + 0.15, aligned[index] ?? line.time);
    lastTime = time;
    return `[${secondsToLrc(time)}]${line.text}`;
  }).join('\n');
  const confidence = matchedIndices.reduce((sum, index) => sum + scores[index], 0) / matchedIndices.length;

  return { lrc, lineCount: lyrics.length, matchedLines: matchedIndices.length, confidence };
}
