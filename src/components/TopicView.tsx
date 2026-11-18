import { useMemo } from 'react';
import { ArrowLeft, Bookmark, Hash, Heart, Lock } from 'lucide-react';
import { formatEditorialDate } from '../lib/markdown';
import type { AppRoute, Post } from '../types/folio';
import { EditorialImage } from './EditorialImage';

interface TopicViewProps {
  tag: string;
  posts: Post[];
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  onNavigate: (route: AppRoute) => void;
  onToggleLike: (post: Post) => void;
  onToggleBookmark: (post: Post) => void;
}

export function TopicView({
  tag,
  posts,
  likedPostIds,
  bookmarkedPostIds,
  onNavigate,
  onToggleLike,
  onToggleBookmark,
}: TopicViewProps) {
  const normalizedTag = tag.toLowerCase();

  const matchingPosts = useMemo(
    () =>
      posts.filter((p) =>
        (p.tags || []).some((t) => t.toLowerCase() === normalizedTag)
      ),
    [posts, normalizedTag]
  );

  const relatedTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        if (t.toLowerCase() !== normalizedTag) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [posts, normalizedTag]);

  return (
    <main className="max-w-[1040px] mx-auto px-4 sm:px-6 pb-24">
      <div className="pt-6 pb-4">
        <button
          type="button"
          onClick={() => onNavigate({ view: 'explore' })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dispatches</span>
        </button>
      </div>

      <header className="p-6 sm:p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] mb-10">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-accent-soft)] mb-2">
          <Hash className="w-3.5 h-3.5" />
          <span>Topic Index</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] mb-2">
          #{normalizedTag}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] tabular-nums">
          {matchingPosts.length}{' '}
          {matchingPosts.length === 1 ? 'essay' : 'essays'} tagged across independent Folio publications.
        </p>

        {relatedTags.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] mr-1">Related topics:</span>
            {relatedTags.map(([otherTag, count]) => (
              <button
                key={otherTag}
                type="button"
                onClick={() => onNavigate({ view: 'topic', tag: otherTag })}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[#8B5CF6] hover:text-[var(--text-primary)] transition-colors cursor-pointer tabular-nums"
              >
                #{otherTag} ({count})
              </button>
            ))}
          </div>
        )}
      </header>

      {matchingPosts.length === 0 ? (
        <div className="p-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            No published essays currently carry #{normalizedTag}.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'explore' })}
            className="px-4 py-2 text-xs font-medium bg-[#6D28D9] text-white rounded-lg cursor-pointer"
          >
            Browse All Dispatches
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-hairline)]">
          {matchingPosts.map((post) => (
            <article
              key={post.id}
              className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'publication', slug: post.publicationSlug })
                    }
                    className="font-semibold text-[var(--text-accent)] hover:underline cursor-pointer"
                  >
                    {post.publicationName}
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'author', authorId: post.authorId })
                    }
                    className="hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {post.authorName}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span>{formatEditorialDate(post.publishedAt || post.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.readTimeMinutes} min read</span>
                  {post.accessTier === 'subscribers' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[var(--text-accent-soft)]">
                        <Lock className="w-3 h-3" />
                        Subscribers
                      </span>
                    </>
                  )}
                </div>

                <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] leading-snug mb-2">
                  <button
                    type="button"
                    onClick={() => onNavigate({ view: 'post', postId: post.id })}
                    className="text-left hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                  >
                    {post.title}
                  </button>
                </h2>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-3">
                  {post.subtitle || post.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] tabular-nums">
                  <button
                    type="button"
                    onClick={() => onToggleLike(post)}
                    className={`inline-flex items-center gap-1 cursor-pointer ${
                      likedPostIds.has(post.id) ? 'text-[var(--text-accent)] font-medium' : ''
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        likedPostIds.has(post.id) ? 'fill-current' : ''
                      }`}
                    />
                    <span>{post.likesCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(post)}
                    className={`inline-flex items-center gap-1 cursor-pointer ${
                      bookmarkedPostIds.has(post.id) ? 'text-[var(--text-accent)] font-medium' : ''
                    }`}
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        bookmarkedPostIds.has(post.id) ? 'fill-current' : ''
                      }`}
                    />
                    <span>{bookmarkedPostIds.has(post.id) ? 'Saved' : 'Save'}</span>
                  </button>
                  {(post.tags || []).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onNavigate({ view: 'topic', tag: t })}
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                        t.toLowerCase() === normalizedTag
                          ? 'border-[#8B5CF6] bg-[var(--bg-active-soft)] text-[var(--text-accent)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#8B5CF6]'
                      }`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>

              {post.coverImageUrl && (
                <button
                  type="button"
                  onClick={() => onNavigate({ view: 'post', postId: post.id })}
                  className="w-full sm:w-40 aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 cursor-pointer"
                >
                  <EditorialImage
                    src={post.coverImageUrl}
                    alt={post.title}
                    fallbackTitle={post.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
