import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Fullscreen displacement post-pass                                   */
/* ------------------------------------------------------------------ */

export const DISPLACEMENT_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  float ar = uAudioReactivity;
  float t = uTime * max(0.001, uFlowSpeed);

  // Smooth flow field (slow by default) for premium liquid refraction.
  vec2 p = uv * (1.6 + (1.0 - uViscosity) * 2.2);
  float n1 = fbm(p + vec2(0.0, t * 0.14));
  float n2 = fbm(p + vec2(11.3, -t * 0.11));
  float n3 = fbm(p * 1.7 + vec2(-3.7, t * 0.18));

  vec2 flow = vec2(n1 - n2, n3 - n1);
  flow = normalize(flow + 1e-4) * (0.2 + 0.8 * length(flow));

  // Audio-driven strength stays smooth (RMS + bass only).
  float audioBoost = 1.0 + (uRms * 0.8 + uBass * 0.7) * ar;
  float strength = uDistortionStrength * audioBoost;

  // Viscosity dampens high-frequency movement.
  float visc = clamp(uViscosity, 0.01, 1.0);
  vec2 disp = flow * strength * (0.001 + 0.01 * (1.0 - 0.75 * visc));

  // Subtle ripple layer to avoid static feel.
  float ripple = sin((uv.y + t * 0.035) * 35.0 + n2 * 4.0) * 0.0008 * strength;
  disp.x += ripple;

  vec2 duv = clamp(uv + disp, 0.001, 0.999);
  // uTexture is the power-of-two padded filter input: remap from screen space.
  vec3 scene = texture(uTexture, duv * vInputScale).rgb;

  // Keep blacks black, avoid haze.
  scene = max(scene - vec3(0.005), vec3(0.0));

  finalColor = vec4(applyFeedback(scene), 1.0);
}
`;
