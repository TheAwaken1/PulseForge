import React, { useRef, useState } from 'react';
import { ALL_PRESETS } from '../presets/templates';
import { PresetManager } from '../presets/PresetManager';
import { importAudioFile, importVisualFile } from '../utils/audioImport';
import { useProjectStore } from '../state/projectStore';
import { useSelectionStore } from '../state/selectionStore';
import { useTransportStore } from '../state/transportStore';
import {
  createLayerId,
  createEffectId,
  createDefaultProject,
  defaultTransform,
  staticParam,
  type BackgroundLayerConfig,
  type ColorGradeEffectConfig,
  type LogoLayerConfig,
  type ShakeEffectConfig,
  type VignetteEffectConfig,
} from '../types/project';
import { PresetArtwork } from './PresetArtwork';
import {
  createLogoMatchedPulse,
  createLogoMatchedShake,
  createLogoSpectrumLayer,
} from '../layers/logoSpectrumDefaults';

type Step = 'home' | 'background' | 'logo' | 'audio' | 'ready' | 'presets';
type AssetRole = 'background' | 'logo';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const FLOW_STEPS: Array<{ key: Step; label: string }> = [
  { key: 'background', label: 'Background' },
  { key: 'logo', label: 'Logo' },
  { key: 'audio', label: 'Audio' },
];

