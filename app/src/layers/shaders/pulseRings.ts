import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Pulse Rings -- expanding concentric rings from center               */
/* ------------------------------------------------------------------ */

export const PULSE_RINGS_FRAG = COMMON + `
void main() {
  vec2 uv = (vTextureCoord * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  vec3 color = vec3(0.0);

  // Expanding ring waves with per-ring color
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ringTime = fract(fi * 0.0833 - t * 0.4);
    float ringDist = ringTime * 2.5;
    float ringWidth = 0.015 + 0.01 * uScale;

    // Sharp ring with soft falloff
    float ring = smoothstep(ringWidth, 0.0, abs(dist - ringDist));
    ring *= ring;
    ring *= smoothstep(2.5, 0.0, ringDist);

    // Audio modulation: different rings respond to different bands
    float audioMod = 1.0;
    if (i < 4) audioMod += uBass * ar * 5.0;
    else if (i < 8) audioMod += uMid * ar * 4.0;
    else audioMod += uTreble * ar * 3.0;

    // Color variation per ring
    float colorPhase = fi * 0.3 + t * 0.5;
    vec3 rc = mix(uColor1, uColor2, sin(colorPhase) * 0.5 + 0.5);
    color += rc * ring * audioMod;
  }

  // Angular pattern overlay
  float angularPattern = sin(angle * 6.0 + t) * 0.5 + 0.5;
  color *= 0.7 + angularPattern * 0.3;

  // Central glow
  float centerGlow = exp(-dist * 4.0) * (1.0 + uRms * ar * 6.0);
  color += uColor3 * centerGlow;

  // Outer dim ring pulse
  float outerPulse = smoothstep(0.03, 0.0, abs(dist - 1.0 - sin(t) * 0.2));
  color += uColor1 * outerPulse * 0.3;

  color *= uIntensity;

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
