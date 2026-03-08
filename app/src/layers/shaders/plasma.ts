import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Plasma -- multi-frequency sine interference                         */
/* ------------------------------------------------------------------ */

export const PLASMA_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float bassF = 1.0 + uBass * ar * 3.0;
  float midS  = uMid * ar * 2.0;
  float trebD = 1.0 + uTreble * ar * 2.0;

  float v = 0.0;
  v += sin((uv.x * uScale * 10.0 + t * 1.3) * bassF);
  v += sin((uv.y * uScale * 10.0 + t * 0.9) * bassF);
  v += sin(((uv.x + uv.y) * uScale * 7.0 + t * 1.7) * trebD * 0.7);

  vec2 center = vec2(
    0.5 + sin(t * 0.5 + midS) * 0.3,
    0.5 + cos(t * 0.7 + midS) * 0.3
  );
  float d = length(uv - center);
  v += sin(d * uScale * 20.0 - t * 2.0);

  // Second center for depth
  vec2 c2 = vec2(
    0.5 + cos(t * 0.3) * 0.4,
    0.5 + sin(t * 0.4) * 0.4
  );
  v += sin(length(uv - c2) * uScale * 15.0 + t * 1.5) * 0.5;

  v *= 0.2;

  // Rich color mapping
  float c1 = sin(v * PI) * 0.5 + 0.5;
  float c2f = sin(v * PI + PI * 0.667) * 0.5 + 0.5;
  float c3 = sin(v * PI + PI * 1.333) * 0.5 + 0.5;
  vec3 color = uColor1 * c1 + uColor2 * c2f + uColor3 * c3;

  color *= uIntensity * (1.0 + uRms * ar);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
