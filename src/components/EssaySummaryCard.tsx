import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react';

interface EssaySummaryCardProps {
  postId: string;
  title: string;
  subtitle: string;
  authorName: string;
  contentMarkdown: string;
  isPaywalled: boolean;
}

export function EssaySummaryCard({
  postId,
  title,
  subtitle,
  authorName,
  contentMarkdown,
  isPaywalled,
}: EssaySummaryCardProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const cacheKey = `folio-ai-summary:${postId}:${isPaywalled ? 'preview' : 'full'}`;

  useEffect(() => {
    setError(null);
    setCollapsed(false);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      setSummary(cached || '');
    } catch {
      setSummary('');
    }
  }, [cacheKey]);

  const fetchSummary = useCallback(
    async (forceRefresh = false) => {
      if (contentMarkdown.trim().length < 40) return;

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setSummary(cached);
            setError(null);
            return;
          }
        } catch {
          // Ignore sessionStorage access errors
        }
      }

      setLoading(true);
      setError(null);
      setCollapsed(false);

      try {
        const res = await fetch('/api/essays/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            title,
            subtitle,
            authorName,
            contentMarkdown,
            forceRefresh,
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          summary?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(payload.error || 'Could not generate essay summary.');
        }

        const text = (payload.summary || '').trim();
        if (!text) {
          throw new Error('Summary response was empty.');
        }

        setSummary(text);
        try {
          sessionStorage.setItem(cacheKey, text);
        } catch {
          // Ignore sessionStorage quota errors
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to generate essay summary.'
        );
      } finally {
        setLoading(false);
      }
    },
    [authorName, cacheKey, contentMarkdown, postId, subtitle, title]
  );

  if (contentMarkdown.trim().length < 40) {
    return null;
  }

  return (
    <section
      aria-label="Essay AI Summary"
      className="mb-8 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[var(--text-accent)] shrink-0" />
          <span className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">
            In Brief
          </span>
          <span aria-hidden="true" className="text-[var(--text-muted)] text-xs">
            ·
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate">
            {isPaywalled ? 'Preview Summary' : 'One-Paragraph AI Summary'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!summary && !loading && (
            <button
              type="button"
              onClick={() => void fetchSummary(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-border)] bg-[var(--bg-canvas)] text-[var(--text-accent)] hover:bg-[var(--bg-active-soft)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate AI Summary</span>
            </button>
          )}
          {summary && (
            <>
              <button
                type="button"
                onClick={() => void fetchSummary(true)}
                disabled={loading}
                title="Regenerate summary"
                aria-label="Regenerate AI summary"
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Expand AI summary' : 'Collapse AI summary'}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] transition-colors cursor-pointer"
              >
                {collapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {!collapsed && (loading || error || summary) && (
        <div className="mt-3">
          {loading ? (
            <div className="space-y-2 py-0.5" aria-busy="true" aria-label="Generating essay summary">
              <div className="h-3.5 w-full rounded bg-[var(--bg-surface-alt)] animate-pulse" />
              <div className="h-3.5 w-11/12 rounded bg-[var(--bg-surface-alt)] animate-pulse" />
              <div className="h-3.5 w-4/6 rounded bg-[var(--bg-surface-alt)] animate-pulse" />
            </div>
          ) : error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void fetchSummary(true)}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:border-[var(--accent-border)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : summary ? (
            <p className="text-sm sm:text-[15px] leading-relaxed text-[var(--text-body)]">
              {summary}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
