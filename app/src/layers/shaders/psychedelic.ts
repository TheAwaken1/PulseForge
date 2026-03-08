import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Psychedelic -- kaleidoscopic mirror with rainbow color cycling       */
/* ------------------------------------------------------------------ */

export const PSYCHEDELIC_FRAG = COMMON + `
void main() {
  vec2 uv = (vTextureCoord * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Kaleidoscope: mirror into 8 segments
  float segments = 8.0;
  float ka = mod(angle + PI, TAU / segments);
  ka = abs(ka - PI / segments);
  vec2 kuv = vec2(cos(ka), sin(ka)) * dist;

  // Domain warping with audio
  vec2 warp = vec2(
    fbm(kuv * uScale * 3.0 + vec2(t * 0.3, uBass * ar * 2.0)),
    fbm(kuv * uScale * 3.0 + vec2(t * 0.4 + 5.0, uMid * ar * 2.0))
  );
  float f = fbm(kuv * uScale * 3.0 + warp * 3.0 + t * 0.2);

  // Rainbow cycling based on pattern + time + distance
  float hue = f * 2.0 + t * 0.3 + dist * 0.5;
  float sat = 0.8 + uTreble * ar * 0.2;

  // HSV to RGB (inline)
  vec3 hsv = vec3(hue, sat, 1.0);
  vec3 p3 = abs(fract(hsv.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  vec3 rainbow = hsv.z * mix(vec3(1.0), clamp(p3 - 1.0, 0.0, 1.0), hsv.y);

  // Blend with user colors
  vec3 color = mix(rainbow, uColor1, 0.3) * (0.5 + f * 0.5);
  color += uColor2 * smoothstep(0.45, 0.5, f) * smoothstep(0.55, 0.5, f) * 3.0; // bright veins
  color += uColor3 * exp(-dist * 3.0) * (1.0 + uRms * ar * 5.0); // center glow

  // Pulsing mandala rings
  float rings = sin(dist * 20.0 * uScale - t * 2.0 + uBass * ar * 8.0) * 0.5 + 0.5;
  rings = pow(rings, 4.0);
  color += rainbow * rings * 0.4;

  // Angular rays
  float rays = pow(sin(angle * segments + t * 1.5) * 0.5 + 0.5, 3.0);
  color += uColor2 * rays * 0.15 * (1.0 + uMid * ar * 3.0);

  color *= uIntensity * (1.0 + uRms * ar * 1.5);

  // Soft vignette
  color *= smoothstep(2.0, 0.3, dist);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
