import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../state/projectStore';
import { useTransportStore } from '../state/transportStore';
import type { Asset } from '../types/project';
import { attachVisualAssetToLayer } from '../layers/visualLayerDefaults';

/**
 * Read an audio file's duration without depending on <audio> metadata events.
 *
 * Chrome defers media element loading in background tabs, so waiting only on
 * "loadedmetadata" could hang the import forever. Race the element against a
 * short timeout, then fall back to decoding the file with Web Audio, which
 * works regardless of tab visibility and mirrors what playback does anyway.
 */
async function probeAudioDuration(file: File, url: string): Promise<number> {
  const viaElement = new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0));
    audio.addEventListener('error', () => resolve(0));
    audio.src = url;
    setTimeout(() => resolve(0), 2500);
  });
  const fromElement = await viaElement;
  if (fromElement > 0) return fromElement;

  try {
    const ctx = new AudioContext();
    try {
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      return buffer.duration;
    } finally {
      void ctx.close();
    }
  } catch (e) {
    console.warn('[PulseForge] Could not determine audio duration:', e);
    return 0;
  }
}

/**
 * Import an audio file: creates a blob URL asset and sets it as the project audio source.
 */
export async function importAudioFile(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  const assetId = uuid();
  const duration = await probeAudioDuration(file, url);
  const asset = {
    id: assetId,
    type: 'audio' as const,
    name: file.name,
    relPath: url,
    sha256: '',
    sizeBytes: file.size,
    metadata: { duration },
  };
  const store = useProjectStore.getState();
  store.addAsset(asset);
  store.setAudioAsset(assetId, duration);
  const transport = useTransportStore.getState();
  transport.pause();
  transport.seek(0);
  transport.setDuration(duration);
}

/**
 * Import an image file: creates a blob URL asset.
 */
export function importImageFile(file: File): Asset {
  return importVisualFile(file);
}

/** Import a still image, GIF, or short video for visual layers. */
export function importVisualFile(file: File): Asset {
  const url = URL.createObjectURL(file);
  const assetId = uuid();
  const isVideo = file.type.startsWith('video/');
  const asset = {
    id: assetId,
    type: isVideo ? 'video' as const : 'image' as const,
    name: file.name,
    relPath: url,
    sha256: '',
    sizeBytes: file.size,
    metadata: {
      mimeType: file.type,
      animated: isVideo || file.type === 'image/gif',
    },
  };
  useProjectStore.getState().addAsset(asset);
  return asset;
}

/**
 * Import a visual and put it on screen immediately (Background first, then
 * Logo). Used by the toolbar "Visual" button and drag-and-drop; the guided
 * Brand Visualizer builds its own styled layers instead.
 */
export function importVisualFileToLayer(file: File): Asset {
  const asset = importVisualFile(file);
  attachVisualAssetToLayer(asset);
  return asset;
}
