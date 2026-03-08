import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Geometric -- SDF wireframe polygons with Flower of Life center      */
/* ------------------------------------------------------------------ */

export const GEOMETRIC_FRAG = COMMON + `
float sdPolygon(vec2 p, float r, float n) {
  float an = PI / n;
  float a = atan(p.y, p.x);
  float sector = floor(0.5 + a / (2.0 * an));
  a = a - 2.0 * an * sector;
  return length(p) * cos(a) - r * cos(an);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  vec2 uv = vTextureCoord;
  float ar = uAudioReactivity;
  float time = uTime * uSpeed;
  vec2 p = (uv - 0.5) * uScale * 2.0;
  p.x *= uResolution.x / uResolution.y; // aspect correction

  vec3 color = vec3(0.0);

  // Bass drives rotation
  float rot = time * 0.2 + uBass * ar * 0.5;
  float ca = cos(rot), sa = sin(rot);
  vec2 rp = mat2(ca, -sa, sa, ca) * p;

  // Concentric polygons (triangle through heptagon)
  for (float i = 0.0; i < 5.0; i++) {
    float sides = 3.0 + i;
    float radius = 0.15 + i * 0.12;

    // Mid drives radius pulse
    float pulse = 1.0 + uMid * ar * 0.15 * sin(time * 2.0 + i * 0.8);
    radius *= pulse;

    // Per-ring rotation offset
    float ringRot = time * (0.1 + i * 0.05) * (mod(i, 2.0) == 0.0 ? 1.0 : -1.0);
    float cra = cos(ringRot), sra = sin(ringRot);
    vec2 ringP = mat2(cra, -sra, sra, cra) * rp;

    float d = sdPolygon(ringP, radius, sides);
    float edge = 1.0 - smoothstep(0.0, 0.008, abs(d));

    // Treble drives edge brightness
    float brightness = (0.6 + 0.4 * uTreble * ar);
    vec3 ringColor = mix(uColor1, uColor2, i / 5.0) * brightness;
    color += ringColor * edge;

    // Subtle inner glow
    float innerGlow = exp(-abs(d) * 40.0) * 0.15;
    color += ringColor * innerGlow;
  }

  // Flower of Life center — 6 overlapping circles
  float flowerR = 0.08 * (1.0 + uRms * ar * 0.3);
  for (float i = 0.0; i < 6.0; i++) {
    float angle = i * TAU / 6.0 + rot * 0.5;
    vec2 offset = vec2(cos(angle), sin(angle)) * flowerR;
    float d = sdCircle(rp - offset, flowerR);
    float edge = 1.0 - smoothstep(0.0, 0.006, abs(d));
    color += uColor3 * edge * 0.5;
  }
  // Center circle
  float centerD = sdCircle(rp, flowerR);
  float centerEdge = 1.0 - smoothstep(0.0, 0.006, abs(centerD));
  color += uColor3 * centerEdge * 0.5;

  // Radial pulse lines
  for (float i = 0.0; i < 8.0; i++) {
    float angle = i * TAU / 8.0 + rot;
    vec2 dir = vec2(cos(angle), sin(angle));
    float lineDist = abs(dot(rp, vec2(-dir.y, dir.x)));
    float alongDist = dot(rp, dir);
    float line = 1.0 - smoothstep(0.0, 0.003, lineDist);
    line *= smoothstep(0.1, 0.15, alongDist) * smoothstep(0.9, 0.85, alongDist);

    float pulseDist = fract(alongDist * 8.0 - time * 2.0);
    float pulseGlow = exp(-pulseDist * 3.0) * 0.4;
    color += uColor1 * line * pulseGlow * (1.0 + uRms * ar);
  }

  color *= uIntensity;

  // Soft vignette
  float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 2.5;
  color *= smoothstep(0.0, 0.7, vig);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
