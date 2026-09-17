import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeEffect } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { BloomEffectConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { FILTER_VERTEX } from '../layers/shaders';
import { audioTargetEnergy } from '../audio/reactivity';

const BLOOM_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;

uniform float uThreshold;
uniform float uStrength;
uniform float uRadius;
uniform float uSoftKnee;
uniform float uToneMap;

vec3 extractBright(vec3 c) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = max(uSoftKnee * uThreshold, 0.001);
  float rq = clamp(lum - (uThreshold - knee), 0.0, knee * 2.0);
  rq = (rq * rq) / (4.0 * knee);
  float contrib = max(rq, lum - uThreshold);
  return c * (contrib / max(lum, 0.0001));
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 orig = texture(uTexture, uv);

  vec2 px = uInputSize.zw * uRadius;

  vec3 bloom = vec3(0.0);

  // Scale 0 — tight (weight 1.0)
  bloom += extractBright(texture(uTexture, uv + vec2( px.x,  px.y)).rgb);
  bloom += extractBright(texture(uTexture, uv + vec2(-px.x,  px.y)).rgb);
  bloom += extractBright(texture(uTexture, uv + vec2( px.x, -px.y)).rgb);
  bloom += extractBright(texture(uTexture, uv + vec2(-px.x, -px.y)).rgb);

  // Scale 1 — medium (weight 0.75)
  vec2 px1 = px * 2.5;
  bloom += extractBright(texture(uTexture, uv + vec2( px1.x,  px1.y)).rgb) * 0.75;
  bloom += extractBright(texture(uTexture, uv + vec2(-px1.x,  px1.y)).rgb) * 0.75;
  bloom += extractBright(texture(uTexture, uv + vec2( px1.x, -px1.y)).rgb) * 0.75;
  bloom += extractBright(texture(uTexture, uv + vec2(-px1.x, -px1.y)).rgb) * 0.75;

  // Scale 2 — wide (weight 0.45)
  vec2 px2 = px * 6.0;
  bloom += extractBright(texture(uTexture, uv + vec2( px2.x,  px2.y)).rgb) * 0.45;
  bloom += extractBright(texture(uTexture, uv + vec2(-px2.x,  px2.y)).rgb) * 0.45;
  bloom += extractBright(texture(uTexture, uv + vec2( px2.x, -px2.y)).rgb) * 0.45;
  bloom += extractBright(texture(uTexture, uv + vec2(-px2.x, -px2.y)).rgb) * 0.45;

  // Scale 3 — long-range glow (weight 0.25)
  vec2 px3 = px * 14.0;
  bloom += extractBright(texture(uTexture, uv + vec2( px3.x,  px3.y)).rgb) * 0.25;
  bloom += extractBright(texture(uTexture, uv + vec2(-px3.x,  px3.y)).rgb) * 0.25;
  bloom += extractBright(texture(uTexture, uv + vec2( px3.x, -px3.y)).rgb) * 0.25;
  bloom += extractBright(texture(uTexture, uv + vec2(-px3.x, -px3.y)).rgb) * 0.25;

  // Normalize: sum of weights = 4*(1.0 + 0.75 + 0.45 + 0.25) = 9.8
  bloom /= 9.8;

  vec3 result = orig.rgb + bloom * uStrength;

  if (uToneMap > 0.5) {
    result = result / (1.0 + result * 0.18);
  }

  finalColor = vec4(result, orig.a);
}
`;

export class BloomEffectRuntime implements RuntimeEffect<BloomEffectConfig> {
  private static nextId = 0;
  id: string;
  private config: BloomEffectConfig;
  private filter: PIXI.Filter | null = null;
  private uniforms: any = null;
  private beatKick = 0;
  private lastT = -1;
  private readonly instanceId: number;

  constructor(config: BloomEffectConfig) {
    this.id = config.id;
    this.config = config;
    this.instanceId = BloomEffectRuntime.nextId++;
  }

  updateConfig(config: BloomEffectConfig): void {
    this.config = config;
  }

  init(_target: PIXI.Container, _ctx: RenderContext): void {
    try {
      const glProgram = PIXI.GlProgram.from({
        vertex: FILTER_VERTEX,
        fragment: BLOOM_FRAG,
        name: `bloom-effect-${this.instanceId}`,
      });

      const uniformGroup = new PIXI.UniformGroup({
        uThreshold: { value: 0.4, type: 'f32' },
        uStrength: { value: 1.5, type: 'f32' },
        uRadius: { value: 4.0, type: 'f32' },
        uSoftKnee: { value: 0.5, type: 'f32' },
        uToneMap: { value: 1.0, type: 'f32' },
      });

      this.filter = new PIXI.Filter({ glProgram, resources: { bloomUniforms: uniformGroup } });
      this.uniforms = this.filter.resources.bloomUniforms.uniforms;
    } catch (e) {
      console.error('[BloomEffect] Failed to build filter:', e);
    }
  }

  beforeUpdate(_target: PIXI.Container, t: number, audio: AudioFrame): void {
    if (!this.uniforms) return;
    const cfg = this.config;

    const dt = this.lastT >= 0 ? Math.min(0.2, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;

    if (audio.beat) {
      this.beatKick = 1.0;
    } else {
      this.beatKick *= Math.pow(0.65, dt * 60);
    }

    const baseStrength = sampleParam(cfg.strength, t);
    const energy = audioTargetEnergy(audio, cfg.audioTarget);
    const beatAccent = !cfg.audioTarget || cfg.audioTarget === 'full' || cfg.audioTarget === 'beat'
      ? this.beatKick * 0.4
      : 0;
    const audioBoost = cfg.audioDriven ? energy * sampleParam(cfg.audioAmount, t) + beatAccent : 0;

    this.uniforms.uThreshold = sampleParam(cfg.threshold, t);
    this.uniforms.uStrength = baseStrength + audioBoost;
    this.uniforms.uRadius = sampleParam(cfg.radius, t);
    this.uniforms.uSoftKnee = sampleParam(cfg.softKnee, t);
    this.uniforms.uToneMap = cfg.toneMap ? 1.0 : 0.0;
  }

  applyFilters(target: PIXI.Container): void {
    if (!this.filter) return;
    const existing = target.filters || [];
    if (!existing.includes(this.filter)) {
      target.filters = [...existing, this.filter];
    }
  }

  destroy(target: PIXI.Container): void {
    if (this.filter && target.filters) {
      target.filters = target.filters.filter((f) => f !== this.filter);
      this.filter = null;
      this.uniforms = null;
    }
  }
}
