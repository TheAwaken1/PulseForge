import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../state/projectStore';
import { useTransportStore } from '../state/transportStore';

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
export function importImageFile(file: File): void {
  const url = URL.createObjectURL(file);
  const assetId = uuid();
  const asset = {
    id: assetId,
    type: 'image' as const,
    name: file.name,
    relPath: url,
    sha256: '',
    sizeBytes: file.size,
  };
  useProjectStore.getState().addAsset(asset);
}
