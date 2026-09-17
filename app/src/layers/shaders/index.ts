/**
 * Shader registry -- imports every fragment shader module and exposes
 * the same public API that the monolithic shaders.ts used to provide.
 */

import type { ShaderType } from '../../types/project';

export { DEFAULT_VERTEX, FILTER_VERTEX } from './common';

import { TUNNEL_FRAG } from './tunnel';
import { PLASMA_FRAG } from './plasma';
import { STARFIELD_FRAG } from './starfield';
import { VORTEX_FRAG } from './vortex';
import { FRACTAL_NOISE_FRAG } from './fractalNoise';
import { PULSE_RINGS_FRAG } from './pulseRings';
import { PSYCHEDELIC_FRAG } from './psychedelic';
import { RETRO_GRID_FRAG } from './retroGrid';
import { AURORA_FRAG } from './aurora';
import { NEBULA_FRAG } from './nebula';
import { GEOMETRIC_FRAG } from './geometric';
import { LIQUID_FRAG } from './liquid';
import { DISPLACEMENT_FRAG } from './displacement';
import { MESH_WAVE_FRAG } from './meshWave';
import { KALEIDO_REACTOR_FRAG } from './kaleidoReactor';

/* ------------------------------------------------------------------ */
/*  Shader registry                                                    */
/* ------------------------------------------------------------------ */

export const SHADER_FRAGMENTS: Record<ShaderType, string> = {
  tunnel: TUNNEL_FRAG,
  plasma: PLASMA_FRAG,
  starfield: STARFIELD_FRAG,
  vortex: VORTEX_FRAG,
  fractalNoise: FRACTAL_NOISE_FRAG,
  pulseRings: PULSE_RINGS_FRAG,
  psychedelic: PSYCHEDELIC_FRAG,
  retroGrid: RETRO_GRID_FRAG,
  aurora: AURORA_FRAG,
  nebula: NEBULA_FRAG,
  geometric: GEOMETRIC_FRAG,
  liquid: LIQUID_FRAG,
  displacement: DISPLACEMENT_FRAG,
  meshWave: MESH_WAVE_FRAG,
  kaleidoReactor: KALEIDO_REACTOR_FRAG,
};

export function getFragmentSource(type: ShaderType): string {
  const frag = SHADER_FRAGMENTS[type];
  if (!frag) throw new Error(`Unknown shader type: ${type}`);
  // Each fragment module already prepends the COMMON header,
  // so we return the string as-is.
  return frag;
}
