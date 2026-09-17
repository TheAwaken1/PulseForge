export interface WhisperModel {
  id: string;
  label: string;
  size: string;
  preferGPU: boolean;
  /** dtype passed when running on GPU/WebGPU */
  gpuDtype?: Record<string, string> | string;
  /** dtype passed when running on CPU/WASM (omit = auto) */
  cpuDtype?: string;
}

// NOTE: Xenova models (tiny → medium) are WASM/CPU-only — they don't support WebGPU.
// onnx-community models support WebGPU. Only use onnx-community models that are
// publicly accessible without HuggingFace authentication (non-gated).
// whisper-large-v3 (onnx-community) is gated → excluded. Turbo is public + better.
export const WHISPER_MODELS: WhisperModel[] = [
  { id: 'Xenova/whisper-tiny',   label: 'Tiny',         size: '~75 MB',  preferGPU: false },
  { id: 'Xenova/whisper-base',   label: 'Base',         size: '~145 MB', preferGPU: false },
  { id: 'Xenova/whisper-small',  label: 'Small',        size: '~488 MB', preferGPU: false },
  { id: 'Xenova/whisper-medium', label: 'Medium',       size: '~1.5 GB', preferGPU: false },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Large v3 Turbo',
    size: '~800 MB',
    preferGPU: true,
    gpuDtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    cpuDtype: 'q8',
  },
];

export interface TranscribeChunk {
  text: string;
  timestamp: [number, number | null];
}

/** Convert seconds to LRC timestamp [mm:ss.xx] */
export function secondsToLrc(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

interface TimedTranscriptWord {
  text: string;
  start: number;
  end: number;
  sourceBoundary: boolean;
}

/**
 * Whisper models disagree about chunk granularity: some return one chunk per
 * word, while others return an entire verse (or song) as a single chunk. Turn
 * either shape into short, readable lyric lines with interpolated timestamps.
 */
export function chunksToLrc(chunks: TranscribeChunk[]): string {
  const usable = chunks.filter((chunk) => (
    Number.isFinite(chunk.timestamp?.[0]) && chunk.text.trim().length > 0
  ));
  const words: TimedTranscriptWord[] = [];

  for (let chunkIndex = 0; chunkIndex < usable.length; chunkIndex++) {
    const chunk = usable[chunkIndex];
    const parts = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;

    const start = chunk.timestamp[0];
    const nextStart = usable[chunkIndex + 1]?.timestamp?.[0];
    const suppliedEnd = chunk.timestamp[1];
    const end = Number.isFinite(suppliedEnd)
      ? Number(suppliedEnd)
      : Number.isFinite(nextStart)
        ? Number(nextStart)
        : start + parts.length * 0.42;
    const duration = Math.max(0.08 * parts.length, end - start);

    parts.forEach((text, wordIndex) => {
      words.push({
        text,
        start: start + duration * wordIndex / parts.length,
        end: start + duration * (wordIndex + 1) / parts.length,
        sourceBoundary: wordIndex === parts.length - 1,
      });
    });
  }

  if (words.length === 0) return '';

  const lines: Array<{ time: number; text: string }> = [];
  let lineStart = 0;

  const commitLine = (endExclusive: number) => {
    const lineWords = words.slice(lineStart, endExclusive);
    if (lineWords.length === 0) return;
    lines.push({
      time: lineWords[0].start,
      text: lineWords.map((word) => word.text).join(' '),
    });
    lineStart = endExclusive;
  };

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const count = index - lineStart + 1;
    const lineDuration = word.end - words[lineStart].start;
    const nextGap = index + 1 < words.length ? words[index + 1].start - word.end : Infinity;
    const sentenceEnd = /[.!?\u2026]["')\]]?$/.test(word.text);
    const phraseEnd = /[,;:]["')\]]?$/.test(word.text);

    const shouldBreak = count >= 9
      || (count >= 3 && sentenceEnd)
      || (count >= 5 && phraseEnd)
      || (count >= 5 && word.sourceBoundary)
      || (count >= 4 && lineDuration >= 4.2)
      || (count >= 3 && nextGap >= 0.75)
      || index === words.length - 1;

    if (shouldBreak) commitLine(index + 1);
  }

  return lines
    .map((line) => `[${secondsToLrc(line.time)}]${line.text}`)
    .join('\n');
}

/**
 * Fetch a blob URL, decode audio, and resample to 16 kHz mono Float32Array.
 * Whisper requires 16 kHz mono input.
 */
export async function prepareAudioForWhisper(blobUrl: string): Promise<Float32Array> {
  const response = await fetch(blobUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Decode at original sample rate
  const decodingCtx = new AudioContext();
  const decoded = await decodingCtx.decodeAudioData(arrayBuffer);
  await decodingCtx.close();

  // Resample to 16 kHz mono via OfflineAudioContext
  const TARGET_SR = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * TARGET_SR),
    TARGET_SR,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
}

/**
 * Transcribe audio via the OpenAI Whisper API.
 * Returns an LRC-formatted string.
 */
export async function transcribeViaOpenAI(
  blobUrl: string,
  apiKey: string,
  onStatus: (msg: string) => void,
): Promise<string> {
  onStatus('Fetching audio...');
  const response = await fetch(blobUrl);
  const blob = await response.blob();

  // Guess extension from MIME type; Whisper API accepts mp3, wav, m4a, ogg, flac, webm
  const mime = blob.type;
  const ext = mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : mime.includes('ogg') ? 'ogg'
    : mime.includes('flac') ? 'flac'
    : mime.includes('m4a') || mime.includes('mp4') ? 'm4a'
    : mime.includes('webm') ? 'webm'
    : 'mp3';

  const file = new File([blob], `audio.${ext}`, { type: mime });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  onStatus('Sending to OpenAI Whisper API...');
  const apiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    throw new Error(`OpenAI API ${apiResponse.status}: ${errText}`);
  }

  const data = await apiResponse.json();

  const chunks: TranscribeChunk[] = (data.segments ?? []).map((s: any) => ({
    text: s.text,
    timestamp: [s.start, s.end] as [number, number],
  }));

  return chunksToLrc(chunks);
}
