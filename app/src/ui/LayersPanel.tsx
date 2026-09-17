import React from 'react';
import { useProjectStore } from '../state/projectStore';
import { useSelectionStore } from '../state/selectionStore';
import {
  createLayerId, staticParam, defaultTransform,
  type LayerAny, type RadialSpectrumLayerConfig,
  type RadialWaveformLayerConfig, type BottomSpectrumLayerConfig,
  type BackgroundLayerConfig, type LogoLayerConfig,
  type ShaderLayerConfig, type ShaderType,
  type HDBarsReflectionLayerConfig, type HDSonicSpikesLayerConfig,
  type HDCircularSpectrumLayerConfig, type ParticleFieldLayerConfig,
  type OscilloscopeLayerConfig, type TextLayerConfig,
  type DotSphereEqualizerLayerConfig, type LyricsLayerConfig,
  type SpectrogramLayerConfig,
} from '../types/project';
import { createLogoSpectrumLayer } from '../layers/logoSpectrumDefaults';

const LAYER_ICONS: Record<string, string> = {
  background: '\u2588',
  logo: '\u2726',
  radialSpectrum: '\u25CE',
  radialWaveform: '\u25EF',
  bottomSpectrum: '\u2581',
  shader: '\u2604',
  hdRainbowBarsReflection: '\u258A',
  hdSonicWaveSpikes: '\u2261',
  hdCircularSpectrum: '\u29BF',
  particleField: '\u2729',
  oscilloscope: '\u223F',
  dotSphereEqualizer: '\u25CF',
  text: 'T',
  lyrics: '\u266B',
  spectrogram: '\u2571',
};

