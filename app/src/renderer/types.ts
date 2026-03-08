import * as PIXI from 'pixi.js';
import type { AudioFrame } from '../types/audio';
import type { LayerAny, EffectAny } from '../types/project';

/**
 * Context available to all layers during rendering.
 */
export interface RenderContext {
  app: PIXI.Application;
  width: number;
  height: number;
  /** Get a loaded texture by asset ID */
  getTexture: (assetId: string) => PIXI.Texture | null;
}

/**
 * Runtime interface for layers in the scene graph.
 */
export interface RuntimeLayer<C extends LayerAny = LayerAny> {
  id: string;
  container: PIXI.Container;
  init(ctx: RenderContext): void;
  /** Update the stored config reference so property changes take effect */
  updateConfig(config: C): void;
  update(ctx: RenderContext, t: number, audio: AudioFrame): void;
  destroy(): void;
}

/**
 * Runtime interface for effects applied to layers.
 */
export interface RuntimeEffect<C extends EffectAny = EffectAny> {
  id: string;
  init(target: PIXI.Container, ctx: RenderContext): void;
  /** Update the stored config reference */
  updateConfig(config: C): void;
  /** Called before rendering each frame: mutate target transform/alpha */
  beforeUpdate(target: PIXI.Container, t: number, audio: AudioFrame): void;
  /** Attach or update Pixi filters on the target */
  applyFilters(target: PIXI.Container): void;
  destroy(target: PIXI.Container): void;
}
