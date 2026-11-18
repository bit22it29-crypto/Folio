import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Headphones,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react';

export type StudioVoiceName = 'Kore' | 'Charon' | 'Puck' | 'Fenrir' | 'Zephyr';

const STUDIO_VOICES: Array<{ id: StudioVoiceName; label: string }> = [
  { id: 'Kore', label: 'Kore — Warm & Clear' },
  { id: 'Charon', label: 'Charon — Deep & Measured' },
  { id: 'Puck', label: 'Puck — Bright & Expressive' },
  { id: 'Fenrir', label: 'Fenrir — Rich & Authoritative' },
  { id: 'Zephyr', label: 'Zephyr — Calm & Conversational' },
];

const NARRATION_STYLES = [
  { id: 'Warm, articulate literary essay narrator', label: 'Literary' },
  { id: 'Calm, measured documentary host', label: 'Documentary' },
  { id: 'Crisp, bright editorial presenter', label: 'Editorial' },
] as const;

const PLAYBACK_RATES: Array<0.85 | 1 | 1.25 | 1.5 | 2> = [0.85, 1, 1.25, 1.5, 2];

interface VoiceReaderBarProps {
  open: boolean;
  postId: string;
  postTitle: string;
  segments: string[];
  activeIdx: number;
  autoFollow: boolean;
  jumpRequest: { idx: number; seq: number } | null;
  onActiveIdxChange: (idx: number) => void;
  onToggleAutoFollow: () => void;
  onScrollToActive: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export function VoiceReaderBar({
  open,
  postId,
  postTitle,
  segments,
  activeIdx,
  autoFollow,
  jumpRequest,
  onActiveIdxChange,
  onToggleAutoFollow,
  onScrollToActive,
  onClose,
  onNotify,
}: VoiceReaderBarProps) {
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [engine, setEngine] = useState<'studio' | 'device'>('studio');
  const [studioAvailable, setStudioAvailable] = useState<boolean | null>(null);
  const [studioVoice, setStudioVoice] = useState<StudioVoiceName>('Kore');
  const [narrationStyle, setNarrationStyle] = useState<string>(NARRATION_STYLES[0].id);

  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedDeviceVoiceUri, setSelectedDeviceVoiceUri] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [rate, setRate] = useState<0.85 | 1 | 1.25 | 1.5 | 2>(1);
  const [inlineVisible, setInlineVisible] = useState(true);

  const inlineCardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipCacheRef = useRef<Map<string, string>>(new Map());
  const sessionRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const studioVoiceRef = useRef(studioVoice);
  studioVoiceRef.current = studioVoice;
  const styleRef = useRef(narrationStyle);
  styleRef.current = narrationStyle;

