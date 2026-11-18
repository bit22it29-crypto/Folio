import type { ReaderPrefs } from '../types/folio';

export type ThemePresetId =
  | 'pitch'
  | 'obsidian'
  | 'midnight'
  | 'daylight'
  | 'parchment'
  | 'sepia';

export type ContrastLevel = 'soft' | 'balanced' | 'high';
export type AccentPresetId = 'violet' | 'amethyst' | 'indigo' | 'plum';

export interface ThemeSettings {
  preset: ThemePresetId;
  contrast: ContrastLevel;
  accent: AccentPresetId;
  reducedMotion: boolean;
}

export interface ThemePresetMeta {
  id: ThemePresetId;
  name: string;
  group: 'dark' | 'light';
  isDark: boolean;
  levelLabel: string;
  description: string;
  swatches: {
    canvas: string;
    surface: string;
    border: string;
    text: string;
  };
}

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'pitch',
    name: 'OLED Pitch',
    group: 'dark',
    isDark: true,
    levelLabel: 'Level 1 · True Black',
    description: 'Pure black canvas with deep card contrast for zero ambient glare.',
    swatches: {
      canvas: '#000000',
      surface: '#0b0b10',
      border: '#201d30',
      text: '#f5f4fa',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    group: 'dark',
    isDark: true,
    levelLabel: 'Level 2 · Signature Dark',
    description: 'Deep obsidian ink and smoky violet surfaces designed for long sessions.',
    swatches: {
      canvas: '#09090d',
      surface: '#14121d',
      border: '#272338',
      text: '#f4f3f8',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Dusk',
    group: 'dark',
    isDark: true,
    levelLabel: 'Level 3 · Soft Slate',
    description: 'Elevated slate-indigo dark mode with gentler luminance contrast.',
    swatches: {
      canvas: '#0e131f',
      surface: '#161d2e',
      border: '#2a334b',
      text: '#eef2fb',
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    group: 'light',
    isDark: false,
    levelLabel: 'Level 4 · Crisp Alabaster',
    description: 'Bright high-clarity alabaster paper for daytime writing and editing.',
    swatches: {
      canvas: '#faf9fc',
      surface: '#ffffff',
      border: '#e4e0ee',
      text: '#14121d',
    },
  },
  {
    id: 'parchment',
    name: 'Archival Cream',
    group: 'light',
    isDark: false,
    levelLabel: 'Level 5 · Warm Paper',
    description: 'Soft warm-stone museum stock with antique charcoal ink.',
    swatches: {
      canvas: '#faf7f0',
      surface: '#fffdf8',
      border: '#e5ddd0',
      text: '#1c1917',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia Folio',
    group: 'light',
    isDark: false,
    levelLabel: 'Level 6 · Low-Glare Sand',
    description: 'Warm sepia tone engineered to soften glare during sunlit reading.',
    swatches: {
      canvas: '#f1e9d8',
      surface: '#f8f2e4',
      border: '#d6c8b0',
      text: '#2a2118',
    },
  },
];

export const CONTRAST_LEVELS: Array<{
  id: ContrastLevel;
  name: string;
  description: string;
}> = [
  {
    id: 'soft',
    name: 'Soft',
    description: 'Muted hairlines and gentle secondary text for low-strain evening reading.',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Editorial default calibrated to WCAG AA contrast across every theme.',
  },
  {
    id: 'high',
    name: 'High Contrast',
    description: 'Sharper card borders and deepened ink for maximum crispness.',
  },
];

export const ACCENT_PRESETS: Array<{
  id: AccentPresetId;
  name: string;
  description: string;
  solid: string;
  border: string;
  tintLight: string;
  tintDark: string;
}> = [
  {
    id: 'violet',
    name: 'Royal Violet',
    description: 'Signature Folio obsidian purple.',
    solid: '#6d28d9',
    border: '#8b5cf6',
    tintLight: '#6d28d9',
    tintDark: '#c4b5fd',
  },
  {
    id: 'amethyst',
    name: 'Electric Amethyst',
    description: 'Brighter plum-violet accent energy.',
    solid: '#7e22ce',
    border: '#a855f7',
    tintLight: '#7e22ce',
    tintDark: '#e9d5ff',
  },
  {
    id: 'indigo',
    name: 'Deep Lapis',
    description: 'Cool scholarly indigo-cobalt.',
    solid: '#4338ca',
    border: '#6366f1',
    tintLight: '#4338ca',
    tintDark: '#c7d2fe',
  },
  {
    id: 'plum',
    name: 'Burgundy Plum',
    description: 'Warm archival wine & rose ink.',
    solid: '#9d174d',
    border: '#db2777',
    tintLight: '#9d174d',
    tintDark: '#fbcfe8',
  },
];

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  preset: 'obsidian',
  contrast: 'balanced',
  accent: 'violet',
  reducedMotion: false,
};

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 17,
  fontFamily: 'sans',
  width: 'standard',
};

