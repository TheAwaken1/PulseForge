import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Mesh Wave -- audio-reactive perspective terrain and light horizon  */
/* ------------------------------------------------------------------ */

export const MESH_WAVE_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float react = uAudioReactivity;
  float horizon = 0.43 - uBass * react * 0.018 - uBeat * 0.012;

  vec2 centered = uv - 0.5;
  centered.x *= aspect;

  vec3 color = mix(uColor3 * 0.025, vec3(0.0), uv.y);

  // Deep-space dust above the horizon. Treble makes the field sparkle.
  vec2 starUv = vec2(centered.x, uv.y) * vec2(92.0, 72.0) * uScale;
  vec2 starCell = floor(starUv);
  vec2 starLocal = fract(starUv) - 0.5;
  float starSeed = hash21(starCell);
  vec2 starOffset = (hash22(starCell) - 0.5) * 0.62;
  float star = smoothstep(0.09, 0.0, length(starLocal - starOffset));
  star *= step(0.965, starSeed) * smoothstep(horizon + 0.08, horizon - 0.05, uv.y);
  star *= 0.35 + 0.65 * sin(time * 2.4 + starSeed * 40.0) * sin(time * 2.4 + starSeed * 40.0);
  color += mix(uColor2, uColor3, starSeed) * star * (0.7 + uTreble * react * 2.5);

  if (uv.y > horizon) {
    float floorY = max(uv.y - horizon, 0.002);
    float depth = 0.115 / floorY;
    float worldX = centered.x * depth * 2.35 / max(uScale, 0.1);
    float worldZ = depth * 2.2 - time * (1.6 + uBass * react * 1.5);

    float spectrumPos = fract(abs(worldX) * 0.085 + worldZ * 0.018);
    float spectrum = sampleSpectrum(spectrumPos);
    float terrain = sin(worldX * 1.35 + time) * 0.18;
    terrain += sin(worldX * 3.1 - worldZ * 0.32) * 0.075;
    terrain += spectrum * react * 0.55 + uBass * react * 0.22;

    float warpedZ = worldZ + terrain * (1.0 + depth * 0.055);
    float lineXDistance = abs(fract(worldX) - 0.5);
    float lineZDistance = abs(fract(warpedZ) - 0.5);
    float lineWidth = mix(0.025, 0.105, clamp(floorY * 1.55, 0.0, 1.0));
    float lineX = smoothstep(lineWidth, 0.0, lineXDistance);
    float lineZ = smoothstep(lineWidth, 0.0, lineZDistance);
    float grid = max(lineX, lineZ);

    float depthFade = smoothstep(0.0, 0.18, floorY) * (1.0 - smoothstep(0.72, 1.0, uv.y));
    depthFade += smoothstep(0.0, 0.12, floorY) * 0.35;
    vec3 gridColor = mix(uColor1, uColor2, clamp(floorY * 1.45 + spectrum * 0.35, 0.0, 1.0));
    float audioLight = 0.8 + spectrum * react * 2.2 + uBeat * 0.8;
    color += gridColor * grid * depthFade * audioLight;

    // Soft energy beneath each wire keeps the mesh dimensional without blur.
    float gridGlow = exp(-min(lineXDistance, lineZDistance) * 13.0);
    color += gridColor * gridGlow * depthFade * (0.06 + spectrum * react * 0.12);
  }

  float horizonBeam = exp(-abs(uv.y - horizon) * 52.0);
  color += mix(uColor1, uColor2, 0.55) * horizonBeam * (0.34 + uBass * react * 1.25 + uBeat * 0.7);
  color += uColor1 * exp(-abs(uv.y - horizon) * 10.0) * 0.055;

  // A distant audio sun gives the composition a strong focal point.
  vec2 sunCenter = vec2(0.0, horizon - 0.105 - 0.5);
  float sunDistance = length(centered - sunCenter);
  float sunRadius = 0.055 + uBass * react * 0.025 + uBeat * 0.014;
  float sun = smoothstep(sunRadius, sunRadius - 0.008, sunDistance);
  float sunHalo = exp(-sunDistance * 18.0);
  color += uColor3 * sun * (0.65 + uMid * react);
  color += mix(uColor1, uColor3, 0.55) * sunHalo * (0.18 + uBass * react * 0.42);

  color *= uIntensity;
  float vignette = 1.0 - dot(vTextureCoord - 0.5, vTextureCoord - 0.5) * 1.65;
  color *= smoothstep(0.0, 0.78, vignette);
  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
