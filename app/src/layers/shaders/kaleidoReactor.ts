import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Kaleido Reactor -- mirrored polar energy geometry and spectrum ink */
/* ------------------------------------------------------------------ */

export const KALEIDO_REACTOR_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  p /= max(uScale, 0.1);

  float react = uAudioReactivity;
  float time = uTime * uSpeed;
  float radius = length(p);
  float angle = atan(p.y, p.x);

  float segments = 10.0;
  float sector = TAU / segments;
  float rotation = time * 0.18 + uMid * react * 0.28 + uBeat * 0.035;
  float folded = abs(mod(angle + rotation + sector * 0.5, sector) - sector * 0.5);
  vec2 mirrorUv = vec2(cos(folded), sin(folded)) * radius;

  float spectrumCoord = fract(radius * 2.8 + folded / sector * 0.35);
  float spectrum = sampleSpectrum(spectrumCoord);
  float bassPulse = uBass * react + uBeat * 0.42;
  float warp = sin(mirrorUv.x * 19.0 - time * 1.7) * 0.055;
  warp += sin(mirrorUv.y * 31.0 + time * 1.15) * 0.025;
  warp += spectrum * react * 0.105;

  float petals = cos(folded * segments * 2.0 + radius * 13.0 - time * 1.3 + warp * 8.0);
  float petals2 = sin(mirrorUv.x * 22.0 + mirrorUv.y * 13.0 + time + warp * 11.0);
  float ink = fbm(mirrorUv * 6.0 + vec2(time * 0.12, -time * 0.08) + warp);

  float ringPhase = radius * (20.0 + uTreble * react * 4.0) - time * 2.1 - bassPulse * 2.0;
  float ringDistance = abs(fract(ringPhase) - 0.5);
  float rings = smoothstep(0.12, 0.0, ringDistance);
  float petalLines = smoothstep(0.18, 0.72, petals * 0.5 + 0.5);
  petalLines *= smoothstep(0.08, 0.62, petals2 * 0.5 + 0.5);

  float cells = smoothstep(0.46, 0.76, ink + petals * 0.16 + spectrum * react * 0.22);
  float edge = rings * (0.45 + petalLines * 0.9);
  float energy = cells * 0.42 + edge * 1.25;

  vec3 colorA = mix(uColor1, uColor2, clamp(radius * 1.8 + spectrum * 0.35, 0.0, 1.0));
  vec3 colorB = mix(uColor3, uColor1, ink);
  vec3 color = mix(colorA, colorB, petalLines * 0.52) * energy;

  // Mirrored spokes and a hot reactor core add structure to the organic ink.
  float spokeDistance = abs(sin(folded * segments));
  float spokes = smoothstep(0.075, 0.0, spokeDistance) * smoothstep(0.62, 0.08, radius);
  color += uColor2 * spokes * (0.12 + spectrum * react * 0.52 + uTreble * react * 0.28);

  float coreRadius = 0.075 + bassPulse * 0.032;
  float core = smoothstep(coreRadius, coreRadius - 0.018, radius);
  float coreHalo = exp(-radius * (10.0 - bassPulse * 2.5));
  color += uColor3 * core * (0.65 + uBeat * 0.8);
  color += mix(uColor1, uColor3, 0.5) * coreHalo * (0.24 + bassPulse * 0.6);

  // Beat flash is concentrated in the geometry rather than washing the frame.
  color += mix(uColor2, uColor3, radius) * edge * uBeat * 0.65;
  color *= uIntensity;
  color *= smoothstep(0.92, 0.12, radius);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