  // Check server Studio Voice availability once
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/tts/status')
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data: { available?: boolean }) => {
        if (cancelled) return;
        const avail = Boolean(data.available);
        setStudioAvailable(avail);
        if (!avail && speechSupported) {
          setEngine('device');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStudioAvailable(false);
          if (speechSupported) setEngine('device');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [speechSupported]);

  // Populate browser speechSynthesis voices
  useEffect(() => {
    if (!speechSupported) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      const sorted = [...list].sort((a, b) => {
        const aEn = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
        const bEn = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
        if (aEn !== bEn) return aEn - bEn;
        return a.name.localeCompare(b.name);
      });
      setDeviceVoices(sorted);
      setSelectedDeviceVoiceUri((prev) => {
        if (prev && sorted.some((v) => v.voiceURI === prev)) return prev;
        const preferred =
          sorted.find((v) => v.lang.toLowerCase().startsWith('en') && v.localService) ||
          sorted.find((v) => v.lang.toLowerCase().startsWith('en')) ||
          sorted[0];
        return preferred ? preferred.voiceURI : '';
      });
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [speechSupported]);

  // Observe inline card visibility for compact floating mini-player
  useEffect(() => {
    if (!open || !inlineCardRef.current) {
      setInlineVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInlineVisible(entries[0].isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(inlineCardRef.current);
    return () => observer.disconnect();
  }, [open]);

  const stopAllAudio = useCallback(() => {
    sessionRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsBuffering(false);
  }, [speechSupported]);

  // Reset cache and playback when changing post or closing
  useEffect(() => {
    clipCacheRef.current.clear();
    stopAllAudio();
    setTtsError(null);
  }, [postId, stopAllAudio]);

  useEffect(() => {
    if (!open) {
      stopAllAudio();
    }
  }, [open, stopAllAudio]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const fetchStudioClip = useCallback(
    async (idx: number, voiceName: StudioVoiceName, styleText: string): Promise<string> => {
      const text = segmentsRef.current[idx];
      if (!text) throw new Error('Empty section');
      const key = `${voiceName}|${styleText}|${idx}|${text.slice(0, 48)}`;
      const existing = clipCacheRef.current.get(key);
      if (existing) return existing;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: voiceName, style: styleText }),
      });
      const payload = (await res.json()) as {
        audioBase64?: string;
        error?: string;
      };
      if (!res.ok || !payload.audioBase64) {
        throw new Error(payload.error || 'Voice generation failed.');
      }
      clipCacheRef.current.set(key, payload.audioBase64);
      return payload.audioBase64;
    },
    []
  );

  const playSection = useCallback(
    async (idx: number) => {
      const list = segmentsRef.current;
      if (idx < 0 || idx >= list.length) {
        stopAllAudio();
        onActiveIdxChange(0);
        return;
      }

      stopAllAudio();
      const mySession = sessionRef.current;
      onActiveIdxChange(idx);
      setTtsError(null);

      if (engineRef.current === 'studio') {
        setIsBuffering(true);
        try {
          const voiceName = studioVoiceRef.current;
          const styleText = styleRef.current;
          const base64Audio = await fetchStudioClip(idx, voiceName, styleText);
          if (sessionRef.current !== mySession) return;

          // Pre-fetch next paragraph in the background for smooth transition
          if (idx + 1 < list.length) {
            void fetchStudioClip(idx + 1, voiceName, styleText).catch(() => undefined);
          }

          const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
          audio.playbackRate = rateRef.current;
          audioRef.current = audio;

          audio.onended = () => {
            if (sessionRef.current !== mySession) return;
            const next = idx + 1;
            if (next < segmentsRef.current.length) {
              void playSection(next);
            } else {
              stopAllAudio();
              onActiveIdxChange(0);
            }
          };

          audio.onerror = () => {
            if (sessionRef.current !== mySession) return;
            setTtsError('Audio playback failed in this browser.');
            stopAllAudio();
          };

          setIsBuffering(false);
          setIsPlaying(true);
          await audio.play();
        } catch (err) {
          if (sessionRef.current !== mySession) return;
          setIsBuffering(false);
          setIsPlaying(false);
          const msg = err instanceof Error ? err.message : 'Studio Voice failed.';
          setTtsError(msg);
        }
        return;
      }

      // Device Voice via Web Speech API
      if (!speechSupported) {
        setTtsError('Device voice reading is not supported in this browser.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(list[idx]);
      utterance.rate = rateRef.current;
      const chosenDevice = deviceVoices.find((v) => v.voiceURI === selectedDeviceVoiceUri);
      if (chosenDevice) utterance.voice = chosenDevice;

      utterance.onend = () => {
        if (sessionRef.current !== mySession) return;
        const next = idx + 1;
        if (next < segmentsRef.current.length) {
          void playSection(next);
        } else {
          stopAllAudio();
          onActiveIdxChange(0);
        }
      };
      utterance.onerror = () => {
        if (sessionRef.current !== mySession) return;
        setIsPlaying(false);
      };
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    },
    [
      deviceVoices,
      fetchStudioClip,
      onActiveIdxChange,
      selectedDeviceVoiceUri,
      speechSupported,
      stopAllAudio,
    ]
  );

  // Respond to external paragraph clicks in the essay
  const lastJumpSeqRef = useRef<number>(0);
  useEffect(() => {
    if (!open || !jumpRequest) return;
    if (jumpRequest.seq === lastJumpSeqRef.current) return;
    lastJumpSeqRef.current = jumpRequest.seq;
    void playSection(jumpRequest.idx);
  }, [open, jumpRequest, playSection]);

  const handleTogglePlay = () => {
    if (isPlaying || isBuffering) {
      stopAllAudio();
    } else {
      void playSection(activeIdx);
    }
  };

  const handleCycleRate = () => {
    const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
    setRate(next);
    rateRef.current = next;
    if (engine === 'studio' && audioRef.current) {
      audioRef.current.playbackRate = next;
    } else if (engine === 'device' && isPlaying) {
      void playSection(activeIdx);
    }
  };

  const handleSwitchEngine = (nextEngine: 'studio' | 'device') => {
    if (nextEngine === engine) return;
    const wasPlaying = isPlaying;
    stopAllAudio();
    setTtsError(null);
    setEngine(nextEngine);
    engineRef.current = nextEngine;
    if (wasPlaying) {
      void playSection(activeIdx);
    }
  };

  const progressPct = useMemo(() => {
    if (segments.length <= 1) return 100;
    return Math.round(((activeIdx + 1) / segments.length) * 100);
  }, [activeIdx, segments.length]);

  const activeSnippet = segments[activeIdx] || postTitle;

  if (!open) return null;

  return (
    <>
      <div
        ref={inlineCardRef}
        className="mb-7 p-4 sm:p-5 rounded-xl border border-[var(--accent-border)]/60 bg-[var(--bg-surface)] space-y-4"
        aria-label="Voice Reading Controls"
      >
        {/* Top Row: Title, Engine Toggle, Close */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-solid)]/20 text-[var(--text-accent)] flex items-center justify-center shrink-0">
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Headphones className="w-4 h-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Voice Reading
              </p>
              <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                Section {activeIdx + 1} of {segments.length} · Click any paragraph below to jump
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center p-0.5 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg">
              <button
                type="button"
                onClick={() => handleSwitchEngine('studio')}
                title={
                  studioAvailable === false
                    ? 'Studio Neural Voice (requires Gemini API key)'
                    : 'Studio Neural Voice'
                }
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  engine === 'studio'
                    ? 'bg-[var(--accent-solid)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Studio Voice
              </button>
              <button
                type="button"
                onClick={() => handleSwitchEngine('device')}
                disabled={!speechSupported}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 ${
                  engine === 'device'
                    ? 'bg-[var(--accent-solid)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Device Voice
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                onClose();
              }}
              aria-label="Close Voice Reading"
              className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrubber Bar */}
        <div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)] mb-1.5">
            <span className="truncate italic text-[var(--text-secondary)]">
              “{activeSnippet.slice(0, 90)}
              {activeSnippet.length > 90 ? '…' : ''}”
            </span>
            <span className="tabular-nums shrink-0">{progressPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, segments.length - 1)}
            value={activeIdx}
            onChange={(e) => {
              const target = Number(e.target.value);
              if (isPlaying) {
                void playSection(target);
              } else {
                onActiveIdxChange(target);
              }
            }}
            aria-label="Jump to essay section"
            className="w-full accent-[var(--accent-border)] cursor-pointer"
          />
        </div>

        {/* Controls + Voice & Style Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeIdx <= 0}
              onClick={() => void playSection(Math.max(0, activeIdx - 1))}
              aria-label="Previous section"
              className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] disabled:opacity-40 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              {isBuffering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating…</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={activeIdx >= segments.length - 1}
              onClick={() =>
                void playSection(Math.min(segments.length - 1, activeIdx + 1))
              }
              aria-label="Next section"
              className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] disabled:opacity-40 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleCycleRate}
              title="Playback speed"
              className="px-2.5 py-2 text-xs font-mono font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer tabular-nums"
            >
              {rate}x
            </button>

            <button
              type="button"
              onClick={onToggleAutoFollow}
              aria-pressed={autoFollow}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                autoFollow
                  ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)] text-[var(--text-accent)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)]'
              }`}
            >
              Follow Text
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {engine === 'studio' ? (
              <>
                <select
                  aria-label="Narrator Voice"
                  value={studioVoice}
                  onChange={(e) => {
                    const nextVoice = e.target.value as StudioVoiceName;
                    setStudioVoice(nextVoice);
                    studioVoiceRef.current = nextVoice;
                    if (isPlaying) void playSection(activeIdx);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Narration Tone"
                  value={narrationStyle}
                  onChange={(e) => {
                    const nextStyle = e.target.value;
                    setNarrationStyle(nextStyle);
                    styleRef.current = nextStyle;
                    if (isPlaying) void playSection(activeIdx);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                >
                  {NARRATION_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      Tone: {s.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                aria-label="Browser Voice"
                value={selectedDeviceVoiceUri}
                onChange={(e) => {
                  setSelectedDeviceVoiceUri(e.target.value);
                  if (isPlaying) void playSection(activeIdx);
                }}
                className="max-w-[240px] px-2.5 py-1.5 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
              >
                {deviceVoices.length === 0 ? (
                  <option value="">Default System Voice</option>
                ) : (
                  deviceVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>

        {/* Honest API Error / Fallback Banner */}
        {ttsError && (
          <div className="p-3 rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger-soft)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-danger)]">{ttsError}</span>
            {engine === 'studio' && speechSupported && (
              <button
                type="button"
                onClick={() => {
                  handleSwitchEngine('device');
                  onNotify('Switched to Device Voice.');
                }}
                className="px-2.5 py-1 font-medium bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded-md hover:border-[var(--accent-border)] cursor-pointer whitespace-nowrap"
              >
                Switch to Device Voice
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact Sticky Mini-Player when scrolled down */}
      {!inlineVisible && (
        <div
          role="region"
          aria-label="Floating Voice Reading Mini-Player"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl bg-[var(--bg-surface)] border border-[var(--accent-border)] rounded-xl shadow-2xl px-3.5 py-2.5 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={onScrollToActive}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {activeSnippet}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                Section {activeIdx + 1} / {segments.length} · {engine === 'studio' ? studioVoice : 'Device'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={activeIdx <= 0}
              onClick={() => void playSection(Math.max(0, activeIdx - 1))}
              aria-label="Previous section"
              className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="p-2 rounded-lg bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              {isBuffering ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              disabled={activeIdx >= segments.length - 1}
              onClick={() =>
                void playSection(Math.min(segments.length - 1, activeIdx + 1))
              }
              aria-label="Next section"
              className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCycleRate}
              className="hidden sm:inline px-2 py-1 text-[11px] font-mono rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-accent)] cursor-pointer tabular-nums"
            >
              {rate}x
            </button>
            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                onClose();
              }}
              aria-label="Stop Voice Reading"
              className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-danger)] cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
