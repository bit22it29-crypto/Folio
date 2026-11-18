import { CATEGORIES, type Category } from '../types/folio';

export const LIMITS = {
  idMax: 128,
  displayNameMax: 80,
  handleMax: 40,
  bioMax: 320,
  urlMax: 500,
  pubSlugMax: 64,
  pubNameMax: 80,
  pubTaglineMax: 160,
  pubDescMax: 1000,
  welcomeNoteMax: 500,
  postTitleMax: 160,
  postSubtitleMax: 240,
  postSlugMax: 120,
  postContentMax: 60000,
  postExcerptMax: 360,
  tagMax: 28,
  tagsCountMax: 5,
  commentBodyMax: 2000,
  noteBodyMax: 600,
  highlightQuoteMax: 600,
  highlightNoteMax: 600,
  revisionSummaryMax: 120,
  notifTitleMax: 160,
  notifBodyMax: 320,
} as const;

export const PATTERNS = {
  id: /^[a-zA-Z0-9_\-]+$/,
  handle: /^[a-z0-9_\-]+$/,
  slug: /^[a-z0-9\-]+$/,
  hexColor: /^#[0-9A-Fa-f]{6}$/,
} as const;

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function slugify(input: string, maxLen = 64): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const fallback = base.length >= 2 ? base : `item-${Date.now().toString(36)}`;
  return fallback.slice(0, maxLen).replace(/-+$/g, '') || 'folio-item';
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of tags) {
    const tag = raw
      .toLowerCase()
      .trim()
      .replace(/^#+/, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, LIMITS.tagMax);
    if (tag.length >= 1 && !seen.has(tag)) {
      seen.add(tag);
      clean.push(tag);
    }
    if (clean.length >= LIMITS.tagsCountMax) break;
  }
  return clean;
}

export function makeHandle(input: string, uidSuffix: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 28);
  const clean = base.length >= 2 ? base : 'writer';
  return `${clean}-${uidSuffix.slice(0, 6).toLowerCase()}`.slice(0, LIMITS.handleMax);
}

export function makeSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, LIMITS.idMax);
}

export function normalizeCategory(cat: string): Category {
  return (CATEGORIES as string[]).includes(cat) ? (cat as Category) : 'Essays';
}

export function normalizeAccentColor(color: string): string {
  return PATTERNS.hexColor.test(color) ? color : '#7C3AED';
}

export function estimateReadTimeMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(180, Math.ceil(words / 220)));
}

export function buildExcerpt(markdown: string, fallback = ''): string {
  const stripped = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const source = stripped || fallback.trim();
  if (source.length <= 240) return source;
  return `${source.slice(0, 237).trimEnd()}...`;
}
