import * as PIXI from 'pixi.js';
import type { RenderContext, RuntimeLayer } from '../renderer/types';
import type { AudioFrame } from '../types/audio';
import type { ShaderLayerConfig } from '../types/project';
import { sampleParam } from '../types/project';
import { DEFAULT_VERTEX, getFragmentSource } from './shaders';

/**
 * Full-screen shader visualizer layer with optional classic visualizer-style feedback.
 *
 * Renders a GLSL fragment shader as a full-screen quad using the PixiJS v8
 * Filter pipeline.  Audio data (RMS + derived bass/mid/treble) and animation
 * time are passed as uniforms every frame.
 *
 * When feedbackEnabled is true, the layer maintains two RenderTextures and
 * passes the previous frame as a texture uniform (uPrevTex) so the shader
 * can sample warped history, creating classic feedback motion-blur /
 * infinite-zoom effect.
 */
export class ShaderLayerRuntime implements RuntimeLayer<ShaderLayerConfig> {
  private static nextProgramInstanceId = 0;
  id: string;
  container: PIXI.Container;
  private config: ShaderLayerConfig;
  private graphics: PIXI.Graphics;
  private filter: PIXI.Filter | null = null;
  private uniforms: any = null;
  private lastW = 0;
  private lastH = 0;
  private lastT = -1;
  private beatFlash = 0;

  // Spectrum texture (72×1 canvas updated each frame with audio.bins)
  private spectrumCanvas: HTMLCanvasElement | null = null;
  private spectrumCtx: CanvasRenderingContext2D | null = null;
  private spectrumImageData: ImageData | null = null;
  private spectrumTexture: PIXI.Texture | null = null;

  // Feedback state
  private rtA: PIXI.RenderTexture | null = null;
  private rtB: PIXI.RenderTexture | null = null;
  private feedbackSprite: PIXI.Sprite | null = null;
  private feedbackContainer: PIXI.Container | null = null;
  private renderer: PIXI.Renderer | null = null;
  private pingPong = false; // false = rtA is prev, true = rtB is prev
  private sceneRT: PIXI.RenderTexture | null = null;
  private sceneSprite: PIXI.Sprite | null = null;
  private readonly programInstanceId: number;