interface LayersPanelProps {
  onCollapse?: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ onCollapse }) => {
  const { project, addLayer, removeLayer, reorderLayers, toggleLayerEnabled, updateProjectField } = useProjectStore();
  const { selectedLayerId, selectLayer } = useSelectionStore();
  const layers = project.layers;
  const displayedLayers = [...layers].reverse();
  const [draggedLayerId, setDraggedLayerId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    layerId: string;
    position: 'before' | 'after';
  } | null>(null);

  const clearDragState = () => {
    setDraggedLayerId(null);
    setDropTarget(null);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, layerId: string) => {
    setDraggedLayerId(layerId);
    setDropTarget(null);
    selectLayer(layerId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', layerId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, layerId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!draggedLayerId || draggedLayerId === layerId) {
      setDropTarget(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget((current) => (
      current?.layerId === layerId && current.position === position
        ? current
        : { layerId, position }
    ));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = draggedLayerId || event.dataTransfer.getData('text/plain');
    if (!sourceId || !dropTarget || sourceId === dropTarget.layerId) {
      clearDragState();
      return;
    }

    // The renderer stores layers back-to-front, while the panel presents the
    // familiar editor convention of frontmost at the top.
    const nextDisplayOrder = displayedLayers.filter((layer) => layer.id !== sourceId);
    const targetIndex = nextDisplayOrder.findIndex((layer) => layer.id === dropTarget.layerId);
    if (targetIndex < 0) {
      clearDragState();
      return;
    }
    const insertAt = targetIndex + (dropTarget.position === 'after' ? 1 : 0);
    const sourceLayer = layers.find((layer) => layer.id === sourceId);
    if (!sourceLayer) {
      clearDragState();
      return;
    }
    nextDisplayOrder.splice(insertAt, 0, sourceLayer);
    const nextInternalOrder = [...nextDisplayOrder].reverse();
    const fromIndex = layers.findIndex((layer) => layer.id === sourceId);
    const toIndex = nextInternalOrder.findIndex((layer) => layer.id === sourceId);
    reorderLayers(fromIndex, toIndex);
    clearDragState();
  };

  const handleAddLayer = (kind: string) => {
    let layer: LayerAny;
    switch (kind) {
      case 'background': layer = createBackgroundLayer(); break;
      case 'logo': layer = createLogoLayer(); break;
      case 'radialSpectrum': layer = createRadialSpectrumLayer(); break;
      case 'radialWaveform': layer = createRadialWaveformLayer(); break;
      case 'bottomSpectrum': layer = createBottomSpectrumLayer(); break;
      case 'particleField': layer = createParticleFieldLayer(); break;
      case 'oscilloscope': layer = createOscilloscopeLayer(); break;
      case 'text': layer = createTextLayer(); break;
      case 'lyrics': layer = createLyricsLayer(); break;
      case 'spectrogram': layer = createSpectrogramLayer(); break;
      case 'logoSpectrum': layer = createLogoSpectrumLayer(); break;
      case 'shader-tunnel': layer = createShaderLayer('tunnel', 'Tunnel'); break;
      case 'shader-plasma': layer = createShaderLayer('plasma', 'Plasma'); break;
      case 'shader-starfield': layer = createShaderLayer('starfield', 'Starfield'); break;
      case 'shader-vortex': layer = createShaderLayer('vortex', 'Vortex'); break;
      case 'shader-fractalNoise': layer = createShaderLayer('fractalNoise', 'Fractal Noise'); break;
      case 'shader-pulseRings': layer = createShaderLayer('pulseRings', 'Pulse Rings'); break;
      case 'shader-psychedelic': layer = createShaderLayer('psychedelic', 'Psychedelic'); break;
      case 'shader-retroGrid': layer = createShaderLayer('retroGrid', 'Retro Grid'); break;
      case 'shader-aurora': layer = createShaderLayer('aurora', 'Aurora'); break;
      case 'shader-nebula': layer = createShaderLayer('nebula', 'Nebula'); break;
      case 'shader-geometric': layer = createShaderLayer('geometric', 'Geometric'); break;
      case 'shader-liquid': layer = createShaderLayer('liquid', 'Liquid'); break;
      case 'shader-meshWave': layer = createShaderLayer('meshWave', 'Neon Mesh Wave'); break;
      case 'shader-kaleidoReactor': layer = createShaderLayer('kaleidoReactor', 'Kaleido Reactor'); break;
      default: return;
    }
    if (kind === 'logoSpectrum') {
      const logoIndex = project.layers.findIndex((item) => item.kind === 'logo');
      const insertAt = logoIndex >= 0 ? logoIndex : project.layers.length;
      const nextLayers = [...project.layers];
      nextLayers.splice(insertAt, 0, layer);
      updateProjectField('layers', nextLayers);
    } else {
      addLayer(layer);
    }
    selectLayer(layer.id);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        {onCollapse && (
          <button
            className="ghost"
            onClick={onCollapse}
            style={{ fontSize: 13, padding: '2px 4px', lineHeight: 1 }}
            title="Collapse panel"
          >
            &#x25C0;
          </button>
        )}
        <span style={styles.title}>Layers</span>
        <select
          onChange={(e) => { if (e.target.value) handleAddLayer(e.target.value); e.target.value = ''; }}
          value=""
          style={styles.addSelect}
        >
          <option value="">+ Add</option>
          <optgroup label="Assets">
            <option value="background">Background</option>
            <option value="logo">Logo</option>
          </optgroup>
          <optgroup label="Build a Visualizer">
            <option value="radialSpectrum">Radial Spectrum</option>
            <option value="radialWaveform">Radial Waveform</option>
            <option value="bottomSpectrum">Bottom Spectrum</option>
            <option value="particleField">Particle Field</option>
            <option value="oscilloscope">Oscilloscope</option>
            <option value="logoSpectrum">Logo Spectrum Halo</option>
          </optgroup>
          <optgroup label="Typography">
            <option value="text">Text</option>
            <option value="lyrics">Lyrics (LRC)</option>
          </optgroup>
          <optgroup label="Analysis">
            <option value="spectrogram">Spectrogram (Waterfall)</option>
          </optgroup>
          <optgroup label="Motion Backgrounds">
            <option value="shader-starfield">Starfield</option>
            <option value="shader-vortex">Vortex</option>
            <option value="shader-fractalNoise">Fractal Noise</option>
            <option value="shader-psychedelic">Psychedelic</option>
            <option value="shader-retroGrid">Retro Grid</option>
            <option value="shader-aurora">Aurora</option>
            <option value="shader-nebula">Nebula</option>
            <option value="shader-liquid">Liquid</option>
            <option value="shader-meshWave">Neon Mesh Wave</option>
            <option value="shader-kaleidoReactor">Kaleido Reactor</option>
          </optgroup>
        </select>
      </div>

      <div style={styles.list} className="scrollable">
        {layers.length > 1 && (
          <div style={styles.stackHint}>
            <span>Front</span>
            <span>Drag to reorder</span>
          </div>
        )}
        {displayedLayers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          const isDragging = draggedLayerId === layer.id;
          const dropBefore = dropTarget?.layerId === layer.id && dropTarget.position === 'before';
          const dropAfter = dropTarget?.layerId === layer.id && dropTarget.position === 'after';
          return (
            <div
              key={layer.id}
              draggable
              aria-grabbed={isDragging}
              title="Drag to change layer order"
              style={{
                ...styles.layerItem,
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                borderTop: dropBefore ? '2px solid var(--accent-bright)' : '2px solid transparent',
                borderBottom: dropAfter ? '2px solid var(--accent-bright)' : '1px solid var(--border)',
                opacity: isDragging ? 0.45 : 1,
              }}
              onClick={() => selectLayer(layer.id)}
              onDragStart={(event) => handleDragStart(event, layer.id)}
              onDragOver={(event) => handleDragOver(event, layer.id)}
              onDrop={handleDrop}
              onDragEnd={clearDragState}
            >
              <div style={styles.dragHandle} aria-hidden="true">&#x22EE;&#x22EE;</div>
              <button
                className="ghost"
                style={{
                  ...styles.visToggle,
                  color: layer.enabled ? 'var(--accent-bright)' : 'var(--text-dim)',
                }}
                onClick={(e) => { e.stopPropagation(); toggleLayerEnabled(layer.id); }}
              >
                {layer.enabled ? '\u25C9' : '\u25CB'}
              </button>
              <div style={styles.layerIcon}>
                {LAYER_ICONS[layer.kind] || '\u25A0'}
              </div>
              <div style={styles.layerInfo}>
                <span style={styles.layerName}>{layer.name}</span>
                <span style={styles.layerKind}>{formatKind(layer.kind)}</span>
              </div>
              <button
                className="ghost danger"
                style={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
              >
                &times;
              </button>
            </div>
          );
        })}

        {layers.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>&plus;</div>
            <div>No layers yet</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-dim)' }}>
              Add a layer to get started
            </div>
          </div>
        )}
        {layers.length > 1 && <div style={styles.backLabel}>Back</div>}
      </div>
    </div>
  );
};

