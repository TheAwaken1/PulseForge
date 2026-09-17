import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../state/projectStore';
import { useTransportStore } from '../state/transportStore';
import type { Asset } from '../types/project';

/**
 * Import an audio file: creates a blob URL asset and sets it as the project audio source.
 */
export async function importAudioFile(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  const assetId = uuid();
  const audio = new Audio(url);
  await new Promise<void>((resolve) => {
    audio.addEventListener('loadedmetadata', () => resolve());
    audio.addEventListener('error', () => resolve());
  });
  const asset = {
    id: assetId,
    type: 'audio' as const,
    name: file.name,
    relPath: url,
    sha256: '',
    sizeBytes: file.size,
    metadata: { duration: audio.duration },
  };
  const store = useProjectStore.getState();
  store.addAsset(asset);
  store.setAudioAsset(assetId, audio.duration || 0);
  const transport = useTransportStore.getState();
  transport.pause();
  transport.seek(0);
  transport.setDuration(audio.duration || 0);
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
