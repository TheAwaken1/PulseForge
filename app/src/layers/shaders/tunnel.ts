import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Tunnel -- infinite zoom with rotating patterns                      */
/* ------------------------------------------------------------------ */

export const TUNNEL_FRAG = COMMON + `
void main() {
  vec2 uv = (vTextureCoord * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;
  float rmsB = 1.0 + uRms * ar * 2.0;
  float bassB = uBass * ar;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Tunnel projection: inverse distance gives depth
  float z = 1.0 / (dist + 0.1) + t * rmsB;
  float a = angle / PI + t * 0.15;

  // Multi-layer pattern
  float p1 = sin(z * uScale * 6.0) * sin(a * 5.0 + z * 0.4);
  float p2 = sin(z * uScale * 12.0 + t * 1.3) * sin(a * 8.0 - z * 0.7);
  float p3 = sin(z * uScale * 3.0 - t * 0.7) * cos(a * 3.0 + z * 0.2);
  float pattern = p1 * 0.5 + p2 * 0.3 + p3 * 0.2;

  // Color mixing
  vec3 color = mix(uColor1, uColor2, pattern * 0.5 + 0.5);
  color = mix(color, uColor3, sin(z * 1.5 + t * 0.5) * 0.5 + 0.5);

  // Depth / radial fade
  float depthFade = smoothstep(0.0, 0.6, dist);
  color *= depthFade;

  // Audio brightness
  color *= uIntensity * (1.0 + bassB * 4.0);

  // Soft vignette
  color *= exp(-dist * 0.2);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
