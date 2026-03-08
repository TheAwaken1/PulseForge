import { COMMON } from './common';

/* ------------------------------------------------------------------ */
/*  Aurora -- layered sine curtains with fbm warp                       */
/* ------------------------------------------------------------------ */

export const AURORA_FRAG = COMMON + `
void main() {
  vec2 uv = vTextureCoord;
  float ar = uAudioReactivity;
  float time = uTime * uSpeed;

  // Sky gradient
  vec3 skyTop = uColor1 * 0.15;
  vec3 skyBot = uColor1 * 0.04;
  vec3 color = mix(skyBot, skyTop, uv.y);

  // Stars
  for (float i = 0.0; i < 3.0; i++) {
    vec2 sp = uv * (80.0 + i * 60.0) + vec2(i * 17.3, i * 31.7);
    float star = pow(hash21(floor(sp)), 20.0 + i * 10.0);
    star *= 0.5 + 0.5 * sin(time * 0.3 + hash21(floor(sp)) * TAU);
    star *= (1.0 + uTreble * ar * 2.0);
    color += vec3(star * 0.6);
  }

  // Aurora curtains (4 layers)
  float bassSway = uBass * ar * 0.3;
  for (float i = 0.0; i < 4.0; i++) {
    float freq = 1.5 + i * 0.7;
    float amp = 0.08 - i * 0.012;
    float phase = time * (0.15 + i * 0.08) + i * 1.2;

    // Warp the x coordinate with fbm for organic motion
    float warpedX = uv.x * uScale + fbm(vec2(uv.x * 2.0 + phase, i)) * 0.5 + bassSway;
    float wave = sin(warpedX * freq * PI + phase) * amp;
    wave += sin(warpedX * freq * 1.7 * PI + phase * 1.3) * amp * 0.5;

    // Vertical falloff — aurora lives in upper portion
    float curtainY = 0.55 + wave + i * 0.06;
    float falloff = exp(-pow((uv.y - curtainY) * 6.0, 2.0));
    falloff *= smoothstep(0.2, 0.5, uv.y); // fade near bottom

    // Color per layer
    float hue = fract(i * 0.25 + time * 0.02);
    vec3 layerColor = mix(uColor1, uColor2, hue);
    layerColor = mix(layerColor, uColor3, sin(hue * PI) * 0.4);

    // Audio: mid drives saturation boost
    float midBoost = 1.0 + uMid * ar * 1.5;
    color += layerColor * falloff * (0.35 + i * 0.05) * uIntensity * midBoost;
  }

  // Horizon glow
  float horizonGlow = exp(-pow((uv.y - 0.18) * 4.0, 2.0)) * 0.3;
  color += uColor2 * horizonGlow * (1.0 + uRms * ar);

  // Brightness from RMS
  color *= 0.9 + uRms * ar * 0.5;

  finalColor = vec4(applyFeedback(color), 1.0);
}
`;