const STORAGE_KEYS = {
  preset: 'folio-theme',
  contrast: 'folio-theme-contrast',
  accent: 'folio-theme-accent',
  reducedMotion: 'folio-reduced-motion',
  lastDark: 'folio-last-dark',
  lastLight: 'folio-last-light',
  readerPrefs: 'folio-reader-prefs',
} as const;

export function getThemePresetMeta(id: ThemePresetId): ThemePresetMeta {
  return THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[1];
}

export function normalizePresetId(raw: string | null): ThemePresetId {
  if (raw === 'dark') return 'obsidian';
  if (raw === 'light') return 'daylight';
  if (THEME_PRESETS.some((p) => p.id === raw)) return raw as ThemePresetId;
  return DEFAULT_THEME_SETTINGS.preset;
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const preset = normalizePresetId(localStorage.getItem(STORAGE_KEYS.preset));
    const rawContrast = localStorage.getItem(STORAGE_KEYS.contrast);
    const contrast: ContrastLevel =
      rawContrast === 'soft' || rawContrast === 'high' ? rawContrast : 'balanced';
    const rawAccent = localStorage.getItem(STORAGE_KEYS.accent);
    const accent: AccentPresetId =
      rawAccent === 'amethyst' || rawAccent === 'indigo' || rawAccent === 'plum'
        ? rawAccent
        : 'violet';
    const reducedMotion = localStorage.getItem(STORAGE_KEYS.reducedMotion) === 'true';
    return { preset, contrast, accent, reducedMotion };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function getLastDarkPreset(): ThemePresetId {
  try {
    const raw = normalizePresetId(localStorage.getItem(STORAGE_KEYS.lastDark));
    return getThemePresetMeta(raw).isDark ? raw : 'obsidian';
  } catch {
    return 'obsidian';
  }
}

export function getLastLightPreset(): ThemePresetId {
  try {
    const raw = normalizePresetId(localStorage.getItem(STORAGE_KEYS.lastLight));
    return !getThemePresetMeta(raw).isDark ? raw : 'daylight';
  } catch {
    return 'daylight';
  }
}

export function applyThemeToDom(settings: ThemeSettings): void {
  const root = document.documentElement;
  const meta = getThemePresetMeta(settings.preset);

  if (meta.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-theme', settings.preset);
  root.setAttribute('data-contrast', settings.contrast);
  root.setAttribute('data-accent', settings.accent);
  root.setAttribute('data-motion', settings.reducedMotion ? 'reduced' : 'standard');

  try {
    localStorage.setItem(STORAGE_KEYS.preset, settings.preset);
    localStorage.setItem(STORAGE_KEYS.contrast, settings.contrast);
    localStorage.setItem(STORAGE_KEYS.accent, settings.accent);
    localStorage.setItem(STORAGE_KEYS.reducedMotion, String(settings.reducedMotion));
    if (meta.isDark) {
      localStorage.setItem(STORAGE_KEYS.lastDark, settings.preset);
    } else {
      localStorage.setItem(STORAGE_KEYS.lastLight, settings.preset);
    }
  } catch {
    // Ignore storage failures
  }
}

export function loadReaderPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.readerPrefs);
    if (!raw) return DEFAULT_READER_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      fontSize:
        parsed.fontSize && [15, 17, 19, 21].includes(parsed.fontSize)
          ? parsed.fontSize
          : 17,
      fontFamily: parsed.fontFamily === 'serif' ? 'serif' : 'sans',
      width:
        parsed.width === 'narrow' || parsed.width === 'wide' ? parsed.width : 'standard',
    };
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export function saveReaderPrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEYS.readerPrefs, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures
  }
}