export const WelcomeOverlay: React.FC<Props> = ({ visible, onDismiss }) => {
  const [step, setStep] = useState<Step>('home');
  const [dragRole, setDragRole] = useState<AssetRole | 'audio' | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [audioName, setAudioName] = useState('');
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const quickAudioInputRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  const resetFlow = () => {
    setStep('home');
    setDragRole(null);
    setBackgroundPreview('');
    setLogoPreview('');
    setAudioName('');
  };

  const beginBrandFlow = () => {
    const store = useProjectStore.getState();
    if (
      (store.project.layers.length > 0 || store.project.assets.length > 0) &&
      !confirm('Quick Create starts a new visualizer. Replace the current canvas?')
    ) return;

    const transport = useTransportStore.getState();
    transport.pause();
    transport.seek(0);
    transport.setDuration(0);
    store.setProject(createDefaultProject());
    useSelectionStore.getState().clearSelection();
    resetFlow();
    setStep('background');
  };

  const assignImage = (role: AssetRole, file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    const asset = importVisualFile(file);
    const store = useProjectStore.getState();
    const layers = store.project.layers.filter((layer) => (
      layer.kind !== role && (role !== 'logo' || layer.name !== 'Logo Spectrum Halo')
    ));
    const roleLayer = role === 'background'
      ? createBackgroundLayer(asset.id)
      : createLogoLayer(asset.id);
    const nextLayers = role === 'background'
      ? [roleLayer, ...layers]
      : [...layers, createLogoSpectrumLayer(), roleLayer];
    store.updateProjectField('layers', nextLayers);
    useSelectionStore.getState().selectLayer(roleLayer.id);

    if (role === 'background') {
      setBackgroundPreview(asset.relPath);
      setStep('logo');
    } else {
      setLogoPreview(asset.relPath);
      setStep('audio');
    }
  };

  const assignAudio = async (file: File, quick = false) => {
    if (!file.type.startsWith('audio/')) return;
    await importAudioFile(file);
    setAudioName(file.name);
    if (quick) onDismiss();
    else setStep('ready');
  };

  const choosePreset = (presetId: string) => {
    PresetManager.applyExclusive(presetId);
    onDismiss();
  };

  const dropHandlers = (role: AssetRole | 'audio') => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setDragRole(role);
    },
    onDragLeave: (event: React.DragEvent) => {
      event.preventDefault();
      setDragRole(null);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragRole(null);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      if (role === 'audio') void assignAudio(file);
      else assignImage(role, file);
    },
  });

  const flowIndex = FLOW_STEPS.findIndex((item) => item.key === step);

  return (
    <div className="welcome-shell">
      <div className="welcome-ambient welcome-ambient-one" />
      <div className="welcome-ambient welcome-ambient-two" />

      {step === 'home' ? (
        <div className="welcome-home">
          <header className="welcome-brand welcome-brand-hero">
            <div className="welcome-brand-mark">P</div>
            <div>
              <strong>PulseForge</strong>
              <span>Audio-reactive visuals. Unmistakably yours.</span>
            </div>
          </header>

          <div className="welcome-hero-copy">
            <span className="welcome-eyebrow">NEW CREATIVE WORKFLOW</span>
            <h1>Turn your brand into<br /><em>something that moves.</em></h1>
            <p>Add your artwork, logo and track. PulseForge builds the visualizer around you.</p>
          </div>

          <button className="welcome-feature-card" onClick={beginBrandFlow}>
            <div className="welcome-feature-art">
              <div className="welcome-demo-ring welcome-demo-ring-one" />
              <div className="welcome-demo-ring welcome-demo-ring-two" />
              <div className="welcome-demo-logo">YOUR<br />LOGO</div>
              <div className="welcome-demo-bars">
                {Array.from({ length: 24 }, (_, index) => <span key={index} style={{ height: `${18 + ((index * 23) % 72)}%` }} />)}
              </div>
            </div>
            <div className="welcome-feature-copy">
              <span className="welcome-feature-badge">GUIDED · 3 STEPS</span>
              <h2>Brand Visualizer</h2>
              <p>Add your background, logo, and track. We’ll handle placement and reactive polish.</p>
              <span className="welcome-feature-cta">Start creating <b>→</b></span>
            </div>
          </button>

          <div className="welcome-secondary-actions">
            <button onClick={() => quickAudioInputRef.current?.click()}>
              <span className="welcome-action-number">01</span>
              <span><b>Load audio</b><small>Start with an empty canvas</small></span>
            </button>
            <button onClick={() => setStep('presets')}>
              <span className="welcome-action-number">02</span>
              <span><b>Explore presets</b><small>Pick a ready-made motion style</small></span>
            </button>
            <button onClick={onDismiss}>
              <span className="welcome-action-number">03</span>
              <span><b>Advanced editor</b><small>Build freely with layers</small></span>
            </button>
          </div>
          <input ref={quickAudioInputRef} type="file" accept="audio/*" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void assignAudio(file, true);
            event.target.value = '';
          }} />
        </div>
      ) : step === 'presets' ? (
        <PresetBrowser onBack={() => setStep('home')} onChoose={choosePreset} />
      ) : (
        <div className="guided-shell">
          <header className="guided-header">
            <button className="guided-back" onClick={step === 'background' ? resetFlow : () => setStep(previousStep(step))}>←</button>
            <div className="welcome-brand guided-brand">
              <div className="welcome-brand-mark">P</div>
              <div><strong>Brand Visualizer</strong><span>Quick Create</span></div>
            </div>
            <button className="guided-exit" onClick={onDismiss}>Advanced editor</button>
          </header>

          <div className="guided-progress">
            {FLOW_STEPS.map((item, index) => {
              const completed = step === 'ready' || index < flowIndex;
              const active = item.key === step;
              return (
                <React.Fragment key={item.key}>
                  {index > 0 && <span className={`guided-progress-line${completed || active ? ' is-active' : ''}`} />}
                  <div className={`guided-progress-step${completed ? ' is-complete' : ''}${active ? ' is-active' : ''}`}>
                    <i>{completed ? '✓' : index + 1}</i><span>{item.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <main className="guided-main">
            <div className="guided-preview">
              <div className="guided-preview-stage" style={backgroundPreview ? { backgroundImage: `linear-gradient(rgba(5, 5, 12, .16), rgba(5, 5, 12, .42)), url(${backgroundPreview})` } : undefined}>
                <div className="guided-preview-glow" />
                <div className="guided-preview-ring guided-preview-ring-one" />
                <div className="guided-preview-ring guided-preview-ring-two" />
                {logoPreview ? <img src={logoPreview} alt="Logo preview" className="guided-preview-logo" /> : <div className="guided-preview-placeholder">PF</div>}
                <div className="guided-preview-bars">
                  {Array.from({ length: 34 }, (_, index) => <span key={index} style={{ height: `${14 + ((index * 29) % 78)}%` }} />)}
                </div>
                <span className="guided-live-pill"><i /> LIVE PREVIEW</span>
              </div>
            </div>

            <section className="guided-content">
              {step === 'background' && (
                <UploadStep
                  eyebrow="STEP 1 · SET THE SCENE"
                  title="Add your background"
                  body="Choose artwork that establishes the mood. A 16:9 image at 1920×1080 or larger works best."
                  accept="image/*,video/*"
                  active={dragRole === 'background'}
                  inputRef={backgroundInputRef}
                  dropHandlers={dropHandlers('background')}
                  onFile={(file) => assignImage('background', file)}
                  button="Choose background"
                  hint="JPG, PNG, GIF or short video · 16:9 recommended"
                />
              )}
              {step === 'logo' && (
                <UploadStep
                  eyebrow="STEP 2 · MAKE IT YOURS"
                  title="Now add your logo"
                  body="We’ll center and size it automatically. Transparent PNG, GIF or a short video all work."
                  accept="image/*,video/*"
                  active={dragRole === 'logo'}
                  inputRef={logoInputRef}
                  dropHandlers={dropHandlers('logo')}
                  onFile={(file) => assignImage('logo', file)}
                  button="Choose logo"
                  hint="PNG, GIF, WEBP or short video"
                />
              )}
              {step === 'audio' && (
                <UploadStep
                  eyebrow="STEP 3 · ADD THE PULSE"
                  title="Choose your soundtrack"
                  body="Your visualizer will react to the rhythm and energy of this track in real time."
                  accept="audio/*"
                  active={dragRole === 'audio'}
                  inputRef={audioInputRef}
                  dropHandlers={dropHandlers('audio')}
                  onFile={(file) => void assignAudio(file)}
                  button="Choose audio"
                  hint="MP3, WAV, OGG or FLAC"
                />
              )}
              {step === 'ready' && (
                <div className="guided-step-copy guided-ready">
                  <span className="guided-ready-check">✓</span>
                  <span className="welcome-eyebrow">YOUR VISUALIZER IS READY</span>
                  <h2>That already looks like you.</h2>
                  <p>{audioName} is ready with your branded background and logo. Fine-tune anything in the editor or press play and enjoy it.</p>
                  <button className="guided-primary" onClick={onDismiss}>Open my visualizer <b>→</b></button>
                  <button className="guided-text-button" onClick={() => setStep('audio')}>Change audio</button>
                </div>
              )}
            </section>
          </main>
        </div>
      )}
    </div>
  );
};

interface UploadStepProps {
  eyebrow: string;
  title: string;
  body: string;
  accept: string;
  active: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  dropHandlers: Pick<React.HTMLAttributes<HTMLDivElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>;
  onFile: (file: File) => void;
  button: string;
  hint: string;
}

const UploadStep: React.FC<UploadStepProps> = ({ eyebrow, title, body, accept, active, inputRef, dropHandlers, onFile, button, hint }) => (
  <div className="guided-step-copy">
    <span className="welcome-eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    <p>{body}</p>
    <div className={`guided-dropzone${active ? ' is-active' : ''}`} {...dropHandlers} onClick={() => inputRef.current?.click()}>
      <span className="guided-upload-icon">↑</span>
      <strong>Drop your file here</strong>
      <small>or click anywhere to browse</small>
      <button type="button" className="guided-primary">{button}</button>
      <em>{hint}</em>
    </div>
    <input ref={inputRef} type="file" accept={accept} hidden onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) onFile(file);
      event.target.value = '';
    }} />
  </div>
);

