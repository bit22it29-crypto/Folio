import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Code2,
  Crown,
  Heart,
  Lock,
  MessageSquare,
  Pin,
  Rss,
} from 'lucide-react';
import { formatEditorialDate } from '../lib/markdown';
import type {
  AppRoute,
  Post,
  Publication,
  ReadingProgress,
  Subscription,
  UserProfile,
} from '../types/folio';
import { EditorialImage } from './EditorialImage';
import { PublicationChatPanel } from './PublicationChatPanel';

interface PublicationViewProps {
  publication: Publication;
  allPublications: Publication[];
  posts: Post[];
  subscription?: Subscription;
  subscribedPubIds: Set<string>;
  commentCounts: Map<string, number>;
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  readingProgressMap: Map<string, ReadingProgress>;
  user: User | null;
  profile: UserProfile | null;
  onNavigate: (route: AppRoute) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onOpenMembershipCheckout: (pub: Publication) => void;
  onToggleLike: (post: Post) => void;
  onToggleBookmark: (post: Post) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

export function PublicationView({
  publication,
  allPublications,
  posts,
  subscription,
  subscribedPubIds,
  commentCounts,
  likedPostIds,
  bookmarkedPostIds,
  readingProgressMap,
  user,
  profile,
  onNavigate,
  onToggleSubscribe,
  onOpenMembershipCheckout,
  onToggleLike,
  onToggleBookmark,
  onSignIn,
  onNotify,
}: PublicationViewProps) {
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [activeTab, setActiveTab] = useState<'archive' | 'chat'>('archive');

  const isSubscribed = Boolean(subscription);
  const isSupporting = subscription?.tier === 'supporting';

  const pinnedPost = publication.pinnedPostId
    ? posts.find((p) => p.id === publication.pinnedPostId)
    : undefined;
  const archivePosts = pinnedPost
    ? posts.filter((p) => p.id !== pinnedPost.id)
    : posts;

  const recommendedPubs = (publication.recommendedPubIds || [])
    .map((id) => allPublications.find((p) => p.id === id))
    .filter((p): p is Publication => Boolean(p && p.id !== publication.id));

  const handleCopyEmbed = async () => {
    const pubUrl = `${window.location.origin}/?pub=${encodeURIComponent(publication.slug)}`;
    const snippet = `<a href="${pubUrl}" style="display:inline-block;padding:10px 18px;background:#6D28D9;color:#ffffff;border-radius:8px;font-family:sans-serif;text-decoration:none;font-weight:600;">Subscribe to ${publication.name} on Folio</a>`;
    await navigator.clipboard.writeText(snippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <main className="max-w-[1080px] mx-auto px-4 sm:px-6 pb-24">
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

      {/* Publication Masthead */}
      <section className="p-6 sm:p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <span
              className="font-semibold"
              style={{ color: publication.accentColor || '#7C3AED' }}
            >
              {publication.category}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                onNavigate({ view: 'author', authorId: publication.ownerId })
              }
              className="hover:text-[var(--text-primary)] cursor-pointer"
            >
              By {publication.ownerName}
            </button>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-[var(--text-accent)]">
              {publication.subscriberCount.toLocaleString()} subscribers
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--text-primary)] headline-balance mb-3">
            {publication.name}
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-body)] leading-relaxed mb-4">
            {publication.tagline}
          </p>

          {publication.description && (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl mb-6">
              {publication.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleSubscribe(publication)}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isSubscribed
                  ? 'bg-[var(--bg-active-soft)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-[var(--accent-border)]'
                  : 'bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]'
              }`}
            >
              {isSubscribed ? 'Subscribed' : 'Subscribe Free'}
            </button>

            {isSupporting ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--accent-border)] bg-[var(--bg-active-soft)] text-[var(--text-accent)] whitespace-nowrap">
                <Crown className="w-4 h-4" />
                <span>Supporting Member</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onOpenMembershipCheckout(publication)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-[var(--accent-border)] rounded-lg bg-[var(--bg-canvas)] text-[var(--text-accent)] hover:bg-[var(--bg-active-soft)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade to Supporting ($7/mo)</span>
              </button>
            )}

            <a
              href={`/api/publications/${encodeURIComponent(publication.slug)}/rss.xml`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-canvas)] text-[var(--text-body)] hover:border-[var(--accent-border)] transition-colors whitespace-nowrap"
            >
              <Rss className="w-4 h-4 text-[var(--text-accent-soft)]" />
              <span>RSS Feed</span>
            </a>

            <button
              type="button"
              onClick={handleCopyEmbed}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-canvas)] text-[var(--text-body)] hover:border-[var(--accent-border)] transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedEmbed ? (
                <>
                  <Check className="w-4 h-4 text-[var(--text-success)]" />
                  <span>Copied Embed</span>
                </>
              ) : (
                <>
                  <Code2 className="w-4 h-4 text-[var(--text-accent-soft)]" />
                  <span>Copy Embed</span>
                </>
              )}
            </button>
          </div>
        </div>

        {publication.coverImageUrl && (
          <div className="md:col-span-4 aspect-[4/3] rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
            <EditorialImage
              src={publication.coverImageUrl}
              alt={publication.name}
              fallbackTitle={publication.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </section>

      {/* Publication Section Switcher */}
      <div className="mt-8 border-b border-[var(--border-hairline)] flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'archive'
              ? 'border-[var(--accent-solid)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Published Archive
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'chat'
              ? 'border-[var(--accent-solid)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-[var(--text-accent-soft)]" />
          <span>Subscriber Chat</span>
        </button>
      </div>

      {activeTab === 'chat' ? (
        <PublicationChatPanel
          publication={publication}
          subscription={subscription}
          user={user}
          profile={profile}
          onNavigate={onNavigate}
          onToggleSubscribe={onToggleSubscribe}
          onOpenMembershipCheckout={onOpenMembershipCheckout}
          onSignIn={onSignIn}
          onNotify={onNotify}
        />
      ) : (
        <>
          {/* Pinned Featured Issue */}
          {pinnedPost && (
        <section className="mt-8 p-6 rounded-2xl border border-[var(--accent-border)]/60 bg-[var(--bg-surface)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-accent)] mb-2">
              <Pin className="w-3.5 h-3.5" />
              <span>Pinned by Editor</span>
              <span className="text-[var(--text-muted)] font-normal">
                · {formatEditorialDate(pinnedPost.publishedAt || pinnedPost.createdAt)} ·{' '}
                {pinnedPost.readTimeMinutes} min read
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] leading-snug mb-2">
              <button
                type="button"
                onClick={() => onNavigate({ view: 'post', postId: pinnedPost.id })}
                className="text-left hover:text-[var(--text-accent)] transition-colors cursor-pointer"
              >
                {pinnedPost.title}
              </button>
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              {pinnedPost.subtitle || pinnedPost.excerpt}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate({ view: 'post', postId: pinnedPost.id })}
                className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Read Pinned Issue
              </button>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{commentCounts.get(pinnedPost.id) || 0}</span>
              </span>
              {pinnedPost.tags &&
                pinnedPost.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onNavigate({ view: 'topic', tag: t })}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] cursor-pointer"
                  >
                    #{t}
                  </button>
                ))}
            </div>
          </div>

          {pinnedPost.coverImageUrl && (
            <button
              type="button"
              onClick={() => onNavigate({ view: 'post', postId: pinnedPost.id })}
              className="w-full md:w-56 aspect-[4/3] rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-canvas)] shrink-0 cursor-pointer"
            >
              <EditorialImage
                src={pinnedPost.coverImageUrl}
                alt={pinnedPost.title}
                fallbackTitle={pinnedPost.title}
                className="w-full h-full object-cover"
              />
            </button>
          )}
        </section>
      )}

      {/* Publication Issues Archive */}
      <section className="pt-10">
        <div className="flex items-baseline justify-between pb-4 border-b border-[var(--border-hairline)]">
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Published Archive
          </h2>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {posts.length} {posts.length === 1 ? 'issue' : 'issues'}
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No issues have been published in {publication.name} yet.
            </p>
          </div>
        ) : archivePosts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8">
            All published issues are featured above.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {archivePosts.map((post) => {
              const prog = readingProgressMap.get(post.id);
              const commentsCount = commentCounts.get(post.id) || 0;
              return (
                <article
                  key={post.id}
                  className="py-7 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
                      <span>{formatEditorialDate(post.publishedAt || post.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.readTimeMinutes} min read</span>
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
                          <span className="inline-flex items-center gap-1 text-[var(--text-accent)]">
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

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                      {post.subtitle || post.excerpt}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] tabular-nums">
                      <button
                        type="button"
                        onClick={() => onNavigate({ view: 'post', postId: post.id })}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                      >
                        Read Issue
                      </button>
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
                        onClick={() => onNavigate({ view: 'post', postId: post.id })}
                        aria-label={`${commentsCount} comments`}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{commentsCount}</span>
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
                      {post.tags &&
                        post.tags.slice(0, 3).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onNavigate({ view: 'topic', tag: t })}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] cursor-pointer"
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
                      className="w-full sm:w-48 aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 cursor-pointer"
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
      </section>
        </>
      )}

      {/* Recommended Publications Cross-Promotion */}
      {recommendedPubs.length > 0 && (
        <section className="mt-12 pt-8 border-t border-[var(--border-hairline)]">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Recommended by {publication.name}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Independent publications endorsed by {publication.ownerName}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendedPubs.map((rec) => {
              const isRecSubscribed = subscribedPubIds.has(rec.id);
              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[11px] font-semibold mb-1"
                      style={{ color: rec.accentColor || '#7C3AED' }}
                    >
                      {rec.category}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ view: 'publication', slug: rec.slug })
                      }
                      className="font-display text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] text-left cursor-pointer block truncate w-full"
                    >
                      {rec.name}
                    </button>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 mb-2">
                      {rec.tagline}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      By {rec.ownerName} · {rec.subscriberCount.toLocaleString()} subscribers
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(rec)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isRecSubscribed
                        ? 'bg-[var(--bg-active-soft)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-[var(--accent-border)]'
                        : 'bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {isRecSubscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
