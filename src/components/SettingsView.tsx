import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Contrast,
  Mail,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Type,
  User as UserIcon,
} from 'lucide-react';
import {
  getUserDigestFrequency,
  updateUserDigestFrequency,
  updateUserProfile,
} from '../lib/firestoreService';
import {
  ACCENT_PRESETS,
  CONTRAST_LEVELS,
  THEME_PRESETS,
  type ThemeSettings,
} from '../lib/theme';
import { LIMITS } from '../lib/validation';
import type {
  AppRoute,
  DigestFrequency,
  ReaderPrefs,
  UserProfile,
} from '../types/folio';

interface SettingsViewProps {
  themeSettings: ThemeSettings;
  onUpdateThemeSettings: (next: ThemeSettings) => void;
  onResetThemeSettings: () => void;
  readerPrefs: ReaderPrefs;
  onUpdateReaderPrefs: (next: ReaderPrefs) => void;
  user: User | null;
  profile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
  onSignIn: () => void;
  onNavigate: (route: AppRoute) => void;
  onNotify: (msg: string) => void;
}

export function SettingsView({
  themeSettings,
  onUpdateThemeSettings,
  onResetThemeSettings,
  readerPrefs,
  onUpdateReaderPrefs,
  user,
  profile,
  onProfileUpdated,
  onSignIn,
  onNavigate,
  onNotify,
}: SettingsViewProps) {
  const darkPresets = THEME_PRESETS.filter((p) => p.group === 'dark');
  const lightPresets = THEME_PRESETS.filter((p) => p.group === 'light');

  const activePresetMeta =
    THEME_PRESETS.find((p) => p.id === themeSettings.preset) || THEME_PRESETS[1];
  const activeContrastMeta =
    CONTRAST_LEVELS.find((c) => c.id === themeSettings.contrast) || CONTRAST_LEVELS[1];
  const activeAccentMeta =
    ACCENT_PRESETS.find((a) => a.id === themeSettings.accent) || ACCENT_PRESETS[0];

  // Account & digest state (synced with Firestore when signed in)
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [handle, setHandle] = useState(profile?.handle || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('immediate');
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setHandle(profile?.handle || '');
    setBio(profile?.bio || '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    void getUserDigestFrequency(user.uid)
      .then((freq) => setDigestFrequency(freq))
      .catch(() => undefined);
  }, [user]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSavingAccount(true);
    try {
      const [updated] = await Promise.all([
        updateUserProfile(user.uid, {
          displayName: displayName.trim() || profile.displayName,
          handle: handle.trim() || profile.handle,
          bio: bio.trim(),
          avatarUrl: profile.avatarUrl,
        }),
        updateUserDigestFrequency(user.uid, digestFrequency),
      ]);
      onProfileUpdated({ ...profile, ...updated });
      onNotify('Account & digest settings saved.');
    } catch {
      onNotify('Could not save account settings. Please try again.');
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-8 border-b border-[var(--border-hairline)]">
        <div>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'explore' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dispatches</span>
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-heading)] headline-balance">
            Appearance & Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-2xl leading-relaxed">
            Calibrate surface atmosphere across dark and paper modes, contrast intensity, accent palette, and default essay typography.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onResetThemeSettings();
            onNotify('Restored default Obsidian & Royal Violet theme.');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Theme Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
        {/* Main Settings Column */}
        <div className="lg:col-span-8 space-y-10">
          {/* LEVEL 1: Surface Atmosphere Themes */}
          <section aria-labelledby="theme-atmosphere-heading">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold text-[var(--text-accent-soft)]">
                  Level 1 · Surface Atmosphere
                </p>
                <h2
                  id="theme-atmosphere-heading"
                  className="font-display text-2xl font-semibold text-[var(--text-heading)] mt-0.5"
                >
                  Reading & Workspace Themes
                </h2>
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                6 calibrated levels
              </span>
            </div>

            {/* Dark Themes Group */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] mb-3">
                <Moon className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                <span>Dark & Low-Light Levels</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {darkPresets.map((preset) => {
                  const selected = themeSettings.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateThemeSettings({ ...themeSettings, preset: preset.id })
                      }
                      aria-pressed={selected}
                      className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {/* Miniature UI Swatch */}
                      <div
                        className="rounded-lg p-3 mb-3 border"
                        style={{
                          backgroundColor: preset.swatches.canvas,
                          borderColor: preset.swatches.border,
                        }}
                      >
                        <div
                          className="rounded-md p-2.5 border"
                          style={{
                            backgroundColor: preset.swatches.surface,
                            borderColor: preset.swatches.border,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className="h-2 w-14 rounded-xs block"
                              style={{ backgroundColor: preset.swatches.text }}
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full block shrink-0"
                              style={{ backgroundColor: activeAccentMeta.border }}
                            />
                          </div>
                          <span
                            className="h-1.5 w-full rounded-xs block opacity-45 mb-1"
                            style={{ backgroundColor: preset.swatches.text }}
                          />
                          <span
                            className="h-1.5 w-3/4 rounded-xs block opacity-30"
                            style={{ backgroundColor: preset.swatches.text }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {preset.name}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-accent)]">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-accent-soft)] mt-0.5">
                        {preset.levelLabel}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Light & Paper Themes Group */}
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] mb-3">
                <Sun className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                <span>Daylight & Paper Levels</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {lightPresets.map((preset) => {
                  const selected = themeSettings.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateThemeSettings({ ...themeSettings, preset: preset.id })
                      }
                      aria-pressed={selected}
                      className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div
                        className="rounded-lg p-3 mb-3 border"
                        style={{
                          backgroundColor: preset.swatches.canvas,
                          borderColor: preset.swatches.border,
                        }}
                      >
                        <div
                          className="rounded-md p-2.5 border"
                          style={{
                            backgroundColor: preset.swatches.surface,
                            borderColor: preset.swatches.border,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className="h-2 w-14 rounded-xs block"
                              style={{ backgroundColor: preset.swatches.text }}
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full block shrink-0"
                              style={{ backgroundColor: activeAccentMeta.solid }}
                            />
                          </div>
                          <span
                            className="h-1.5 w-full rounded-xs block opacity-45 mb-1"
                            style={{ backgroundColor: preset.swatches.text }}
                          />
                          <span
                            className="h-1.5 w-3/4 rounded-xs block opacity-30"
                            style={{ backgroundColor: preset.swatches.text }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {preset.name}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-accent)]">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-accent-soft)] mt-0.5">
                        {preset.levelLabel}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* LEVEL 2: Contrast Intensity */}
          <section
            aria-labelledby="contrast-level-heading"
            className="pt-8 border-t border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Contrast className="w-4 h-4 text-[var(--text-accent-soft)]" />
              <p className="text-xs font-semibold text-[var(--text-accent-soft)]">
                Level 2 · Contrast Intensity
              </p>
            </div>
            <h2
              id="contrast-level-heading"
              className="font-display text-2xl font-semibold text-[var(--text-heading)] mb-4"
            >
              Border & Ink Contrast
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CONTRAST_LEVELS.map((lvl) => {
                const selected = themeSettings.contrast === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() =>
                      onUpdateThemeSettings({ ...themeSettings, contrast: lvl.id })
                    }
                    aria-pressed={selected}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {lvl.name}
                      </span>
                      {selected && (
                        <Check className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {lvl.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* LEVEL 3: Accent Tone */}
          <section
            aria-labelledby="accent-level-heading"
            className="pt-8 border-t border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-[var(--text-accent-soft)]" />
              <p className="text-xs font-semibold text-[var(--text-accent-soft)]">
                Level 3 · Editorial Accent
              </p>
            </div>
            <h2
              id="accent-level-heading"
              className="font-display text-2xl font-semibold text-[var(--text-heading)] mb-4"
            >
              Highlight & Action Color
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {ACCENT_PRESETS.map((accent) => {
                const selected = themeSettings.accent === accent.id;
                return (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() =>
                      onUpdateThemeSettings({ ...themeSettings, accent: accent.id })
                    }
                    aria-pressed={selected}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-md block"
                          style={{ backgroundColor: accent.solid }}
                        />
                        <span
                          className="w-5 h-5 rounded-md block"
                          style={{ backgroundColor: accent.border }}
                        />
                      </div>
                      {selected && (
                        <Check className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {accent.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      {accent.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* LEVEL 4: Reader Typography & Motion */}
          <section
            aria-labelledby="reader-defaults-heading"
            className="pt-8 border-t border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Type className="w-4 h-4 text-[var(--text-accent-soft)]" />
              <p className="text-xs font-semibold text-[var(--text-accent-soft)]">
                Level 4 · Reading & Accessibility
              </p>
            </div>
            <h2
              id="reader-defaults-heading"
              className="font-display text-2xl font-semibold text-[var(--text-heading)] mb-5"
            >
              Default Essay Typography & Motion
            </h2>

            <div className="p-5 sm:p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                    Essay Typeface
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['sans', 'serif'] as const).map((fam) => (
                      <button
                        key={fam}
                        type="button"
                        onClick={() =>
                          onUpdateReaderPrefs({ ...readerPrefs, fontFamily: fam })
                        }
                        className={`py-2 px-3 text-xs font-medium rounded-lg border cursor-pointer whitespace-nowrap ${
                          readerPrefs.fontFamily === fam
                            ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {fam === 'sans' ? 'Modern Sans' : 'Editorial Serif'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                    Default Font Size
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 17, 19, 21].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() =>
                          onUpdateReaderPrefs({ ...readerPrefs, fontSize: sz })
                        }
                        className={`py-2 text-xs font-medium rounded-lg border cursor-pointer tabular-nums ${
                          readerPrefs.fontSize === sz
                            ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                    Column Measure
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['narrow', 'standard', 'wide'] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() =>
                          onUpdateReaderPrefs({ ...readerPrefs, width: w })
                        }
                        className={`py-2 text-xs font-medium rounded-lg border capitalize cursor-pointer ${
                          readerPrefs.width === w
                            ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Reduced Motion
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Minimize theme fades, hover animations, and smooth scrolling transitions.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={themeSettings.reducedMotion}
                  onClick={() =>
                    onUpdateThemeSettings({
                      ...themeSettings,
                      reducedMotion: !themeSettings.reducedMotion,
                    })
                  }
                  className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    themeSettings.reducedMotion
                      ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  {themeSettings.reducedMotion ? 'Reduced Motion On' : 'Standard Motion'}
                </button>
              </div>
            </div>
          </section>

          {/* Account & Newsletter Digest */}
          <section
            aria-labelledby="account-settings-heading"
            className="pt-8 border-t border-[var(--border-hairline)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <UserIcon className="w-4 h-4 text-[var(--text-accent-soft)]" />
              <p className="text-xs font-semibold text-[var(--text-accent-soft)]">
                Profile & Delivery
              </p>
            </div>
            <h2
              id="account-settings-heading"
              className="font-display text-2xl font-semibold text-[var(--text-heading)] mb-4"
            >
              Account & Digest Preferences
            </h2>

            {!user || !profile ? (
              <div className="p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Theme preferences are active on this device
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Sign in with Google to edit your public Folio profile and newsletter email digest cadence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSaveAccount}
                className="p-5 sm:p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="settings-display-name"
                      className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                    >
                      Display Name
                    </label>
                    <input
                      id="settings-display-name"
                      type="text"
                      maxLength={LIMITS.displayNameMax}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-handle"
                      className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                    >
                      Handle
                    </label>
                    <input
                      id="settings-handle"
                      type="text"
                      maxLength={LIMITS.handleMax}
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="settings-bio"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Editorial Bio
                  </label>
                  <textarea
                    id="settings-bio"
                    rows={2}
                    maxLength={LIMITS.bioMax}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mb-2">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                    <span>Newsletter Digest Cadence</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-md">
                    {(['immediate', 'daily', 'weekly'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setDigestFrequency(freq)}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border capitalize cursor-pointer ${
                          digestFrequency === freq
                            ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="px-5 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {savingAccount ? 'Saving...' : 'Save Account Settings'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Sticky Live Theme Preview Sidebar */}
        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <div className="p-5 sm:p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-accent)]">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Live Theme Preview</span>
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {activePresetMeta.name}
                </span>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Essays · 6 min read · {activeAccentMeta.name}
                </p>
                <h3 className="font-display text-2xl font-semibold text-[var(--text-heading)] leading-snug headline-balance">
                  Notes on Attention & Quiet Architecture
                </h3>
                <p
                  className={`text-[var(--prose-text)] leading-relaxed ${
                    readerPrefs.fontFamily === 'serif' ? 'font-display' : ''
                  }`}
                  style={{ fontSize: `${Math.min(18, readerPrefs.fontSize)}px` }}
                >
                  A well-calibrated reading room recedes into the background so{' '}
                  <span className="folio-highlight-mark">
                    long-form ideas hold their clarity
                  </span>{' '}
                  from morning daylight through late evening.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate({ view: 'explore' })}
                    className="px-3.5 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Read in This Theme
                  </button>
                  <button
                    type="button"
                    onClick={onResetThemeSettings}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Default Preset
                  </button>
                </div>
              </div>

              <dl className="pt-4 border-t border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">Surface Theme</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {activePresetMeta.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">Contrast Level</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {activeContrastMeta.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">Accent Palette</dt>
                  <dd className="font-medium text-[var(--text-accent)]">
                    {activeAccentMeta.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">Essay Typography</dt>
                  <dd className="font-medium text-[var(--text-primary)] tabular-nums">
                    {readerPrefs.fontFamily === 'serif' ? 'Serif' : 'Sans'} ·{' '}
                    {readerPrefs.fontSize}px
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
