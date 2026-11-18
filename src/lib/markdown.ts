import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export interface MarkdownHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64) || 'section';
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const lines = (markdown || '').split('\n');
  const headings: MarkdownHeading[] = [];
  const used = new Map<string, number>();

  for (const line of lines) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const rawText = match[2].replace(/[*_`[\]]/g, '').trim();
    if (!rawText) continue;
    const baseId = headingSlug(rawText);
    const count = used.get(baseId) || 0;
    used.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count}`;
    headings.push({ id, text: rawText, level });
  }

  return headings;
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown || '', { async: false }) as string;
  const used = new Map<string, number>();

  const withHeadingIds = rawHtml.replace(
    /<(h[23])>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, inner: string) => {
      const plain = inner.replace(/<[^>]+>/g, '').trim();
      const baseId = headingSlug(plain);
      const count = used.get(baseId) || 0;
      used.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      return `<${tag} id="${id}">${inner}</${tag}>`;
    }
  );

  return DOMPurify.sanitize(withHeadingIds, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'id'],
  });
}

export function formatEditorialDate(date: Date | null | undefined): string {
  if (!date) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return 'Just now';
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatEditorialDate(date);
}
