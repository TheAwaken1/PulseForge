import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer, RuntimeEffect } from './types';
import type { AudioFrame } from '../types/audio';
import type { LayerAny, EffectAny, BlendMode } from '../types/project';
import { sampleParam } from '../types/project';
import { ResourceManager } from './ResourceManager';
import { createRuntimeLayer } from '../layers/registry';
import { createRuntimeEffect } from '../effects/registry';
import { DESIGN_HEIGHT, DESIGN_WIDTH, resolvePositionParam } from '../layers/layerUtils';

export class SceneManager {
  private app: PIXI.Application;
  private resources: ResourceManager;
  private runtimeLayers: Map<string, RuntimeLayer> = new Map();
  private runtimeEffects: Map<string, RuntimeEffect[]> = new Map();
  private ctx!: RenderContext;

  constructor(app: PIXI.Application, resources: ResourceManager) {
    this.app = app;
    this.resources = resources;
    this.ctx = {
      app,
      width: app.screen.width,
      height: app.screen.height,
      getTexture: (id) => resources.getTexture(id),
    };
  }

  syncLayers(layers: LayerAny[]): void {
    const layerIds = new Set(layers.map((l) => l.id));

    // Remove layers that no longer exist
    for (const [id, rl] of this.runtimeLayers) {
      if (!layerIds.has(id)) {
        rl.destroy();
        this.app.stage.removeChild(rl.container);
        this.runtimeLayers.delete(id);
        this.runtimeEffects.delete(id);
      }
    }

    // Create or update layers in order
    for (let i = 0; i < layers.length; i++) {
      const layerConfig = layers[i];
      let rl = this.runtimeLayers.get(layerConfig.id);

      if (!rl) {
        rl = createRuntimeLayer(layerConfig);
        rl.init(this.ctx);
        this.runtimeLayers.set(layerConfig.id, rl);
      } else {
        // Push latest config to existing runtime layer
        rl.updateConfig(layerConfig);
      }

      // Ensure correct z-order
      if (rl.container.parent !== this.app.stage) {
        this.app.stage.addChild(rl.container);
      }
      this.app.stage.setChildIndex(rl.container, i);

      // Sync effects
      this.syncEffects(layerConfig.id, layerConfig.effects, rl.container);
    }
  }

  private syncEffects(layerId: string, effects: EffectAny[], container: PIXI.Container): void {
    const existing = this.runtimeEffects.get(layerId) || [];
    const newEffects: RuntimeEffect[] = [];

    for (const eCfg of effects) {
      let rEffect = existing.find((e) => e.id === eCfg.id);
      if (!rEffect) {
        rEffect = createRuntimeEffect(eCfg);
        rEffect.init(container, this.ctx);
      } else {
        rEffect.updateConfig(eCfg);
      }
      newEffects.push(rEffect);
    }

    // Destroy removed effects
    for (const old of existing) {
      if (!newEffects.find((e) => e.id === old.id)) {
        old.destroy(container);
      }
    }

    this.runtimeEffects.set(layerId, newEffects);
  }

  update(t: number, audio: AudioFrame, layers: LayerAny[]): void {
    this.ctx.width = this.app.screen.width;
    this.ctx.height = this.app.screen.height;

    for (const layerConfig of layers) {
      const rl = this.runtimeLayers.get(layerConfig.id);
      if (!rl) continue;

      // Apply visibility
      rl.container.visible = layerConfig.enabled;
      if (!layerConfig.enabled) continue;

      // Apply base transform
      const tx = layerConfig.transform;
      const x = resolvePositionParam(sampleParam(tx.x, t), this.ctx.width, 0, DESIGN_WIDTH);
      const y = resolvePositionParam(sampleParam(tx.y, t), this.ctx.height, 0, DESIGN_HEIGHT);
      rl.container.position.set(x, y);
      rl.container.scale.set(sampleParam(tx.scale, t));
      rl.container.rotation = sampleParam(tx.rotation, t);
      rl.container.alpha = sampleParam(layerConfig.opacity, t);

      // Apply blend mode
      rl.container.blendMode = blendModeToPixi(layerConfig.blendMode);

      // Run effects beforeUpdate
      const effects = this.runtimeEffects.get(layerConfig.id) || [];
      const effectCfgMap = new Map(layerConfig.effects.map((e) => [e.id, e]));
      for (const effect of effects) {
        const cfg = effectCfgMap.get(effect.id);
        if (cfg && cfg.enabled) {
          effect.beforeUpdate(rl.container, t, audio);
        }
      }

      // Update layer
      rl.update(this.ctx, t, audio);

      // Apply effect filters
      for (const effect of effects) {
        const cfg = effectCfgMap.get(effect.id);
        if (cfg && cfg.enabled) {
          effect.applyFilters(rl.container);
        }
      }
    }
  }

  destroy(): void {
    for (const [, rl] of this.runtimeLayers) {
      rl.destroy();
    }
    this.runtimeLayers.clear();
    this.runtimeEffects.clear();
  }
}

function blendModeToPixi(mode: BlendMode): PIXI.BLEND_MODES {
  switch (mode) {
    case 'add': return 'add' as PIXI.BLEND_MODES;
    case 'screen': return 'screen' as PIXI.BLEND_MODES;
    case 'multiply': return 'multiply' as PIXI.BLEND_MODES;
    default: return 'normal' as PIXI.BLEND_MODES;
  }
}