function formatKind(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').trim();
}

// --- Layer factory functions ---

function createBackgroundLayer(): BackgroundLayerConfig {
  return {
    id: createLayerId(), name: 'Background', kind: 'background', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    assetId: '', fit: 'cover', darkness: staticParam(0),
  };
}

function createLogoLayer(): LogoLayerConfig {
  return {
    id: createLayerId(), name: 'Logo', kind: 'logo', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    assetId: '', anchor: 'center',
    frameShape: 'circle',
    cornerRadius: staticParam(30),
    fitMode: 'cover',
    autoFitOnImport: true,
    frameSize: staticParam(375),
    padding: staticParam(8),
    border: {
      enabled: true,
      width: staticParam(20),
      color: staticParam('#8b7cff'),
      glow: true,
    },
    _refitSeq: 0,
  };
}

function createRadialSpectrumLayer(): RadialSpectrumLayerConfig {
  return {
    id: createLayerId(), name: 'Radial Spectrum', kind: 'radialSpectrum', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    centerX: staticParam(0), centerY: staticParam(0),
    radius: staticParam(150), thickness: staticParam(4), barCount: staticParam(72), barGap: staticParam(1),
    gain: staticParam(1.5),
    smoothing: { attack: staticParam(0.35), release: staticParam(0.08) },
    compressionPow: staticParam(0.6),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.95) },
    color: { mode: 'solid', solid: staticParam('#6c5ce7') },
    noiseJitter: staticParam(0.03),
  };
}

