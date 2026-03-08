import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Nebula -- domain-warped fbm with stellar points                     */
/* ------------------------------------------------------------------ */

export const NEBULA_FRAG = COMMON + `
float nebulaNoise(vec2 p, float t) {
  // Domain warp: offset p by fbm of p
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0)),
                fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.12 * t));
  return fbm(p + 4.0 * r);
}

void main() {
  vec2 uv = vTextureCoord;
  float ar = uAudioReactivity;
  float time = uTime * uSpeed;
  vec2 p = (uv - 0.5) * uScale * 3.0;

  // Bass drives breathing scale
  float breathe = 1.0 + uBass * ar * 0.15;
  p *= breathe;

  // Multi-layer nebula
  float n1 = nebulaNoise(p, time * 0.4);
  float n2 = nebulaNoise(p * 1.5 + 3.0, time * 0.3 + 10.0);
  float n3 = nebulaNoise(p * 0.7 - 2.0, time * 0.5 + 20.0);

  // Color mapping
  vec3 color = vec3(0.0);
  color += uColor1 * smoothstep(0.2, 0.8, n1) * 0.7;
  color += uColor2 * smoothstep(0.3, 0.9, n2) * 0.5;
  color += uColor3 * smoothstep(0.4, 0.7, n3) * 0.4;

  // Dust lanes (dark ribbons)
  float dust = smoothstep(0.45, 0.55, n1 * n2);
  color *= 0.6 + dust * 0.4;

  // Stellar points from high-power noise
  for (float i = 0.0; i < 4.0; i++) {
    vec2 starP = p * (30.0 + i * 20.0) + vec2(i * 7.1, i * 13.3);
    float star = pow(hash21(floor(starP)), 40.0);
    float twinkle = 0.5 + 0.5 * sin(time + hash21(floor(starP)) * TAU);
    // Treble drives stellar brightness
    float brightness = (1.0 + uTreble * ar * 3.0) * twinkle;
    color += vec3(star * brightness * 0.8);
  }

  // Core glow at center
  float coreGlow = exp(-dot(uv - 0.5, uv - 0.5) * 4.0) * 0.25;
  color += mix(uColor1, uColor2, 0.5) * coreGlow * (1.0 + uRms * ar);

  color *= uIntensity;

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