  constructor(config: ShaderLayerConfig) {
    this.programInstanceId = ShaderLayerRuntime.nextProgramInstanceId++;
    this.id = config.id;
    this.config = config;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  init(ctx: RenderContext): void {
    this.renderer = ctx.app.renderer as PIXI.Renderer;
    this.buildFilter();
    this.resizeRect(ctx.width, ctx.height);
    if (this.config.feedbackEnabled) {
      this.initFeedback(ctx.width, ctx.height);
    }
    if (this.config.shaderType === 'displacement') {
      this.initSceneCapture(ctx.width, ctx.height);
    }
  }

  updateConfig(config: ShaderLayerConfig): void {
    const shaderChanged = config.shaderType !== this.config.shaderType;
    const feedbackToggled = config.feedbackEnabled !== this.config.feedbackEnabled;
    this.config = config;
    if (shaderChanged) {
      this.destroySceneCapture();
      this.destroyFilter();
      this.buildFilter();
      this.beatFlash = 0;
      this.lastT = -1;
      if (config.shaderType === 'displacement' && this.lastW > 0 && this.lastH > 0) {
        this.initSceneCapture(this.lastW, this.lastH);
      }
    }
    if (feedbackToggled) {
      if (config.feedbackEnabled) {
        this.initFeedback(this.lastW, this.lastH);
      } else {
        this.destroyFeedback();
      }
    }
  }

  update(ctx: RenderContext, t: number, audio: AudioFrame): void {
    // Resize backing rect if canvas dimensions changed
    if (ctx.width !== this.lastW || ctx.height !== this.lastH) {
      this.resizeRect(ctx.width, ctx.height);
      if (this.config.feedbackEnabled) {
        this.resizeFeedback(ctx.width, ctx.height);
      }
      if (this.config.shaderType === 'displacement') {
        this.resizeSceneCapture(ctx.width, ctx.height);
      }
    }

    if (!this.uniforms) return;

    // Update per-frame spectrum texture
    this.updateSpectrumTexture(audio.bins);

    // Beat flash: snap to 1.0 on beat, decay to 0 over ~200ms
    const dt = this.lastT >= 0 ? Math.min(0.2, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;
    if (audio.beat) {
      this.beatFlash = 1.0;
    } else {
      this.beatFlash *= Math.pow(0.65, dt * 60);
    }

    const u = this.uniforms;
    const cfg = this.config;

    // Derive bass / mid / treble from bins
    const bins = audio.bins;
    const binLen = bins.length; // 72
    let bass = 0;
    let mid = 0;
    let treble = 0;
    const bassEnd = Math.floor(binLen * 0.15);
    const midEnd = Math.floor(binLen * 0.55);
    for (let i = 0; i < binLen; i++) {
      const v = bins[i] || 0;
      if (i < bassEnd) bass += v;
      else if (i < midEnd) mid += v;
      else treble += v;
    }
    bass /= bassEnd || 1;
    mid /= (midEnd - bassEnd) || 1;
    treble /= (binLen - midEnd) || 1;

    // Update core uniforms
    u.uTime = t;
    u.uRms = audio.rms;
    u.uBass = bass;
    u.uMid = mid;
    u.uTreble = treble;
    u.uResolution[0] = ctx.width;
    u.uResolution[1] = ctx.height;
    u.uSpeed = sampleParam(cfg.speed, t);
    u.uIntensity = sampleParam(cfg.intensity, t);
    u.uScale = sampleParam(cfg.scale, t);
    u.uAudioReactivity = sampleParam(cfg.audioReactivity, t);
    u.uDistortionStrength = sampleParamOr(cfg.distortionStrength, t, 1.0);
    u.uFlowSpeed = sampleParamOr(cfg.flowSpeed, t, sampleParam(cfg.speed, t));
    u.uViscosity = sampleParamOr(cfg.viscosity, t, 0.72);

    // Parse hex colors to vec3
    hexToVec3(sampleParam(cfg.color1, t), u.uColor1);
    hexToVec3(sampleParam(cfg.color2, t), u.uColor2);
    hexToVec3(sampleParam(cfg.color3, t), u.uColor3);

    // Beat uniforms
    u.uBeat = this.beatFlash;
    u.uBeatPhase = audio.beatPhase;
    u.uBpm = audio.bpm;

    // Feedback uniforms
    u.uFeedbackEnabled = cfg.feedbackEnabled ? 1.0 : 0.0;
    if (cfg.feedbackEnabled) {
      u.uFeedbackAmount = sampleParam(cfg.feedbackAmount, t);
      u.uFeedbackZoom = sampleParam(cfg.feedbackZoom, t);
      u.uFeedbackRotate = sampleParam(cfg.feedbackRotate, t);

      // Bind the previous frame texture
      const prevRT = this.pingPong ? this.rtB : this.rtA;
      if (prevRT && this.filter) {
        (this.filter.resources as any).uPrevTex = prevRT.source;
      }
    }

    // Capture current scene for full-screen displacement.
    if (cfg.shaderType === 'displacement' && this.renderer && this.sceneRT) {
      this.captureSceneTexture(ctx);
    }

    // If feedback is enabled, render into the current RT then display
    if (cfg.feedbackEnabled && this.renderer && this.rtA && this.rtB && this.feedbackSprite) {
      const currRT = this.pingPong ? this.rtA : this.rtB;

      // Render the graphics (with shader filter) into currRT
      this.renderer.render({
        container: this.graphics,
        target: currRT!,
        clear: true,
      });

      // Display the current result via the feedbackSprite
      this.feedbackSprite.texture = currRT!;

      // Swap ping-pong
      this.pingPong = !this.pingPong;
    }
  }

  destroy(): void {
    this.destroyFeedback();
    this.destroySceneCapture();
    this.destroyFilter();
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }

  /* ---- feedback management ---- */

  private initFeedback(w: number, h: number): void {
    if (this.rtA) return; // already initialized
    if (w <= 0 || h <= 0) return;

    this.rtA = PIXI.RenderTexture.create({ width: w, height: h });
    this.rtB = PIXI.RenderTexture.create({ width: w, height: h });

    // Create a sprite to display the feedback result
    this.feedbackSprite = new PIXI.Sprite(this.rtA);
    this.feedbackContainer = new PIXI.Container();
    this.feedbackContainer.addChild(this.feedbackSprite);
    this.container.addChild(this.feedbackContainer);

    // Remove the raw graphics from the scene graph so it doesn't render
    // in the main pass. We keep it alive (visible=true) so the offscreen
    // renderer.render() call can still draw it into the RenderTexture.
    this.container.removeChild(this.graphics);
  }

  private resizeFeedback(w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    if (this.rtA) this.rtA.resize(w, h);
    if (this.rtB) this.rtB.resize(w, h);
    if (this.feedbackSprite) {
      this.feedbackSprite.width = w;
      this.feedbackSprite.height = h;
    }
  }

  private destroyFeedback(): void {
    if (this.feedbackSprite) {
      this.feedbackSprite.destroy();
      this.feedbackSprite = null;
    }
    if (this.feedbackContainer) {
      this.feedbackContainer.destroy({ children: true });
      this.feedbackContainer = null;
    }
    if (this.rtA) {
      this.rtA.destroy(true);
      this.rtA = null;
    }
    if (this.rtB) {
      this.rtB.destroy(true);
      this.rtB = null;
    }
    // Re-add the graphics to the scene graph for non-feedback mode
    if (!this.graphics.parent) {
      this.container.addChild(this.graphics);
    }
    this.pingPong = false;
  }

  /* ---- displacement scene-capture management ---- */

  private initSceneCapture(w: number, h: number): void {
    if (this.sceneSprite) return;
    if (w <= 0 || h <= 0) return;

    this.sceneRT = PIXI.RenderTexture.create({ width: w, height: h });
    this.sceneSprite = new PIXI.Sprite(this.sceneRT);
    this.sceneSprite.width = w;
    this.sceneSprite.height = h;

    // The displacement filter processes the scene sprite (whose texture is
    // the captured scene), so the shader reads it via the standard uTexture.
    if (this.filter) {
      this.sceneSprite.filters = [this.filter];
      this.graphics.filters = [];
    }
    this.graphics.visible = false;
    this.container.addChild(this.sceneSprite);
  }

  private destroySceneCapture(): void {
    if (this.sceneSprite) {
      this.sceneSprite.destroy();
      this.sceneSprite = null;
    }
    if (this.sceneRT) {
      this.sceneRT.destroy(true);
      this.sceneRT = null;
    }
    this.graphics.visible = true;
    if (this.filter && this.graphics.filters.length === 0) {
      this.graphics.filters = [this.filter];
    }
  }

  /* ---- filter management ---- */

  private buildSpectrumTexture(): void {
    this.spectrumCanvas = document.createElement('canvas');
    this.spectrumCanvas.width = 72;
    this.spectrumCanvas.height = 1;
    this.spectrumCtx = this.spectrumCanvas.getContext('2d')!;
    this.spectrumImageData = this.spectrumCtx.createImageData(72, 1);
    // Pre-fill alpha to 255
    const data = this.spectrumImageData.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    this.spectrumTexture = PIXI.Texture.from(this.spectrumCanvas);
  }

  private updateSpectrumTexture(bins: Float32Array): void {
    if (!this.spectrumCtx || !this.spectrumImageData || !this.spectrumTexture) return;
    const data = this.spectrumImageData.data;
    for (let i = 0; i < 72; i++) {
      const v = Math.round(Math.min(1, bins[i] || 0) * 255);
      const p = i * 4;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      // alpha already set to 255
    }
    this.spectrumCtx.putImageData(this.spectrumImageData, 0, 0);
    this.spectrumTexture.source.update();
  }

  private buildFilter(): void {
    try {
      // Create spectrum texture before building resources
      this.buildSpectrumTexture();

      const fragmentSrc = getFragmentSource(this.config.shaderType);

      const glProgram = PIXI.GlProgram.from({
        vertex: DEFAULT_VERTEX,
        fragment: fragmentSrc,
        // Keep program names instance-scoped so export renderer teardown cannot
        // accidentally invalidate preview shader programs.
        name: `shader-layer-${this.config.shaderType}-${this.programInstanceId}`,
      });

      const uniformGroup = new PIXI.UniformGroup({
        uTime: { value: 0, type: 'f32' },
        uRms: { value: 0, type: 'f32' },
        uBass: { value: 0, type: 'f32' },
        uMid: { value: 0, type: 'f32' },
        uTreble: { value: 0, type: 'f32' },
        uResolution: { value: new Float32Array([1920, 1080]), type: 'vec2<f32>' },
        uSpeed: { value: 1, type: 'f32' },
        uIntensity: { value: 1, type: 'f32' },
        uScale: { value: 1, type: 'f32' },
        uColor1: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
        uColor2: { value: new Float32Array([0, 1, 1]), type: 'vec3<f32>' },
        uColor3: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
        uAudioReactivity: { value: 1, type: 'f32' },
        uFeedbackEnabled: { value: 0, type: 'f32' },
        uFeedbackAmount: { value: 0.5, type: 'f32' },
        uFeedbackZoom: { value: 1.0, type: 'f32' },
        uFeedbackRotate: { value: 0, type: 'f32' },
        uDistortionStrength: { value: 1, type: 'f32' },
        uFlowSpeed: { value: 1, type: 'f32' },
        uViscosity: { value: 0.72, type: 'f32' },
        uBeat: { value: 0, type: 'f32' },
        uBeatPhase: { value: 0, type: 'f32' },
        uBpm: { value: 120, type: 'f32' },
      });

      // Create a 1x1 white texture as placeholder for uPrevTex
      const placeholderTex = PIXI.Texture.WHITE;

      this.filter = new PIXI.Filter({
        glProgram,
        resources: {
          shaderUniforms: uniformGroup,
          uPrevTex: placeholderTex.source,
          uSceneTex: placeholderTex.source,
          uSpectrum: (this.spectrumTexture ?? placeholderTex).source,
        },
      });

      this.uniforms = this.filter.resources.shaderUniforms.uniforms;
      this.graphics.filters = [this.filter];
    } catch (e) {
      console.error(`[ShaderLayer] Failed to build filter for "${this.config.shaderType}":`, e);
    }
  }

  private destroyFilter(): void {
    if (this.filter) {
      this.graphics.filters = [];
      // Do not destroy the filter program here.
      // Pixi may internally reuse/cross-reference shader programs, and export
      // cleanup can run while preview remains active. Releasing references is
      // enough for GC and avoids invalidating live preview shaders.
      this.filter = null;
      this.uniforms = null;
    }
    if (this.spectrumTexture) {
      this.spectrumTexture.destroy(true);
      this.spectrumTexture = null;
      this.spectrumCanvas = null;
      this.spectrumCtx = null;
      this.spectrumImageData = null;
    }
  }

  private resizeRect(w: number, h: number): void {
    this.lastW = w;
    this.lastH = h;
    this.graphics.clear();
    // Draw a full-screen black rect so shader fallback is never white.
    this.graphics.rect(0, 0, w, h).fill({ color: 0x000000 });
  }

  private captureSceneTexture(ctx: RenderContext): void {
    if (!this.renderer || !this.sceneRT || this.lastW <= 0 || this.lastH <= 0) return;
    const wasVisible = this.container.visible;
    this.container.visible = false;
    this.renderer.render({
      container: ctx.app.stage,
      target: this.sceneRT,
      clear: true,
    });
    this.container.visible = wasVisible;
  }

  private resizeSceneCapture(w: number, h: number): void {
    if (!this.sceneRT) {
      this.initSceneCapture(w, h);
      return;
    }
    this.sceneRT.resize(w, h);
    if (this.sceneSprite) {
      this.sceneSprite.width = w;
      this.sceneSprite.height = h;
    }
  }
}

/* ---- color helper ---- */

function hexToVec3(hex: string, out: Float32Array): void {
  const c = hex.replace('#', '');
  out[0] = parseInt(c.substring(0, 2), 16) / 255;
  out[1] = parseInt(c.substring(2, 4), 16) / 255;
  out[2] = parseInt(c.substring(4, 6), 16) / 255;
}

function sampleParamOr(param: any, t: number, fallback: number): number {
  try {
    if (!param) return fallback;
    return sampleParam(param, t);
  } catch {
    return fallback;
  }
}