function createRadialWaveformLayer(): RadialWaveformLayerConfig {
  return {
    id: createLayerId(), name: 'Radial Waveform', kind: 'radialWaveform', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    centerX: staticParam(0), centerY: staticParam(0),
    radius: staticParam(130), amplitude: staticParam(100), lineWidth: staticParam(2),
    smoothing: { attack: staticParam(0.3), release: staticParam(0.06) },
    color: staticParam('#a29bfe'),
    liquidMotion: true, liquidAmount: staticParam(0.75), liquidSpeed: staticParam(1.25),
  };
}

function createBottomSpectrumLayer(): BottomSpectrumLayerConfig {
  return {
    id: createLayerId(), name: 'Bottom Spectrum', kind: 'bottomSpectrum', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    barX: staticParam(0), barY: staticParam(0), barWidth: staticParam(0), barHeight: staticParam(0),
    barCount: staticParam(64), gain: staticParam(1.5),
    smoothing: { attack: staticParam(0.35), release: staticParam(0.08) },
    color: staticParam('#00cec9'),
    liquidMotion: true, liquidAmount: staticParam(0.45), liquidSpeed: staticParam(0.85),
  };
}

const SHADER_DEFAULTS: Partial<Record<ShaderType, Partial<ShaderLayerConfig>>> = {
  vortex: {
    speed: staticParam(3.05), scale: staticParam(1.35), audioReactivity: staticParam(1.15),
    color1: staticParam('#0033ff'), color2: staticParam('#ff0000'), color3: staticParam('#302c2c'),
    feedbackEnabled: true, feedbackAmount: staticParam(0.28), feedbackZoom: staticParam(1), feedbackRotate: staticParam(0.01),
  },
  fractalNoise: {
    speed: staticParam(1.7), intensity: staticParam(0.45), scale: staticParam(1.05), audioReactivity: staticParam(1.55),
    color1: staticParam('#000000'), color2: staticParam('#000000'), color3: staticParam('#f00505'),
  },
  liquid: {
    intensity: staticParam(0.60), audioReactivity: staticParam(2.15),
    color1: staticParam('#ff0000'), color2: staticParam('#00ffff'), color3: staticParam('#100e0e'),
  },
};

function createShaderLayer(shaderType: ShaderType, name: string): ShaderLayerConfig {
  return {
    id: createLayerId(), name, kind: 'shader', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    shaderType,
    speed: staticParam(1),
    intensity: staticParam(1),
    scale: staticParam(1),
    color1: staticParam('#ff00ff'),
    color2: staticParam('#00ffff'),
    color3: staticParam('#ffffff'),
    audioReactivity: staticParam(1),
    feedbackEnabled: false,
    feedbackAmount: staticParam(0.5),
    feedbackZoom: staticParam(1.0),
    feedbackRotate: staticParam(0),
    distortionStrength: staticParam(1.0),
    flowSpeed: staticParam(0.5),
    viscosity: staticParam(0.72),
    ...SHADER_DEFAULTS[shaderType],
  };
}

function createHDBarsReflectionLayer(): HDBarsReflectionLayerConfig {
  return {
    id: createLayerId(), name: 'HD Rainbow Bars', kind: 'hdRainbowBarsReflection', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    barCount: staticParam(79),
    gain: staticParam(0.68),
    attack: staticParam(0.35),
    release: staticParam(0.06),
    compressionPow: staticParam(1.20),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.92), showCaps: staticParam(true) },
    glowStrength: staticParam(3.00),
    reflectionEnabled: staticParam(true),
    reflectionOpacity: staticParam(0.56),
    reflectionBlur: staticParam(20),
    reflectionFade: staticParam(1.55),
    gamma: staticParam(1.40),
    contrast: staticParam(1.11),
    baselineY: staticParam(0.55),
    heightScale: staticParam(0.4),
  };
}

function createHDSonicSpikesLayer(): HDSonicSpikesLayerConfig {
  return {
    id: createLayerId(), name: 'HD Sonic Spikes', kind: 'hdSonicWaveSpikes', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    barCount: staticParam(192),
    gain: staticParam(0.69),
    attack: staticParam(0.35),
    release: staticParam(0.06),
    compressionPow: staticParam(1.20),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.96) },
    glowStrength: staticParam(3.00),
    mirror: staticParam(true),
    lineThickness: staticParam(9),
    gamma: staticParam(1.40),
    contrast: staticParam(0.70),
    spikeScale: staticParam(0.76),
    transientBoost: staticParam(0.16),
  };
}

