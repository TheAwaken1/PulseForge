/**
 * Common GLSL header prepended to all fragment shaders,
 * plus the default vertex shader for the PixiJS v8 filter pipeline.
 */

/* ------------------------------------------------------------------ */
/*  Default vertex shader (PixiJS v8 filter pipeline)                  */
/* ------------------------------------------------------------------ */

export const DEFAULT_VERTEX = `
in vec2 aPosition;
// vTextureCoord is 0..1 across the filter OUTPUT frame (screen space).
// PixiJS pools filter textures at power-of-two sizes, so the classic
// filterTextureCoord() only spans part of the texture (e.g. 0..0.94 x 0..0.53
// for a 1920x1080 frame in a 2048x2048 texture). All PulseForge shaders treat
// the coordinate as screen space, so we pass aPosition directly and keep the
// padded texture coordinate separately for shaders that sample uTexture.
out vec2 vTextureCoord;
out vec2 vInputCoord;
out vec2 vInputScale;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = aPosition;
  vInputCoord = filterTextureCoord();
  vInputScale = uOutputFrame.zw * uInputSize.zw;
}
`;

/* ------------------------------------------------------------------ */
/*  Vertex shader for post-process EFFECTS (bloom, pixelate, ...)       */
/*                                                                      */
/*  Effects sample the filter input texture, so they need the classic   */
/*  PixiJS texture coordinate that accounts for power-of-two padding.   */
/*  Do NOT use DEFAULT_VERTEX for effects: it maps vTextureCoord to     */
/*  screen space and would sample the padded texture incorrectly.       */
/* ------------------------------------------------------------------ */

export const FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

/* ------------------------------------------------------------------ */
/*  Common GLSL header (prepended to all fragment shaders)             */
/* ------------------------------------------------------------------ */

export const COMMON = `
in vec2 vTextureCoord;   // screen space, 0..1 over the frame
in vec2 vInputCoord;     // padded input texture space (for uTexture sampling)
in vec2 vInputScale;     // multiply a screen-space uv by this to sample uTexture
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uPrevTex;
uniform sampler2D uSceneTex;

uniform float uTime;
uniform float uRms;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uIntensity;
uniform float uScale;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uAudioReactivity;

uniform float uFeedbackEnabled;
uniform float uFeedbackAmount;
uniform float uFeedbackZoom;
uniform float uFeedbackRotate;
uniform float uDistortionStrength;
uniform float uFlowSpeed;
uniform float uViscosity;

uniform float uBeat;       // decaying flash: 1.0 on beat, ~0 within 200ms
uniform float uBeatPhase;  // 0→1 sawtooth, resets to 0 each beat
uniform float uBpm;        // estimated tempo

uniform sampler2D uSpectrum; // 72×1 texture, R channel = normalized bin value

float sampleSpectrum(float freq) {
  return texture(uSpectrum, vec2(clamp(freq, 0.0, 1.0), 0.5)).r;
}

#define PI  3.14159265359
#define TAU 6.28318530718

/* ---- hash / noise utilities ---- */

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  p = fract(p * vec2(5.3983, 5.4427));
  p += dot(p, p.yx + 21.5351);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * valueNoise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

/* ---- Classic visualizer-style feedback sampling ---- */

vec3 applyFeedback(vec3 currentColor) {
  if (uFeedbackEnabled < 0.5) return currentColor;

  // Rotate + zoom the UV to sample the previous frame with warping
  vec2 fbUV = vTextureCoord - 0.5;
  float ca = cos(uFeedbackRotate);
  float sa = sin(uFeedbackRotate);
  fbUV = mat2(ca, -sa, sa, ca) * fbUV;
  fbUV /= uFeedbackZoom;
  fbUV += 0.5;

  // Sample previous frame (clamped to edges)
  vec3 prevColor = texture(uPrevTex, clamp(fbUV, 0.0, 1.0)).rgb;

  // Mix current with warped previous
  vec3 result = mix(currentColor, prevColor, uFeedbackAmount);

  // Subtle vignette to prevent edge buildup
  float vig = 1.0 - dot(vTextureCoord - 0.5, vTextureCoord - 0.5) * 1.5;
  vig = clamp(vig, 0.0, 1.0);
  result *= 0.3 + vig * 0.7;

  // Simple tone mapping to avoid dull / blown-out feedback
  result = result / (1.0 + result * 0.2);
  result = pow(result, vec3(0.95)); // slight gamma lift

  return result;
}
`;
