import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Starfield -- layered 3D star flight                                 */
/* ------------------------------------------------------------------ */

export const STARFIELD_FRAG = COMMON + `
void main() {
  vec2 uv = (vTextureCoord * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed * (1.0 + uRms * uAudioReactivity * 2.0);

  vec3 color = vec3(0.0);

  for (int layer = 0; layer < 5; layer++) {
    float fl = float(layer);
    float depth = fract(fl * 0.2 + t * 0.3);
    float scale = mix(30.0 * uScale, 0.8, depth);
    float fade = smoothstep(0.0, 0.25, depth) * smoothstep(1.0, 0.7, depth);
    float starSize = mix(0.005, 0.05, depth);

    vec2 starUV = uv * scale + fl * 17.31;
    vec2 id = floor(starUV);
    vec2 f = fract(starUV) - 0.5;

    for (int ix = -1; ix <= 1; ix++)
    for (int iy = -1; iy <= 1; iy++) {
      vec2 off = vec2(float(ix), float(iy));
      vec2 h = hash22(id + off) - 0.5;
      vec2 p = off + h - f;
      float dd = length(p);
      float star = smoothstep(starSize, 0.0, dd);

      // Twinkle
      float twinkle = sin(hash21(id + off) * 100.0 + t * 4.0) * 0.5 + 0.5;
      star *= 0.4 + twinkle * 0.6;

      // Star color
      float colorMix = hash21(id + off + 42.0);
      vec3 sc = mix(uColor1, uColor2, colorMix);
      sc = mix(sc, vec3(1.0), step(0.95, colorMix)); // some white stars
      color += star * fade * sc;
    }
  }

  // Central glow on bass
  float centerD = length(uv);
  color += uColor3 * exp(-centerD * 3.0) * uBass * uAudioReactivity * 2.0;

  // Speed lines on high energy
  float speedLine = smoothstep(0.02, 0.0, abs(fract(atan(uv.y, uv.x) * 20.0 / TAU + t * 2.0) - 0.5));
  color += uColor1 * speedLine * uRms * uAudioReactivity * 0.3;

  color *= uIntensity;

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
