import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { PixelateEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { DEFAULT_VERTEX } from '../layers/shaders';
import { audioTargetEnergy } from '../audio/reactivity';

const PIXELATE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uPixelSize;
uniform float uMix;

void main() {
  vec2 pixel = uInputSize.zw * max(1.0, uPixelSize);
  vec2 safeUv = clamp(vTextureCoord, uInputClamp.xy, uInputClamp.zw);
  vec2 snappedUv = clamp(
    (floor(safeUv / pixel) + 0.5) * pixel,
    uInputClamp.xy,
    uInputClamp.zw
  );
  vec4 original = texture(uTexture, safeUv);
  vec4 pixelated = texture(uTexture, snappedUv);

  // Sparse layers (waveforms, particles, text strokes) can have a transparent
  // block center. Preserve the original pixel in that case so adding this
  // effect can never erase the selected layer.
  if (pixelated.a + 0.001 < original.a) {
    pixelated = original;
  }

  finalColor = mix(original, pixelated, clamp(uMix, 0.0, 1.0));
}
`;

/** A crisp GPU pixelation effect that can punch harder with audio energy. */
export class PixelateEffectRuntime implements RuntimeEffect<PixelateEffectConfig> {
  private static nextId = 0;
  id: string;
  private config: PixelateEffectConfig;
  private filter: PIXI.Filter | null = null;
  private uniforms: any = null;
  private readonly instanceId: number;

  constructor(config: PixelateEffectConfig) {
    this.id = config.id;
    this.config = config;
    this.instanceId = PixelateEffectRuntime.nextId++;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    try {
      const glProgram = PIXI.GlProgram.from({
        vertex: DEFAULT_VERTEX,
        fragment: PIXELATE_FRAG,
        name: `pixelate-effect-${this.instanceId}`,
      });
      const uniformGroup = new PIXI.UniformGroup({
        uPixelSize: { value: 8, type: 'f32' },
        uMix: { value: 1, type: 'f32' },
      });
      this.filter = new PIXI.Filter({ glProgram, resources: { pixelateUniforms: uniformGroup } });
      this.filter.enabled = this.config.enabled;
      this.uniforms = this.filter.resources.pixelateUniforms.uniforms;
    } catch (error) {
      console.error('[PixelateEffect] Failed to build filter:', error);
    }
  }

  updateConfig(config: PixelateEffectConfig): void {
    this.config = config;
    if (this.filter) this.filter.enabled = config.enabled;
  }

  beforeUpdate(_target: PIXI.Container, t: number, audio: AudioFrame): void {
    if (!this.uniforms) return;
    const baseSize = sampleParam(this.config.pixelSize, t);
    const audioSize = this.config.audioDriven
      ? audioTargetEnergy(audio, this.config.audioTarget) * sampleParam(this.config.audioAmount, t)
      : 0;
    this.uniforms.uPixelSize = Math.max(1, baseSize + audioSize);
    this.uniforms.uMix = sampleParam(this.config.mix, t);
  }

  applyFilters(target: PIXI.Container): void {
    if (!this.filter) return;
    const existing = target.filters || [];
    if (!existing.includes(this.filter)) target.filters = [...existing, this.filter];
  }

  destroy(target: PIXI.Container): void {
    if (!this.filter) return;
    target.filters = (target.filters || []).filter((filter) => filter !== this.filter);
    this.filter.destroy();
    this.filter = null;
    this.uniforms = null;
  }
}
