import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Aurora -- northern lights over a frozen lake                         */
/*                                                                      */
/*  Coordinate note: vTextureCoord.y is 0 at the TOP of the frame and   */
/*  1 at the bottom (same as retroGrid / meshWave).                      */
/*                                                                      */
/*  The curtains are a spectrum visualizer in disguise: the height and  */
/*  brightness of the aurora at each x follow the frequency spectrum,   */
/*  with bass in the middle of the sky and treble at the edges. Beats   */
/*  flash the vertical rays. Everything is mirrored into a rippling     */
/*  reflection below the horizon behind a mountain silhouette.          */
/* ------------------------------------------------------------------ */

export const AURORA_FRAG = COMMON + `
// Cheaper 3-octave fbm; the curtains call this several times per pixel.
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * valueNoise(p);
    p = p * 2.03 + vec2(31.7, 17.3);
    a *= 0.5;
  }
  return v;
}

// Aurora light for a sky position. uv.x in 0..1 across the frame,
// uv.y in 0 (top) .. horizon.
vec3 auroraLight(vec2 uv, float time, float ar) {
  vec3 light = vec3(0.0);
  float bassLift = uBass * ar;

  for (float i = 0.0; i < 3.0; i++) {
    float seed = i * 7.31;
    float drift = time * (0.06 + i * 0.03);

    // Curved path of this curtain across the sky.
    float base = 0.34 + i * 0.11;
    float path = base
      + sin(uv.x * (1.6 + i * 0.5) * PI + drift * 3.0 + seed) * 0.05
      + (fbm3(vec2(uv.x * 1.3 * uScale + drift, seed)) - 0.5) * 0.14;

    // Spectrum along x: bass in the centre, treble at the edges.
    float spec = sampleSpectrum(clamp(abs(uv.x - 0.5) * 1.9 + i * 0.04, 0.0, 1.0));

    // Sharp bright lower edge, long tail fading upwards. The tail grows
    // with the spectrum, bass, and beats so the sky visibly pumps.
    float d = uv.y - path;
    float tail = 0.09 + spec * ar * 0.12 + bassLift * 0.05 + uBeat * 0.03;
    float below = exp(-max(d, 0.0) * (55.0 - i * 8.0));
    float above = exp(-max(-d, 0.0) / tail);
    float profile = d > 0.0 ? below : above;

    // Vertical rays with a fast shimmer running along the curtain.
    float rays = fbm3(vec2(uv.x * 46.0 * uScale + drift * 8.0 + seed, uv.y * 1.2));
    rays = smoothstep(0.3, 0.8, rays);
    float shimmer = 0.5 + 0.5 * sin(uv.x * 140.0 + time * 5.0 + seed + uTreble * ar * 6.0);
    float rayMask = mix(0.18, 1.0, rays) * mix(0.6, 1.0, shimmer);

    float strength = profile * rayMask
      * (0.5 + spec * ar * 0.9 + uMid * ar * 0.3 + uBeat * 0.3);
    strength *= 1.0 - i * 0.18;

    // Colour: bottom edge colour1, colour2 through the body, colour3 at the top.
    float h = clamp(-d / (tail * 2.2), 0.0, 1.0);
    vec3 c = mix(uColor1, uColor2, smoothstep(0.0, 0.28, h));
    c = mix(c, uColor3, smoothstep(0.14, 0.5, h));
    light += c * strength;
  }
  return light;
}

void main() {
  vec2 uv = vTextureCoord;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float ar = uAudioReactivity;
  float time = uTime * uSpeed;
  float horizon = 0.74;

  // Night sky gradient.
  vec3 skyTop = uColor2 * 0.06 + vec3(0.005, 0.008, 0.02);
  vec3 skyHorizon = mix(uColor2, uColor3, 0.6) * 0.11;
  vec3 color = mix(skyTop, skyHorizon, smoothstep(0.1, horizon, uv.y));

  // Two star layers; treble makes them sparkle.
  for (float i = 0.0; i < 2.0; i++) {
    vec2 su = vec2(uv.x * aspect, uv.y) * (70.0 + i * 55.0);
    vec2 cell = floor(su);
    vec2 f = fract(su) - 0.5;
    float seed = hash21(cell + i * 13.0);
    vec2 off = (hash22(cell + i * 13.0) - 0.5) * 0.7;
    float star = smoothstep(0.10 - i * 0.03, 0.0, length(f - off));
    star *= step(0.94, seed);
    star *= 0.55 + 0.45 * sin(time * 2.0 + seed * 60.0);
    star *= smoothstep(horizon, horizon - 0.15, uv.y);
    color += vec3(0.75, 0.85, 1.0) * star * (0.6 + uTreble * ar * 1.6);
  }

  // A shooting star streaks across the sky every few seconds.
  {
    float period = 7.0;
    float k = floor(time / period);
    float ph = fract(time / period);
    vec2 start = vec2(0.1 + hash11(k + 3.7) * 0.6, 0.06 + hash11(k + 9.1) * 0.25);
    vec2 dir = normalize(vec2(0.55, 0.3));
    vec2 head = start + dir * ph * 2.4;
    vec2 rel = uv - head;
    float along = dot(rel, -dir);
    float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
    float streak = smoothstep(0.0025, 0.0, perp) * smoothstep(0.14, 0.0, along) * step(0.0, along);
    float active = smoothstep(0.0, 0.02, ph) * (1.0 - smoothstep(0.16, 0.2, ph));
    color += vec3(0.9, 0.95, 1.0) * streak * active * 1.2;
  }

  // Small moon with a soft halo, top right.
  vec2 moonPos = vec2(0.8, 0.2);
  float md = length((uv - moonPos) * vec2(aspect, 1.0));
  color += vec3(0.9, 0.95, 1.0) * smoothstep(0.03, 0.026, md) * 0.55;
  color += vec3(0.6, 0.7, 1.0) * exp(-md * 22.0) * 0.18;

  // Mountain silhouette along the horizon.
  float mountain = horizon - 0.035
    - valueNoise(vec2(uv.x * 5.5 + 3.0, 0.0)) * 0.07
    - valueNoise(vec2(uv.x * 14.0, 2.0)) * 0.025;
  vec3 mountainColor = vec3(0.01, 0.015, 0.03) + uColor2 * 0.03;

  if (uv.y < horizon) {
    color += auroraLight(uv, time, ar) * uIntensity;
    float mtn = smoothstep(mountain - 0.004, mountain + 0.004, uv.y);
    color = mix(color, mountainColor, mtn);
  } else {
    // Frozen lake: the sky reflected with a bass-driven ripple.
    float depth = (uv.y - horizon) / (1.0 - horizon);
    float ripple = (valueNoise(vec2(uv.x * 40.0, uv.y * 120.0 - time * 2.0)) - 0.5)
      * 0.012 * (1.0 + uBass * ar);
    vec2 ruv = vec2(uv.x + ripple, 2.0 * horizon - uv.y + ripple * 2.0);
    vec3 reflected = skyHorizon + auroraLight(ruv, time, ar) * uIntensity;
    float mtnR = smoothstep(mountain - 0.004, mountain + 0.004, ruv.y);
    reflected = mix(reflected, mountainColor, mtnR);
    vec3 ground = mix(skyHorizon * 0.5, vec3(0.0), depth);
    float fade = (1.0 - depth * 0.8) * 0.5;
    color = ground + reflected * fade;
  }

  // Thin bright line where the lake meets the sky.
  color += mix(uColor1, uColor2, 0.5) * exp(-abs(uv.y - horizon) * 90.0) * (0.22 + uBass * ar * 0.25);

  // Overall loudness lift, soft tone mapping so loud tracks never blow out,
  // and a gentle vignette.
  color *= 0.92 + uRms * ar * 0.2;
  color = color / (1.0 + color * 0.4);
  float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.2;
  color *= smoothstep(0.0, 0.9, vig);

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
