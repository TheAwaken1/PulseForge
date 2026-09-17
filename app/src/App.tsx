import React, { useEffect, useState } from 'react';
import { Toolbar } from './ui/Toolbar';
import { LayersPanel } from './ui/LayersPanel';
import { Preview } from './ui/Preview';
import { Inspector } from './ui/inspector';
import { Transport } from './ui/Transport';
import { WelcomeOverlay } from './ui/WelcomeOverlay';
import { LyricsPanel } from './ui/LyricsPanel';
import { PanelCollapseButton } from './ui/PanelCollapseButton';
import { startAutosave, stopAutosave } from './project/autosave';
import { initHistory } from './state/historyStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Dev-only: expose stores for debugging in the browser console.
if ((import.meta as any).env?.DEV && typeof window !== 'undefined') {
  import('./state/projectStore').then((m) => { (window as any).__pulseforge = { ...((window as any).__pulseforge || {}), project: m.useProjectStore }; });
  import('./state/transportStore').then((m) => { (window as any).__pulseforge = { ...((window as any).__pulseforge || {}), transport: m.useTransportStore }; });
}

const App: React.FC = () => {
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  useKeyboardShortcuts();

  useEffect(() => {
    initHistory();
    // Always start fresh — user picks audio or preset via the welcome screen.
    startAutosave();
    return () => { stopAutosave(); };
  }, []);

  return (
    <div style={styles.container}>
      <Toolbar onQuickCreate={() => setShowWelcome(true)} />
      <div style={styles.main}>
        <div style={{ ...styles.panelWrapper, width: layersPanelOpen ? 240 : 28 }}>
          {layersPanelOpen
            ? <LayersPanel onCollapse={() => setLayersPanelOpen(false)} />
            : <PanelCollapseButton side="left" label="Layers" onClick={() => setLayersPanelOpen(true)} />
          }
        </div>
        <div style={styles.centerColumn}>
          <Preview />
          <Transport />
          <LyricsPanel />
        </div>
        <div style={{ ...styles.panelWrapper, width: inspectorOpen ? 290 : 28 }}>
          {inspectorOpen
            ? <Inspector onCollapse={() => setInspectorOpen(false)} />
            : <PanelCollapseButton side="right" label="Inspector" onClick={() => setInspectorOpen(true)} />
          }
        </div>
      </div>
      {showWelcome && <WelcomeOverlay visible onDismiss={() => setShowWelcome(false)} />}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  panelWrapper: {
    transition: 'width 0.2s ease',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
  },
};

export default App;