function createHDCircularSpectrumLayer(): HDCircularSpectrumLayerConfig {
  return {
    id: createLayerId(), name: 'HD Circular Spectrum', kind: 'hdCircularSpectrum', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    barCount: staticParam(128), gain: staticParam(0.69), attack: staticParam(0.43), release: staticParam(0.05),
    compressionPow: staticParam(1.20), innerRadius: staticParam(83), barMaxHeight: staticParam(199),
    barWidthRatio: staticParam(1.00),
    peakHold: { enabled: staticParam(true), decay: staticParam(0.93), showCaps: staticParam(true) },
    colorMode: 'rainbow', solidColor: staticParam('#6c5ce7'),
    gradientColor1: staticParam('#ff00ff'), gradientColor2: staticParam('#00ffff'),
    glowStrength: staticParam(3.00),
    reflectionEnabled: staticParam(true), reflectionOpacity: staticParam(0.2), reflectionFade: staticParam(2.0),
    innerRing: { enabled: staticParam(true), width: staticParam(2), color: staticParam('#ffffff'), glowEnabled: staticParam(true) },
    outerRing: { enabled: staticParam(false), width: staticParam(2), color: staticParam('#ffffff'), glowEnabled: staticParam(false) },
    gamma: staticParam(1.40), contrast: staticParam(1.78), rotationSpeed: staticParam(0.10),
    liquidMotion: true, liquidAmount: staticParam(0.65), liquidSpeed: staticParam(1.15),
  };
}

function createParticleFieldLayer(): ParticleFieldLayerConfig {
  return {
    id: createLayerId(), name: 'Particle Field', kind: 'particleField', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    maxParticles: staticParam(500), spawnRate: staticParam(30), baseSpeed: staticParam(60),
    baseSize: staticParam(3), sizeVariation: staticParam(0.5), lifetime: staticParam(4),
    pattern: 'radial', gravityY: staticParam(0),
    colorMode: 'rainbow', solidColor: staticParam('#6c5ce7'),
    gradientColor1: staticParam('#ff00ff'), gradientColor2: staticParam('#00ffff'),
    audioSpawnBoost: staticParam(1), audioSpeedBoost: staticParam(0.5), audioSizeBoost: staticParam(0.5),
    trailLength: staticParam(0), glowEnabled: staticParam(true), glowStrength: staticParam(1),
    burstOnBeat: staticParam(true), burstThreshold: staticParam(0.6), burstCount: staticParam(20),
  };
}

function createOscilloscopeLayer(): OscilloscopeLayerConfig {
  return {
    id: createLayerId(), name: 'Oscilloscope', kind: 'oscilloscope', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    mode: 'horizontal', lineWidth: staticParam(3), gain: staticParam(1.5), smoothing: staticParam(0.3),
    sampleCount: staticParam(256), color: staticParam('#00cec9'),
    glowEnabled: staticParam(true), glowStrength: staticParam(1.2), glowColor: staticParam('#00cec9'),
    fillEnabled: staticParam(false), fillOpacity: staticParam(0.15),
    mirrorY: staticParam(0.5), circularRadius: staticParam(150), circularAmplitude: staticParam(80),
    lineGradient: { enabled: staticParam(false), color1: staticParam('#ff00ff'), color2: staticParam('#00ffff') },
    gamma: staticParam(1), stereoSpread: staticParam(0), scanlineEffect: staticParam(false),
    liquidMotion: true, liquidAmount: staticParam(0.55), liquidSpeed: staticParam(1.4),
  };
}

function createTextLayer(): TextLayerConfig {
  return {
    id: createLayerId(), name: 'Text', kind: 'text', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    text: 'PULSE', fontFamily: 'Arial', fontSize: staticParam(64), fontWeight: 'bold',
    color: staticParam('#ffffff'), textAlign: 'center',
    positionX: staticParam(0.5), positionY: staticParam(0.5),
    glowEnabled: staticParam(true), glowStrength: staticParam(1), glowColor: staticParam('#6c5ce7'),
    audioPulseAmount: staticParam(0.3), audioShakeAmount: staticParam(0),
    scrollEnabled: staticParam(false), scrollSpeed: staticParam(2),
    letterSpacing: staticParam(0), strokeEnabled: staticParam(false),
    strokeColor: staticParam('#000000'), strokeWidth: staticParam(2),
  };
}

