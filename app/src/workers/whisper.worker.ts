import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

// @ts-ignore — TS2590: @huggingface/transformers pipeline union type is too complex for TS to represent
type ASRPipeline = Awaited<ReturnType<typeof pipeline>>;

// Cache by "modelId::device" so switching back to a loaded model is instant
const cache = new Map<string, ASRPipeline>();
const segmentOnlyModels = new Set<string>();

function isWordTimestampCompatibilityError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error).toLocaleLowerCase();
  return message.includes('cross attentions')
    || message.includes('output_attentions')
    || message.includes('extract timestamps');
}

function progressCb(modelId: string) {
  return (p: any) => {
    if (p.status === 'progress' && typeof p.progress === 'number') {
      self.postMessage({
        type: 'status',
        message: `Downloading ${modelId}: ${Math.round(p.progress)}% — ${p.file ?? ''}`,
      });
    } else if (p.status === 'ready') {
      self.postMessage({ type: 'status', message: `${modelId} ready.` });
    }
  };
}

async function loadPipeline(
  modelId: string,
  device: string,
  dtype?: Record<string, string> | string,
): Promise<ASRPipeline> {
  const key = `${modelId}::${device}`;
  if (cache.has(key)) return cache.get(key)!;

  self.postMessage({ type: 'status', message: `Loading ${modelId} on ${device}…` });

  const opts: any = { progress_callback: progressCb(modelId) };
  if (device !== 'auto') opts.device = device;
  if (dtype !== undefined) opts.dtype = dtype;

  const p = await pipeline('automatic-speech-recognition', modelId, opts);
  cache.set(key, p);
  return p;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, audio, modelId, useGPU, gpuDtype, cpuDtype, timestampMode } = e.data as {
    type: string;
    audio: Float32Array;
    modelId: string;
    useGPU: boolean;
    gpuDtype?: Record<string, string> | string;
    cpuDtype?: string;
    timestampMode?: 'segment' | 'word';
  };
  if (type !== 'transcribe') return;

  try {
    let asr: ASRPipeline;

    if (useGPU) {
      try {
        asr = await loadPipeline(modelId, 'webgpu', gpuDtype);
      } catch (gpuErr: any) {
        self.postMessage({
          type: 'status',
          message: `WebGPU unavailable (${gpuErr.message ?? gpuErr}) — falling back to CPU…`,
        });
        asr = await loadPipeline(modelId, 'wasm', cpuDtype);
      }
    } else {
      asr = await loadPipeline(modelId, 'wasm', cpuDtype);
    }

    self.postMessage({ type: 'status', message: 'Transcribing…' });

    const wantsWordTimestamps = timestampMode === 'word';
    let resolvedTimestampMode: 'segment' | 'word' = wantsWordTimestamps ? 'word' : 'segment';
    let result: any;

    if (wantsWordTimestamps && !segmentOnlyModels.has(modelId)) {
      try {
        result = await (asr as any)(audio, {
          return_timestamps: 'word',
          chunk_length_s: 30,
          stride_length_s: 5,
        });
      } catch (wordTimestampError) {
        if (!isWordTimestampCompatibilityError(wordTimestampError)) throw wordTimestampError;
        segmentOnlyModels.add(modelId);
        resolvedTimestampMode = 'segment';
        self.postMessage({
          type: 'status',
          message: 'This model does not include word-timing data. Retrying with segment timing…',
        });
        result = await (asr as any)(audio, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });
      }
    } else {
      resolvedTimestampMode = 'segment';
      result = await (asr as any)(audio, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });
    }

    const chunks: Array<{ text: string; timestamp: [number, number | null] }> =
      result.chunks ?? [];

    self.postMessage({ type: 'result', chunks, timestampMode: resolvedTimestampMode });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: String(err?.message ?? err) });
  }
});
