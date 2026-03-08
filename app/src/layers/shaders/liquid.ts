import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Liquid -- metaball field with ripple distortion                     */
/* ------------------------------------------------------------------ */

export const LIQUID_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  float ar = uAudioReactivity;
  float time = uTime * uSpeed;
  vec2 p = (uv - 0.5) * uScale * 2.0;
  p.x *= uResolution.x / uResolution.y;

  // Ripple distortion from RMS
  float ripple = sin(length(p) * 12.0 - time * 3.0) * 0.02 * uRms * ar;
  p += normalize(p + 0.001) * ripple;

  // 8 metaballs with sine paths
  float field = 0.0;
  vec3 blobColorMix = vec3(0.0);
  float totalWeight = 0.0;

  for (float i = 0.0; i < 8.0; i++) {
    float phase = i * 0.7853; // i * PI/4
    float speed1 = 0.3 + i * 0.08;
    float speed2 = 0.2 + i * 0.11;

    // Mid drives movement amplitude
    float moveAmp = 0.5 + uMid * ar * 0.3;
    vec2 blobPos = vec2(
      sin(time * speed1 + phase) * moveAmp * (0.6 + 0.4 * sin(i * 1.3)),
      cos(time * speed2 + phase * 1.4) * moveAmp * (0.5 + 0.5 * cos(i * 0.9))
    );

    float dist = length(p - blobPos);
    // Bass drives blob size
    float blobSize = (0.12 + i * 0.01) * (1.0 + uBass * ar * 0.4);
    float contribution = blobSize / (dist + 0.001);
    field += contribution;

    // Color contribution weighted by proximity
    float weight = contribution * contribution;
    float hue = fract(i / 8.0 + time * 0.05);
    vec3 blobColor = mix(uColor1, uColor2, hue);
    blobColor = mix(blobColor, uColor3, sin(hue * PI) * 0.5 + 0.5);
    blobColorMix += blobColor * weight;
    totalWeight += weight;
  }

  blobColorMix /= max(totalWeight, 0.001);

  // Smoothstep thresholds for edge / core / highlight
  float edge = smoothstep(0.9, 1.2, field);
  float core = smoothstep(1.2, 2.0, field);
  float highlight = smoothstep(2.5, 4.0, field);

  vec3 color = vec3(0.0);
  // Edge glow
  color += blobColorMix * edge * 0.5;
  // Core fill
  color += blobColorMix * core * 0.7;
  // Bright highlight
  color += vec3(1.0) * highlight * 0.3;

  // Subtle background pattern
  float bgPattern = valueNoise(uv * 8.0 + time * 0.1) * 0.05;
  color += uColor1 * bgPattern;

  color *= uIntensity;

  // Vignette
  float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 2.0;
  color *= smoothstep(0.0, 0.8, vig);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
