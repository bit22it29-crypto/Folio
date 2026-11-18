import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, Heart, Lock, Search } from 'lucide-react';
import { formatEditorialDate, formatRelativeTime } from '../lib/markdown';
import {
  CATEGORIES,
  type AppRoute,
  type Category,
  type Note,
  type Post,
  type Publication,
  type ReadingProgress,
  type Subscription,
} from '../types/folio';
import { EditorialImage } from './EditorialImage';

interface ExploreFrontPageProps {
  posts: Post[];
  publications: Publication[];
  notes: Note[];
  subscriptions: Subscription[];
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  readingProgressMap: Map<string, ReadingProgress>;
  onNavigate: (route: AppRoute) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onToggleLike: (post: Post) => void;
  onToggleBookmark: (post: Post) => void;
}

export function ExploreFrontPage({
  posts,
  publications,
  notes,
  subscriptions,
  likedPostIds,
  bookmarkedPostIds,
  readingProgressMap,
  onNavigate,
  onToggleSubscribe,
  onToggleLike,
  onToggleBookmark,
}: ExploreFrontPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'featured' | 'latest' | 'subscribers'>('featured');

  const subMap = useMemo(() => {
    const map = new Map<string, Subscription>();
    subscriptions.forEach((s) => map.set(s.publicationId, s));
    return map;
  }, [subscriptions]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = posts.filter((post) => {
      const catMatch = selectedCategory === 'All' || post.category === selectedCategory;
      if (!catMatch) return false;
      if (sortMode === 'subscribers' && post.accessTier !== 'subscribers') return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.subtitle.toLowerCase().includes(q) ||
        post.publicationName.toLowerCase().includes(q) ||
        post.authorName.toLowerCase().includes(q) ||
        (post.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    if (sortMode === 'featured') {
      return [...matched].sort((a, b) => {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
        return (
          ((b.publishedAt || b.createdAt)?.getTime() || 0) -
          ((a.publishedAt || a.createdAt)?.getTime() || 0)
        );
      });
    }
    return [...matched].sort(
      (a, b) =>
        ((b.publishedAt || b.createdAt)?.getTime() || 0) -
        ((a.publishedAt || a.createdAt)?.getTime() || 0)
    );
  }, [posts, selectedCategory, searchQuery, sortMode]);

  const featuredPublications = useMemo(() => {
    return [...publications]
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, 4);
  }, [publications]);

  const leadPost = filteredPosts[0];
  const indexPosts = filteredPosts.slice(1, 4);
  const archivePosts = filteredPosts.length > 4 ? filteredPosts.slice(4) : filteredPosts;

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-24">
      {/* Section 1: Asymmetric Monograph Split (Lead Hero + Numbered Dispatch Index) */}
      {leadPost && (
        <section className="pt-8 pb-10 border-b border-[var(--border-hairline)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 7 Columns: Scrimmed Visual Lead Monograph (always dark-scrimmed for photo legibility) */}
            <article className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[#14121D] min-h-[440px] flex flex-col justify-end group">
              <div className="absolute inset-0">
                <EditorialImage
                  src={leadPost.coverImageUrl}
                  alt={leadPost.title}
                  fallbackTitle={leadPost.title}
                  className="w-full h-full object-cover opacity-75 group-hover:scale-[1.02] transition-transform duration-500"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/75 to-[#09090D]/20"
                  aria-hidden="true"
                />
              </div>

              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#C4B5FD] mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        view: 'publication',
                        slug: leadPost.publicationSlug,
                      })
                    }
                    className="font-semibold hover:underline cursor-pointer"
                  >
                    {leadPost.publicationName}
                  </button>
                  <span className="text-[#8B85A1]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#D8D4E8]">{leadPost.category}</span>
                  <span className="text-[#8B85A1]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#B8B4C7]">
                    {formatEditorialDate(leadPost.publishedAt || leadPost.createdAt)}
                  </span>
                  <span className="text-[#8B85A1]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#B8B4C7]">{leadPost.readTimeMinutes} min read</span>
                </div>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold leading-[1.12] tracking-tight text-white headline-balance mb-3">
                  <button
                    type="button"
                    onClick={() => onNavigate({ view: 'post', postId: leadPost.id })}
                    className="text-left hover:text-[#DDD6FE] transition-colors cursor-pointer"
                  >
                    {leadPost.title}
                  </button>
                </h1>

                <p className="text-sm sm:text-base text-[#D8D4E8] leading-relaxed max-w-2xl mb-4 line-clamp-2">
                  {leadPost.subtitle || leadPost.excerpt}
                </p>

                {leadPost.tags && leadPost.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-5">
                    {leadPost.tags.slice(0, 4).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onNavigate({ view: 'topic', tag: t })}
                        className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-white/15 bg-black/40 text-[#DDD6FE] hover:border-[#A78BFA] cursor-pointer"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'author', authorId: leadPost.authorId })
                    }
                    className="text-xs sm:text-sm text-[#D8D4E8] hover:text-white cursor-pointer"
                  >
                    By <strong className="font-semibold text-white">{leadPost.authorName}</strong>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(leadPost)}
                      aria-label={`Save ${leadPost.title}`}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        bookmarkedPostIds.has(leadPost.id)
                          ? 'border-[#8B5CF6] bg-[#6D28D9]/30 text-[#DDD6FE]'
                          : 'border-white/20 bg-[#09090D]/60 text-[#E4E1EF] hover:border-[#A78BFA]'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          bookmarkedPostIds.has(leadPost.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleLike(leadPost)}
                      aria-label={`Like ${leadPost.title}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer tabular-nums ${
                        likedPostIds.has(leadPost.id)
                          ? 'border-[#8B5CF6] bg-[#6D28D9]/30 text-[#DDD6FE]'
                          : 'border-white/20 bg-[#09090D]/60 text-[#E4E1EF] hover:border-[#A78BFA]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          likedPostIds.has(leadPost.id) ? 'fill-current' : ''
                        }`}
                      />
                      <span>{leadPost.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate({ view: 'post', postId: leadPost.id })}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>
                        {(readingProgressMap.get(leadPost.id)?.percent || 0) >= 5 &&
                        (readingProgressMap.get(leadPost.id)?.percent || 0) < 95
                          ? `Resume (${readingProgressMap.get(leadPost.id)!.percent}%)`
                          : 'Read Issue'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>

            {/* Right 5 Columns: Numbered Editorial Index */}
            <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-baseline justify-between pb-4 border-b border-[var(--border-hairline)] mb-2">
                  <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                    Current Edition
                  </h2>
                  <span className="text-xs text-[var(--text-accent-soft)] tabular-nums">
                    {filteredPosts.length} {filteredPosts.length === 1 ? 'issue' : 'issues'}
                  </span>
                </div>

                {indexPosts.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-8">
                    Additional dispatches matching your filter appear in the archive below.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {indexPosts.map((post, idx) => {
                      const prog = readingProgressMap.get(post.id);
                      return (
                        <article key={post.id} className="py-4 flex items-start gap-4">
                          <span className="font-mono text-xs text-[var(--text-accent-soft)] pt-1 tabular-nums shrink-0">
                            {String(idx + 2).padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate({
                                    view: 'publication',
                                    slug: post.publicationSlug,
                                  })
                                }
                                className="font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
                              >
                                {post.publicationName}
                              </button>
                              <span aria-hidden="true">·</span>
                              <span>{post.readTimeMinutes} min</span>
                              {prog && prog.percent >= 5 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[var(--text-accent-soft)] tabular-nums">
                                    {prog.percent >= 95 ? 'Finished' : `${prog.percent}% read`}
                                  </span>
                                </>
                              )}
                              {post.accessTier === 'subscribers' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 text-[var(--text-accent-soft)]">
                                    <Lock className="w-3 h-3" aria-hidden="true" />
                                    Subscribers
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1">
                              <button
                                type="button"
                                onClick={() => onNavigate({ view: 'post', postId: post.id })}
                                className="text-left hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                              >
                                {post.title}
                              </button>
                            </h3>

                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                              {post.subtitle || post.excerpt}
                            </p>
                          </div>

                          {post.coverImageUrl && (
                            <button
                              type="button"
                              onClick={() => onNavigate({ view: 'post', postId: post.id })}
                              className="w-20 aspect-square rounded-lg overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface-alt)] shrink-0 cursor-pointer"
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
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Independent writers & subscriber editions</span>
                <button
                  type="button"
                  onClick={() => onNavigate({ view: 'studio' })}
                  className="font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
                >
                  Open Studio
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section 2: 4-Column Independent Publications Strip */}
      <section className="py-10 border-b border-[var(--border-hairline)]">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Featured Publications
          </h2>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {publications.length} active publications
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredPublications.map((pub) => {
            const isSub = subMap.has(pub.id);
            return (
              <div
                key={pub.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#8B5CF6] transition-colors"
              >
                <div>
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: pub.accentColor || '#7C3AED' }}
                  />
                  <div className="p-5">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                      <span>{pub.category}</span>
                      <span className="tabular-nums text-[var(--text-accent)]">
                        {pub.subscriberCount.toLocaleString()} readers
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ view: 'publication', slug: pub.slug })
                      }
                      className="font-display text-xl font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] transition-colors text-left cursor-pointer block mb-2"
                    >
                      {pub.name}
                    </button>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                      {pub.tagline}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-alt)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'author', authorId: pub.ownerId })
                    }
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] truncate cursor-pointer"
                  >
                    {pub.ownerName}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(pub)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSub
                        ? 'bg-[var(--bg-active-soft)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-[#8B5CF6]'
                        : 'bg-[#6D28D9] text-white hover:bg-[#7C3AED]'
                    }`}
                  >
                    {isSub ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Interactive Discovery Toolbar */}
      <section className="py-6 border-b border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
          role="tablist"
          aria-label="Filter by topic"
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-[#6D28D9] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            All Topics
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === category
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter issues, #tags, writers..."
              aria-label="Filter issues, tags, or writers"
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#8B5CF6] transition-colors"
            />
          </div>

          <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setSortMode('featured')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sortMode === 'featured'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Featured
            </button>
            <button
              type="button"
              onClick={() => setSortMode('latest')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sortMode === 'latest'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Latest
            </button>
            <button
              type="button"
              onClick={() => setSortMode('subscribers')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sortMode === 'subscribers'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Subscribers
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Archive & Salon Marginalia */}
      {filteredPosts.length === 0 ? (
        <section className="py-20 text-center">
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
            No matching issues found
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Try clearing your search filter or switching to another topic.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
              setSortMode('featured');
            }}
            className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </section>
      ) : (
        <section className="pt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8">
            <div className="flex items-baseline justify-between pb-4 border-b border-[var(--border-hairline)]">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Archive Dispatches
              </h2>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {archivePosts.length} {archivePosts.length === 1 ? 'essay' : 'essays'}
              </span>
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {archivePosts.map((post) => {
                const prog = readingProgressMap.get(post.id);
                return (
                  <article
                    key={`archive-${post.id}`}
                    className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              view: 'publication',
                              slug: post.publicationSlug,
                            })
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
                        {prog && prog.percent >= 5 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[var(--text-accent-soft)] tabular-nums">
                              {prog.percent >= 95 ? 'Finished' : `${prog.percent}% read`}
                            </span>
                          </>
                        )}
                        {post.accessTier === 'subscribers' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[var(--text-accent-soft)]">
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              Subscribers
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-2xl font-semibold text-[var(--text-primary)] leading-snug mb-2">
                        <button
                          type="button"
                          onClick={() => onNavigate({ view: 'post', postId: post.id })}
                          className="text-left hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                        >
                          {post.title}
                        </button>
                      </h3>

                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-3">
                        {post.subtitle || post.excerpt}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] tabular-nums">
                        <span>{post.category}</span>
                        <span>{post.readTimeMinutes} min read</span>
                        <button
                          type="button"
                          onClick={() => onToggleLike(post)}
                          className={`inline-flex items-center gap-1 cursor-pointer ${
                            likedPostIds.has(post.id)
                              ? 'text-[var(--text-accent)] font-medium'
                              : 'hover:text-[var(--text-primary)]'
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
                            bookmarkedPostIds.has(post.id)
                              ? 'text-[var(--text-accent)] font-medium'
                              : 'hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              bookmarkedPostIds.has(post.id) ? 'fill-current' : ''
                            }`}
                          />
                          <span>{bookmarkedPostIds.has(post.id) ? 'Saved' : 'Save'}</span>
                        </button>
                        {post.tags &&
                          post.tags.slice(0, 3).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onNavigate({ view: 'topic', tag: t })}
                              className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#8B5CF6] hover:text-[var(--text-primary)] cursor-pointer"
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
                        className="w-full sm:w-40 aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-hairline)] shrink-0 bg-[var(--bg-surface)] cursor-pointer"
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
                );
              })}
            </div>
          </div>

          {/* Right Rail: Salon Notes */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)] mb-4">
                <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                  Salon Marginalia
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate({ view: 'notes' })}
                  className="text-xs font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
                >
                  View Salon
                </button>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                {notes.slice(0, 4).map((note) => (
                  <div key={note.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ view: 'author', authorId: note.authorId })
                        }
                        className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                      >
                        {note.authorName}
                      </button>
                      <span>{formatRelativeTime(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--text-body)] leading-relaxed line-clamp-3">
                      {note.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
