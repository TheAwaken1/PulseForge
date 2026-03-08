import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Retro Grid -- 80s synthwave grid with scanlines and pixel effects   */
/* ------------------------------------------------------------------ */

export const RETRO_GRID_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  vec3 color = vec3(0.0);

  // === HORIZON GRID (bottom half perspective floor) ===
  vec2 gridUV = uv;
  // Transform to perspective grid
  float horizon = 0.45;
  if (gridUV.y > horizon) {
    float perspective = (gridUV.y - horizon) / (1.0 - horizon);
    float depth = 1.0 / (perspective + 0.01);

    float gridX = gridUV.x * depth * uScale * 4.0;
    float gridZ = depth * uScale * 2.0 - t * 3.0;

    // Grid lines
    float lineX = smoothstep(0.06, 0.0, abs(fract(gridX) - 0.5));
    float lineZ = smoothstep(0.06, 0.0, abs(fract(gridZ) - 0.5));
    float grid = max(lineX, lineZ);
    grid *= smoothstep(0.0, 0.2, perspective); // fade near horizon

    // Grid glow color: magenta to cyan gradient
    vec3 gridColor = mix(uColor1, uColor2, perspective);
    gridColor *= 1.0 + uBass * ar * 3.0;
    color += gridColor * grid * 0.8;

    // Grid floor ambient glow
    color += uColor1 * 0.05 * smoothstep(0.0, 0.3, perspective);
  }

  // === SUN ===
  vec2 sunCenter = vec2(uResolution.x / uResolution.y * 0.5, 0.38);
  float sunDist = length(uv - sunCenter);
  float sun = smoothstep(0.22, 0.18, sunDist);

  // Sun stripe effect (horizontal bands cut into the sun)
  float stripes = step(0.5, fract(uv.y * 30.0 - t * 0.5));
  float sunMask = sun * mix(1.0, stripes, smoothstep(0.0, 0.18, sunDist));
  vec3 sunColor = mix(uColor3, uColor1, smoothstep(0.0, 0.2, sunDist));
  color += sunColor * sunMask;

  // Sun halo
  color += mix(uColor1, uColor3, 0.5) * exp(-sunDist * 6.0) * 0.4;

  // === STARS (top half) ===
  if (uv.y < horizon + 0.1) {
    vec2 starUV = uv * 80.0 * uScale;
    vec2 id = floor(starUV);
    vec2 f = fract(starUV) - 0.5;
    float starH = hash21(id);
    float star = smoothstep(0.15, 0.0, length(f - (hash22(id) - 0.5) * 0.6));
    star *= step(0.85, starH); // only 15% of cells have stars
    star *= sin(starH * 100.0 + t * 3.0) * 0.3 + 0.7; // twinkle
    star *= smoothstep(horizon + 0.1, horizon - 0.1, uv.y); // fade near horizon
    color += vec3(star) * 0.6;
  }

  // === SCANLINES ===
  float scanline = sin(uv.y * uResolution.y * 1.5) * 0.5 + 0.5;
  scanline = mix(1.0, scanline, 0.15);
  color *= scanline;

  // === PIXELATION effect ===
  // Subtle pixel grid overlay
  float pixSize = 4.0;
  vec2 pixUV = floor(vTextureCoord * uResolution / pixSize) * pixSize / uResolution;
  float pixEdge = smoothstep(0.0, 0.5 / pixSize, fract(vTextureCoord.x * uResolution.x / pixSize));
  pixEdge *= smoothstep(0.0, 0.5 / pixSize, fract(vTextureCoord.y * uResolution.y / pixSize));
  color *= 0.85 + pixEdge * 0.15;

  // === Audio-reactive mountain silhouette on horizon ===
  float mountainX = uv.x * uScale * 6.0;
  float mountain = valueNoise(vec2(mountainX, 0.0)) * 0.08;
  mountain += valueNoise(vec2(mountainX * 3.0, 1.0)) * 0.03;
  float mountainLine = smoothstep(0.005, 0.0, abs(uv.y - horizon + mountain));
  mountainLine += smoothstep(0.0, -0.02, uv.y - horizon + mountain) * 0.3;
  color += uColor2 * mountainLine * (1.0 + uMid * ar * 2.0);

  color *= uIntensity;

  // CRT vignette
  float vig = 1.0 - dot(vTextureCoord - 0.5, vTextureCoord - 0.5) * 3.0;
  color *= smoothstep(0.0, 0.7, vig);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
