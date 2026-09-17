import {
  createLayerId,
  defaultTransform,
  staticParam,
  type Asset,
  type BackgroundLayerConfig,
  type LogoLayerConfig,
} from '../types/project';
import { useProjectStore } from '../state/projectStore';
import { useSelectionStore } from '../state/selectionStore';

/** Plain Background layer used by the Advanced editor's "+ Add" menu and imports. */
export function createBackgroundLayer(assetId = ''): BackgroundLayerConfig {
  return {
    id: createLayerId(), name: 'Background', kind: 'background', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    assetId, fit: 'cover', darkness: staticParam(0),
  };
}

/** Plain Logo layer used by the Advanced editor's "+ Add" menu and imports. */
export function createLogoLayer(assetId = ''): LogoLayerConfig {
  return {
    id: createLayerId(), name: 'Logo', kind: 'logo', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    assetId, anchor: 'center',
    frameShape: 'circle',
    cornerRadius: staticParam(30),
    fitMode: 'cover',
    autoFitOnImport: true,
    frameSize: staticParam(375),
    padding: staticParam(8),
    border: {
      enabled: true,
      width: staticParam(20),
      color: staticParam('#1283ed'),
      glow: true,
    },
    _refitSeq: 0,
  };
}

/**
 * Make an imported image/video visible right away.
 *
 * Importing used to only register an asset; nothing appeared until the user
 * added a Background or Logo layer by hand and picked the asset in the
 * inspector, which read as "I can't add images at all". Now the first visual
 * becomes the Background, the next one becomes a Logo, and any layer of that
 * kind that has no asset yet gets the new asset instead of a duplicate.
 *
 * Returns the id of the layer that now shows the asset.
 */
export function attachVisualAssetToLayer(asset: Asset): string {
  const store = useProjectStore.getState();
  const layers = store.project.layers;

  const background = layers.find((layer) => layer.kind === 'background') as BackgroundLayerConfig | undefined;
  if (!background) {
    const layer = createBackgroundLayer(asset.id);
    // Backgrounds sit at the back of the stack (start of the array).
    store.updateProjectField('layers', [layer, ...layers]);
    useSelectionStore.getState().selectLayer(layer.id);
    return layer.id;
  }
  if (!background.assetId) {
    store.updateLayer(background.id, { assetId: asset.id } as Partial<BackgroundLayerConfig>);
    useSelectionStore.getState().selectLayer(background.id);
    return background.id;
  }

  const emptyLogo = layers.find((layer) => layer.kind === 'logo' && !(layer as LogoLayerConfig).assetId);
  if (emptyLogo) {
    store.updateLayer(emptyLogo.id, { assetId: asset.id, _refitSeq: ((emptyLogo as LogoLayerConfig)._refitSeq ?? 0) + 1 } as Partial<LogoLayerConfig>);
    useSelectionStore.getState().selectLayer(emptyLogo.id);
    return emptyLogo.id;
  }

  const logo = createLogoLayer(asset.id);
  store.addLayer(logo);
  useSelectionStore.getState().selectLayer(logo.id);
  return logo.id;
}
