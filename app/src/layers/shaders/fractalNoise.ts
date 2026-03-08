import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Fractal Noise -- domain-warped fBm                                  */
/* ------------------------------------------------------------------ */

export const FRACTAL_NOISE_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  // First layer: base warping
  vec2 q = vec2(
    fbm(uv * uScale * 4.0 + vec2(0.0, t * 0.3)),
    fbm(uv * uScale * 4.0 + vec2(5.2, t * 0.4))
  );

  // Second layer: audio-displaced warping
  vec2 r = vec2(
    fbm(uv * uScale * 4.0 + q * 4.0 + vec2(1.7 + uBass * ar * 2.0, 9.2 + uMid * ar * 2.0) + t * 0.15),
    fbm(uv * uScale * 4.0 + q * 4.0 + vec2(8.3 + uTreble * ar * 2.0, 2.8 + uBass * ar) + t * 0.25)
  );

  float f = fbm(uv * uScale * 4.0 + r * 2.0);

  // Extra detail layer
  float detail = fbm(uv * uScale * 8.0 + r * 3.0 + t * 0.1);
  f = f * 0.7 + detail * 0.3;

  // Color mapping with smooth gradients
  vec3 color = mix(uColor1, uColor2, clamp(f * 1.5, 0.0, 1.0));
  color = mix(color, uColor3, clamp(length(r) * 0.7, 0.0, 1.0));

  // Highlight veins
  float veins = smoothstep(0.4, 0.5, f) * smoothstep(0.6, 0.5, f);
  color += uColor3 * veins * 2.0;

  // Audio brightness
  color *= uIntensity * (1.0 + uRms * ar * 2.5);

  // Vignette
  float vig = 1.0 - dot(vTextureCoord - 0.5, vTextureCoord - 0.5) * 2.0;
  color *= smoothstep(0.0, 0.8, vig);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
