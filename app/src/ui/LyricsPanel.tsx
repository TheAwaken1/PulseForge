import React, { useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../state/projectStore';
import {
  staticParam, sampleParam, defaultTransform, createLayerId,
  type LyricsLayerConfig,
} from '../types/project';
import {
  prepareAudioForWhisper,
  transcribeViaOpenAI,
  chunksToLrc,
  WHISPER_MODELS,
  type TranscribeChunk,
} from '../utils/transcribe';
import { importLyricsText } from '../utils/lyricsText';
import { alignLyricsToTranscript } from '../utils/lyricsAlignment';

type TranscribeMode = 'local' | 'openai';

export const LyricsPanel: React.FC = () => {
  const { project, addLayer, updateLayer } = useProjectStore();
  const [collapsed, setCollapsed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const [mode, setMode] = useState<TranscribeMode>(
    () => (localStorage.getItem('pulseforge.transcribe.mode') as TranscribeMode) ?? 'local',
  );
  const [modelId, setModelId] = useState(
    () => localStorage.getItem('pulseforge.whisper.model') ?? WHISPER_MODELS[0].id,
  );
  const [useGPU, setUseGPU] = useState(
    () => localStorage.getItem('pulseforge.whisper.gpu') !== 'false',
  );
  const [openaiKey, setOpenaiKey] = useState(
    () => localStorage.getItem('pulseforge.openai.key') ?? '',
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const selectedModel = WHISPER_MODELS.find((m) => m.id === modelId) ?? WHISPER_MODELS[0];
  const audioAsset = project.assets.find((a) => a.id === project.audio.assetId);

  // Find first lyrics layer or null
  const lyricsLayer = project.layers.find((l) => l.kind === 'lyrics') as LyricsLayerConfig | undefined;
  const lineCount = lyricsLayer?.lrcContent
    ? lyricsLayer.lrcContent.split('\n').filter((l) => /\[\d/.test(l)).length
    : 0;
  const timingOffsetSec = lyricsLayer?.timingOffsetSec ? sampleParam(lyricsLayer.timingOffsetSec, 0) : 0;
  const timingScale = lyricsLayer?.timingScale ? sampleParam(lyricsLayer.timingScale, 0) : 1;

  const nudgeTiming = (offsetDelta: number, scaleDelta: number) => {
    if (!lyricsLayer) return;
    updateLayer(lyricsLayer.id, {
      timingOffsetSec: staticParam(Math.max(-15, Math.min(60, timingOffsetSec + offsetDelta))),
      timingScale: staticParam(Math.max(0.5, Math.min(2, timingScale + scaleDelta))),
    } as any);
  };

  // ── Ensure a lyrics layer exists, create one if not ────────────────
  const ensureLyricsLayer = useCallback((): string => {
    if (lyricsLayer) return lyricsLayer.id;
    const newLayer: LyricsLayerConfig = {
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
    addLayer(newLayer);
    return newLayer.id;
  }, [lyricsLayer, addLayer]);

  const setLrc = useCallback((lrc: string) => {
    const id = ensureLyricsLayer();
    updateLayer(id, { lrcContent: lrc } as any);
  }, [ensureLyricsLayer, updateLayer]);

  // ── LRC file upload ────────────────────────────────────────────────
  const handleLyricsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      try {
        const imported = importLyricsText(text, project.durationSec);
        setLrc(imported.lrc);
        if (imported.autoTimed) {
          setStatus(imported.usedSongDuration
            ? `Imported ${imported.lineCount} lines and timed them across the song.`
            : `Imported ${imported.lineCount} lines with estimated timing. Load audio first for song-length timing.`);
        } else {
          setStatus(`Imported ${imported.lineCount} timed lyric lines.`);
        }
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : 'Could not import lyrics.');
        setStatus('');
      }
    };
    reader.onerror = () => { setError('Could not read the lyrics file.'); setStatus(''); };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Local Whisper ──────────────────────────────────────────────────
  const handleSyncLyrics = useCallback(async () => {
    if (!audioAsset) { setError('Load the song before synchronizing lyrics.'); return; }
    if (!lyricsLayer?.lrcContent) { setError('Upload lyrics before synchronizing them.'); return; }
    setError(''); setBusy(true); setStatus('Preparing audio for lyric alignment…');

    let audio: Float32Array;
    try {
      audio = await prepareAudioForWhisper(audioAsset.relPath);
    } catch (syncError: any) {
      setError('Audio prep failed: ' + syncError.message); setBusy(false); setStatus(''); return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/whisper.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }

    const worker = workerRef.current;
    let segmentFallbackStarted = false;
    const postSyncRequest = (timestampMode: 'word' | 'segment') => {
      worker.postMessage({
        type: 'transcribe',
        audio,
        modelId: selectedModel.id,
        useGPU: useGPU && selectedModel.preferGPU,
        gpuDtype: selectedModel.gpuDtype,
        cpuDtype: selectedModel.cpuDtype,
        timestampMode,
      });
    };
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'status') {
        setStatus(message.message);
      } else if (message.type === 'result') {
        try {
          const aligned = alignLyricsToTranscript(
            lyricsLayer.lrcContent,
            message.chunks as TranscribeChunk[],
          );
          updateLayer(lyricsLayer.id, {
            lrcContent: aligned.lrc,
            timingOffsetSec: staticParam(0),
            timingScale: staticParam(1),
          } as any);
          const timingLabel = message.timestampMode === 'word' ? 'word timing' : 'segment timing fallback';
          setStatus(`Synced ${aligned.matchedLines}/${aligned.lineCount} lines · ${Math.round(aligned.confidence * 100)}% match · ${timingLabel}`);
        } catch (alignmentError) {
          setError(alignmentError instanceof Error ? alignmentError.message : 'Lyric alignment failed.');
          setStatus('');
        } finally {
          setBusy(false);
        }
      } else if (message.type === 'error') {
        const errorMessage = String(message.message ?? '');
        const wordTimingCompatibilityError = /cross attentions|output_attentions|extract timestamps/i.test(errorMessage);
        if (wordTimingCompatibilityError && !segmentFallbackStarted) {
          segmentFallbackStarted = true;
          setStatus('Word timing is unavailable for this model. Retrying with segment timing…');
          postSyncRequest('segment');
        } else {
          setError(errorMessage); setStatus(''); setBusy(false);
        }
      }
    };
    worker.onerror = (event) => {
      setError(event.message); setStatus(''); setBusy(false);
    };

    // Keep the main-thread copy available for one compatibility retry. A
    // four-minute 16 kHz mono track is only about 15 MB.
    postSyncRequest('word');
  }, [audioAsset, lyricsLayer, selectedModel, updateLayer, useGPU]);

  const handleTranscribeLocal = useCallback(async () => {
    if (!audioAsset) { setError('No audio loaded.'); return; }
    setError(''); setBusy(true);
    setStatus('Preparing audio…');

    let audio: Float32Array;
    try {
      audio = await prepareAudioForWhisper(audioAsset.relPath);
    } catch (e: any) {
      setError('Audio prep failed: ' + e.message); setBusy(false); setStatus(''); return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/whisper.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }

    const worker = workerRef.current;
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === 'status') {
        setStatus(msg.message);
      } else if (msg.type === 'result') {
        const lrc = chunksToLrc(msg.chunks as TranscribeChunk[]);
        setLrc(lrc);
        const generatedLines = lrc.split('\n').filter(Boolean).length;
        const timingLabel = msg.timestampMode === 'word' ? 'word timing' : 'segment timing fallback';
        setStatus(`Done — ${generatedLines} lyric lines · ${timingLabel}`);
        setBusy(false);
      } else if (msg.type === 'error') {
        setError(msg.message); setStatus(''); setBusy(false);
      }
    };
    worker.onerror = (ev) => {
      setError(ev.message); setStatus(''); setBusy(false);
    };

    worker.postMessage(
      {
        type: 'transcribe',
        audio,
        modelId: selectedModel.id,
        useGPU: useGPU && selectedModel.preferGPU,
        gpuDtype: selectedModel.gpuDtype,
        cpuDtype: selectedModel.cpuDtype,
        timestampMode: 'word',
      },
      [audio.buffer],
    );
  }, [audioAsset, selectedModel, useGPU, setLrc]);

  // ── OpenAI Whisper ─────────────────────────────────────────────────
  const handleTranscribeOpenAI = useCallback(async () => {
    if (!audioAsset) { setError('No audio loaded.'); return; }
    if (!openaiKey.trim()) { setError('Enter your OpenAI API key.'); return; }
    setError(''); setBusy(true);
    try {
      const lrc = await transcribeViaOpenAI(audioAsset.relPath, openaiKey.trim(), setStatus);
      setLrc(lrc);
      setStatus('Done!');
    } catch (e: any) {
      setError(e.message); setStatus('');
    } finally {
      setBusy(false);
    }
  }, [audioAsset, openaiKey, setLrc]);

  const handleTranscribe = mode === 'local' ? handleTranscribeLocal : handleTranscribeOpenAI;

  const setMode2 = (m: TranscribeMode) => { setMode(m); localStorage.setItem('pulseforge.transcribe.mode', m); setError(''); setStatus(''); };
  const setModel2 = (id: string) => { setModelId(id); localStorage.setItem('pulseforge.whisper.model', id); setError(''); setStatus(''); };
  const setGPU2 = (v: boolean) => { setUseGPU(v); localStorage.setItem('pulseforge.whisper.gpu', String(v)); };
  const setKey2 = (k: string) => { setOpenaiKey(k); localStorage.setItem('pulseforge.openai.key', k); };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header} onClick={() => setCollapsed((c) => !c)}>
        <span style={styles.headerIcon}>♪</span>
        <span style={styles.headerTitle}>Lyrics</span>
        {lyricsLayer && lineCount > 0 && (
          <span style={styles.linesBadge}>{lineCount} lines</span>
        )}
        <span style={{ ...styles.chevron, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
      </div>

      {!collapsed && (
        <div style={styles.body}>
          {/* ── Left: LRC file ── */}
          <div style={styles.col}>
            <div style={styles.colLabel}>Lyrics File</div>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => fileRef.current?.click()}>
                Upload .lrc / .txt
              </button>
              {lyricsLayer?.lrcContent && (
                <button className="ghost danger" style={styles.btn} onClick={() => setLrc('')}>
                  Clear
                </button>
              )}
              <input ref={fileRef} type="file" accept=".lrc,.txt,text/plain" style={{ display: 'none' }} onChange={handleLyricsFile} />
            </div>
            {lineCount > 0 && (
              <>
                <div style={styles.hint}>✓ {lineCount} lyric lines loaded</div>
                <div style={{ ...styles.row, flexWrap: 'wrap' }}>
                  <button style={styles.btn} title="Move all lyrics 1 second earlier" onClick={() => nudgeTiming(-1, 0)}>Earlier</button>
                  <button style={styles.btn} title="Move all lyrics 1 second later" onClick={() => nudgeTiming(1, 0)}>Later</button>
                  <button style={styles.btn} title="Progress through lyrics 5% faster" onClick={() => nudgeTiming(0, -0.05)}>Faster</button>
                  <button style={styles.btn} title="Progress through lyrics 5% slower" onClick={() => nudgeTiming(0, 0.05)}>Slower</button>
                </div>
                <button
                  className="primary"
                  style={{ ...styles.btn, width: '100%' }}
                  onClick={handleSyncLyrics}
                  disabled={busy || !audioAsset}
                  title={audioAsset ? 'Use Whisper word timestamps to align each lyric line' : 'Load audio first'}
                >
                  {busy ? 'Syncing…' : 'Sync Lyrics to Audio'}
                </button>
                <div style={styles.hint}>Delay {timingOffsetSec.toFixed(1)}s · Stretch {timingScale.toFixed(2)}×</div>
              </>
            )}
            {!lyricsLayer?.lrcContent && (
              <div style={{ ...styles.hint, color: 'var(--text-dim)' }}>
                Upload timed .lrc or plain .txt lyrics, or use AI transcription →
              </div>
            )}
            {!lyricsLayer && (
              <div style={{ ...styles.hint, color: 'var(--text-dim)', marginTop: 6 }}>
                A Lyrics layer will be created automatically.
              </div>
            )}
          </div>

          <div style={styles.divider} />

          {/* ── Right: Transcription ── */}
          <div style={styles.col}>
            <div style={styles.colLabel}>AI Transcription</div>

            {/* Engine tabs */}
            <div style={styles.row}>
              {(['local', 'openai'] as TranscribeMode[]).map((m) => (
                <button
                  key={m}
                  className={mode === m ? 'primary' : 'ghost'}
                  style={{ ...styles.btn, flex: 1 }}
                  onClick={() => setMode2(m)}
                  disabled={busy}
                >
                  {m === 'local' ? 'Local (Whisper)' : 'OpenAI API'}
                </button>
              ))}
            </div>

            {mode === 'local' && (
              <>
                <select
                  value={modelId}
                  onChange={(e) => setModel2(e.target.value)}
                  disabled={busy}
                  style={styles.select}
                >
                  {WHISPER_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.size}){m.preferGPU ? ' · GPU' : ' · CPU'}
                    </option>
                  ))}
                </select>

                {selectedModel.preferGPU && (
                  <label style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={useGPU}
                      onChange={(e) => setGPU2(e.target.checked)}
                      disabled={busy}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span>
                      Use GPU &nbsp;
                      <span style={{ color: hasWebGPU ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
                        {hasWebGPU ? '(WebGPU ✓)' : '(not detected)'}
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}

            {mode === 'openai' && (
              <input
                type="password"
                placeholder="sk-…  OpenAI API key"
                value={openaiKey}
                onChange={(e) => setKey2(e.target.value)}
                style={styles.keyInput}
              />
            )}

            {!audioAsset && (
              <div style={{ ...styles.hint, color: 'var(--warning)' }}>Import audio first.</div>
            )}

            <button
              className="primary"
              style={{ ...styles.btn, width: '100%', marginTop: 4 }}
              onClick={handleTranscribe}
              disabled={busy || !audioAsset}
            >
              {busy ? 'Transcribing…' : 'Transcribe Audio'}
            </button>

            {status && !error && (
              <div style={{ ...styles.hint, fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                {status}
              </div>
            )}
            {error && (
              <div style={{ ...styles.hint, color: 'var(--error, #ff7675)', wordBreak: 'break-word' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerIcon: { fontSize: 14, color: 'var(--accent-bright)' },
  headerTitle: { fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', flex: 1 },
  linesBadge: {
    fontSize: 11,
    background: 'var(--accent-dim)',
    color: 'var(--accent-bright)',
    borderRadius: 10,
    padding: '1px 7px',
    fontFamily: 'var(--font-mono)',
  },
  chevron: {
    fontSize: 12,
    color: 'var(--text-muted)',
    transition: 'transform 0.2s',
    display: 'inline-block',
  },
  body: {
    display: 'flex',
    gap: 0,
    padding: '0 0 10px',
    borderTop: '1px solid var(--border-light)',
  },
  col: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 14px',
  },
  divider: {
    width: 1,
    background: 'var(--border-light)',
    margin: '8px 0',
    flexShrink: 0,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  row: { display: 'flex', gap: 6, alignItems: 'center' },
  btn: { fontSize: 11, padding: '4px 10px' },
  hint: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 },
  select: {
    fontSize: 12,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    width: '100%',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  keyInput: {
    fontSize: 12,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    width: '100%',
    boxSizing: 'border-box',
  },
};