const PresetBrowser: React.FC<{ onBack: () => void; onChoose: (presetId: string) => void }> = ({ onBack, onChoose }) => (
  <div className="preset-browser">
    <header>
      <button className="guided-back" onClick={onBack}>←</button>
      <div><span className="welcome-eyebrow">MOTION COLLECTION</span><h2>Choose a visual world</h2><p>Every preset is a starting point. You can customize all of it.</p></div>
    </header>
    <div className="preset-browser-grid">
      {ALL_PRESETS.map((preset) => (
        <button key={preset.id} onClick={() => onChoose(preset.id)}>
          <PresetArtwork preset={preset} />
          <span><b>{preset.name}</b><small>{preset.description}</small></span>
        </button>
      ))}
    </div>
  </div>
);

function previousStep(step: Step): Step {
  if (step === 'logo') return 'background';
  if (step === 'audio') return 'logo';
  if (step === 'ready') return 'audio';
  return 'home';
}

function createBackgroundLayer(assetId: string): BackgroundLayerConfig {
  return {
    id: createLayerId(), name: 'Background', kind: 'background', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(),
    effects: [createBrandShakeEffect(5, 0.004, 8, 1.8), createBrandVignetteEffect()],
    assetId, fit: 'stretch', darkness: staticParam(0),
  };
}

function createLogoLayer(assetId: string): LogoLayerConfig {
  return {
    id: createLayerId(), name: 'Logo', kind: 'logo', enabled: true,
    opacity: staticParam(1), blendMode: 'normal', transform: defaultTransform(),
    effects: [
      createBrandColorGradeEffect(),
      createLogoMatchedShake(),
      createLogoMatchedPulse(),
    ],
    assetId, anchor: 'center', frameShape: 'circle', cornerRadius: staticParam(30),
    fitMode: 'cover', autoFitOnImport: true, frameSize: staticParam(375), padding: staticParam(8),
    border: { enabled: true, width: staticParam(20), color: staticParam('#1283ed'), glow: true },
    _refitSeq: 0,
  };
}

function createBrandShakeEffect(
  amountPx: number,
  amountRot: number,
  speed: number,
  audioAmount: number,
): ShakeEffectConfig {
  return {
    id: createEffectId(),
    name: 'Shake',
    kind: 'shake',
    enabled: true,
    amountPx: staticParam(amountPx),
    amountRot: staticParam(amountRot),
    speed: staticParam(speed),
    audioDriven: true,
    audioAmount: staticParam(audioAmount),
  };
}

function createBrandVignetteEffect(): VignetteEffectConfig {
  return {
    id: createEffectId(),
    name: 'Vignette',
    kind: 'vignette',
    enabled: true,
    strength: staticParam(0.85),
    radius: staticParam(0.5),
  };
}

function createBrandColorGradeEffect(): ColorGradeEffectConfig {
  return {
    id: createEffectId(),
    name: 'Color Grade',
    kind: 'colorGrade',
    enabled: true,
    hue: staticParam(0),
    saturation: staticParam(0.15),
    contrast: staticParam(0.58),
    brightness: staticParam(1.04),
    audioDriven: false,
    audioAmount: staticParam(90),
  };
}
