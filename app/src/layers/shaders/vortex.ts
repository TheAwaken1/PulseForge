import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Vortex -- logarithmic spiral with multiple arms                     */
/* ------------------------------------------------------------------ */

export const VORTEX_FRAG = COMMON + `
void main() {
  vec2 uv = (vTextureCoord * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Logarithmic spiral
  float arms = 5.0;
  float spiral = angle * arms - log(dist + 0.001) * uScale * 10.0 + t * 2.5;
  spiral += uBass * ar * 4.0;

  float pattern = sin(spiral) * 0.5 + 0.5;
  pattern = pow(pattern, 1.5); // sharpen arms

  // Secondary spiral (counter-rotating, finer)
  float spiral2 = angle * 8.0 + log(dist + 0.001) * uScale * 6.0 - t * 1.5;
  float p2 = sin(spiral2) * 0.5 + 0.5;
  p2 = pow(p2, 2.0);

  // Fade at edges
  float edgeFade = smoothstep(1.5, 0.0, dist);

  // Inner glow
  float glow = exp(-dist * 3.0) * (1.0 + uRms * ar * 6.0);

  // Color
  vec3 color = mix(uColor1, uColor2, pattern) * edgeFade;
  color += uColor2 * p2 * 0.3 * edgeFade;
  color += uColor3 * glow;

  // Brightness modulation
  color *= uIntensity * (1.0 + uMid * ar * 2.0);

  // Radial highlight on beat
  float radialPulse = smoothstep(0.05, 0.0, abs(dist - fract(t * 0.5) * 1.5));
  color += uColor3 * radialPulse * uRms * ar * 2.0;

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
