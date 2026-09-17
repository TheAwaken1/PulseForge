import React from 'react';
import type { ShaderLayerConfig, StaticParam } from '../types/project';
import type { PresetTemplate } from '../presets/templates';

interface Props {
  preset: PresetTemplate;
  compact?: boolean;
}

export const PresetArtwork: React.FC<Props> = ({ preset, compact = false }) => {
  const colors = extractPresetColors(preset);
  const bars = Array.from({ length: compact ? 14 : 20 }, (_, index) => index);

  return (
    <div
      className="preset-artwork"
      style={{
        background: [
          `radial-gradient(circle at 50% 48%, ${withAlpha(colors[1], 0.34)} 0%, transparent 27%)`,
          `linear-gradient(145deg, ${withAlpha(colors[0], 0.26)}, #07070d 48%, ${withAlpha(colors[2], 0.26)})`,
        ].join(', '),
      }}
    >
      <div className="preset-artwork-orbit preset-artwork-orbit-outer" style={{ borderColor: colors[0] }} />
      <div className="preset-artwork-orbit preset-artwork-orbit-inner" style={{ borderColor: colors[1] }} />
      <div className="preset-artwork-core" style={{ background: colors[2], boxShadow: `0 0 26px ${colors[2]}` }} />
      <div className="preset-artwork-bars">
        {bars.map((bar) => (
          <span
            key={bar}
            style={{
              height: `${22 + ((bar * 19) % 66)}%`,
              background: colors[bar % colors.length],
              animationDelay: `${bar * -0.07}s`,
            }}
          />
        ))}
      </div>
      <div className="preset-artwork-shine" />
    </div>
  );
};

export function extractPresetColors(preset: PresetTemplate): string[] {
  for (const layer of preset.layers) {
    if (layer.kind === 'shader') {
      const shader = layer as ShaderLayerConfig;
      return [
        (shader.color1 as StaticParam<string>).value,
        (shader.color2 as StaticParam<string>).value,
        (shader.color3 as StaticParam<string>).value,
      ];
    }
  }

  const fallback: string[] = [];
  for (const layer of preset.layers) {
    if (layer.kind === 'radialSpectrum' && fallback.length < 3) {
      const color = layer.color.solid;
      if (color.kind === 'static') fallback.push(color.value);
    }
    if (layer.kind === 'radialWaveform' && fallback.length < 3 && layer.color.kind === 'static') {
      fallback.push(layer.color.value);
    }
    if (layer.kind === 'bottomSpectrum' && fallback.length < 3 && layer.color.kind === 'static') {
      fallback.push(layer.color.value);
    }
  }
  while (fallback.length < 3) fallback.push(['#7868ff', '#29d9ff', '#ff4fd8'][fallback.length]);
  return fallback;
}

function withAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return color;
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