function createLyricsLayer(): LyricsLayerConfig {
  return {
    id: createLayerId(), name: 'Lyrics', kind: 'lyrics', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(), effects: [],
    lrcContent: '',
    timingOffsetSec: staticParam(0), timingScale: staticParam(1),
    fontFamily: 'Arial', fontSize: staticParam(40), fontWeight: 'bold',
    color: staticParam('#ffffff'), textAlign: 'center',
    positionX: staticParam(0.5), positionY: staticParam(0.82),
    showNextLine: true, nextLineOpacity: 0.15,
    glowEnabled: staticParam(true), glowStrength: staticParam(1.2), glowColor: staticParam('#6c5ce7'),
    audioPulseAmount: staticParam(0.15),
    strokeEnabled: staticParam(true), strokeColor: staticParam('#000000'), strokeWidth: staticParam(3),
  };
}

function createSpectrogramLayer(): SpectrogramLayerConfig {
  return {
    id: createLayerId(), name: 'Spectrogram', kind: 'spectrogram', enabled: true,
    opacity: staticParam(0.9), blendMode: 'normal', transform: defaultTransform(), effects: [],
    colorScheme: 'heat',
    gain: staticParam(1.5),
    logScale: false,
    beatMarker: true,
    heightFraction: staticParam(0.25),
    positionY: staticParam(1.0),
  };
}

function createDotSphereEqualizerLayer(): DotSphereEqualizerLayerConfig {
  return {
    id: createLayerId(), name: 'Dot Sphere Equalizer', kind: 'dotSphereEqualizer', enabled: true,
    opacity: staticParam(1), blendMode: 'add', transform: defaultTransform(), effects: [],
    columns: staticParam(92),
    dotsPerColumn: staticParam(32),
    baseRadius: staticParam(3.6),
    sphereSize: staticParam(0.40),
    mirrorEnabled: staticParam(true),
    gain: staticParam(0.80),
    attack: staticParam(0.70),
    release: staticParam(0.30),
    peakHoldEnabled: staticParam(true),
    peakHoldDecay: staticParam(0.96),
    gradientPreset: 'rainbow',
    glowEnabled: staticParam(true),
    glowStrength: staticParam(3.00),
    textEnabled: staticParam(true),
    textString: 'SOUNDWAVE',
  };
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 240,
    minWidth: 220,
    background: 'var(--bg-panel)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--text-muted)',
  },
  addSelect: {
    fontSize: 11,
    padding: '4px 22px 4px 8px',
    minWidth: 80,
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--accent-bright)',
    fontWeight: 600,
  },
  list: {
    flex: 1,
    overflow: 'auto',
  },
  stackHint: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    color: 'var(--text-dim)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
  },
  layerItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px 6px 0',
    cursor: 'grab',
    gap: 6,
    transition: 'background 0.1s, opacity 0.1s, border-color 0.1s',
    userSelect: 'none',
  },
  dragHandle: {
    width: 10,
    color: 'var(--text-dim)',
    fontSize: 12,
    lineHeight: 0.55,
    letterSpacing: -3,
    flexShrink: 0,
  },
  visToggle: {
    padding: '2px 4px',
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
    border: 'none',
  },
  layerIcon: {
    fontSize: 14,
    color: 'var(--text-muted)',
    width: 20,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  layerInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  layerName: {
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--text-primary)',
  },
  layerKind: {
    fontSize: 10,
    color: 'var(--text-dim)',
    textTransform: 'capitalize' as const,
  },
  deleteBtn: {
    padding: '2px 6px',
    fontSize: 14,
    flexShrink: 0,
    lineHeight: 1,
    border: 'none',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  emptyIcon: {
    fontSize: 28,
    color: 'var(--text-dim)',
    marginBottom: 8,
  },
  backLabel: {
    padding: '6px 10px',
    color: 'var(--text-dim)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
