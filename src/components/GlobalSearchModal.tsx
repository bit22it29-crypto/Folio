import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Hash, MessageSquareQuote, Search, User as UserIcon, X } from 'lucide-react';
import type { AppRoute, Note, Post, Publication } from '../types/folio';

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  posts: Post[];
  publications: Publication[];
  notes: Note[];
  onNavigate: (route: AppRoute) => void;
}

interface SearchHit {
  key: string;
  kind: 'post' | 'publication' | 'tag' | 'author' | 'note';
  title: string;
  subtitle: string;
  route: AppRoute;
}

export function GlobalSearchModal({
  open,
  onClose,
  posts,
  publications,
  notes,
  onNavigate,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  const allAuthors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; pubCount: number }>();
    publications.forEach((p) => {
      const prev = map.get(p.ownerId);
      map.set(p.ownerId, {
        id: p.ownerId,
        name: p.ownerName,
        pubCount: (prev?.pubCount || 0) + 1,
      });
    });
    posts.forEach((p) => {
      if (!map.has(p.authorId)) {
        map.set(p.authorId, { id: p.authorId, name: p.authorName, pubCount: 0 });
      }
    });
    return Array.from(map.values());
  }, [publications, posts]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SearchHit[] = [];

    if (!q) {
      posts.slice(0, 4).forEach((p) =>
        list.push({
          key: `post-${p.id}`,
          kind: 'post',
          title: p.title,
          subtitle: `${p.publicationName} · ${p.readTimeMinutes} min read`,
          route: { view: 'post', postId: p.id },
        })
      );
      publications.slice(0, 3).forEach((pub) =>
        list.push({
          key: `pub-${pub.id}`,
          kind: 'publication',
          title: pub.name,
          subtitle: `${pub.category} · ${pub.subscriberCount.toLocaleString()} readers`,
          route: { view: 'publication', slug: pub.slug },
        })
      );
      allTags.slice(0, 4).forEach((t) =>
        list.push({
          key: `tag-${t.tag}`,
          kind: 'tag',
          title: `#${t.tag}`,
          subtitle: `${t.count} ${t.count === 1 ? 'essay' : 'essays'}`,
          route: { view: 'topic', tag: t.tag },
        })
      );
      return list;
    }

    posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.publicationName.toLowerCase().includes(q) ||
          p.authorName.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 6)
      .forEach((p) =>
        list.push({
          key: `post-${p.id}`,
          kind: 'post',
          title: p.title,
          subtitle: `${p.publicationName} · By ${p.authorName}`,
          route: { view: 'post', postId: p.id },
        })
      );

    publications
      .filter(
        (pub) =>
          pub.name.toLowerCase().includes(q) ||
          pub.tagline.toLowerCase().includes(q) ||
          pub.category.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .forEach((pub) =>
        list.push({
          key: `pub-${pub.id}`,
          kind: 'publication',
          title: pub.name,
          subtitle: pub.tagline,
          route: { view: 'publication', slug: pub.slug },
        })
      );

    allTags
      .filter((t) => t.tag.includes(q.replace(/^#/, '')))
      .slice(0, 4)
      .forEach((t) =>
        list.push({
          key: `tag-${t.tag}`,
          kind: 'tag',
          title: `#${t.tag}`,
          subtitle: `Topic archive · ${t.count} ${t.count === 1 ? 'issue' : 'issues'}`,
          route: { view: 'topic', tag: t.tag },
        })
      );

    allAuthors
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((a) =>
        list.push({
          key: `author-${a.id}`,
          kind: 'author',
          title: a.name,
          subtitle: a.pubCount > 0 ? `${a.pubCount} publication(s)` : 'Writer on Folio',
          route: { view: 'author', authorId: a.id },
        })
      );

    notes
      .filter(
        (n) =>
          n.body.toLowerCase().includes(q) ||
          n.authorName.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((n) =>
        list.push({
          key: `note-${n.id}`,
          kind: 'note',
          title: `${n.authorName} in Salon`,
          subtitle: n.body,
          route: { view: 'notes' },
        })
      );

    return list;
  }, [query, posts, publications, allTags, allAuthors, notes]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [hits.length, query]);

  if (!open) return null;

  const chooseHit = (hit: SearchHit) => {
    onClose();
    onNavigate(hit.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (hits.length > 0 ? (prev + 1) % hits.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        hits.length > 0 ? (prev - 1 + hits.length) % hits.length : 0
      );
      return;
    }
    if (e.key === 'Enter' && hits[selectedIndex]) {
      e.preventDefault();
      chooseHit(hits[selectedIndex]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-hairline)]">
          <Search className="w-4 h-4 text-[var(--text-accent-soft)] shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search essays, publications, #topics, writers, or Salon notes..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-muted)] border border-[var(--border-hairline)] rounded">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {hits.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              No essays, publications, tags, or notes matched “{query}”.
            </div>
          ) : (
            hits.map((hit, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={hit.key}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => chooseHit(hit)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--bg-active-soft)]'
                      : 'hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 text-[var(--text-accent-soft)] shrink-0">
                      {hit.kind === 'post' && <BookOpen className="w-4 h-4" />}
                      {hit.kind === 'publication' && <BookOpen className="w-4 h-4" />}
                      {hit.kind === 'tag' && <Hash className="w-4 h-4" />}
                      {hit.kind === 'author' && <UserIcon className="w-4 h-4" />}
                      {hit.kind === 'note' && <MessageSquareQuote className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {hit.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {hit.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {hit.kind}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-alt)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Use ↑↓ arrows and Enter to jump directly</span>
          <span className="font-mono">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
