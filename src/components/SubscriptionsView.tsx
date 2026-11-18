import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Bookmark as BookmarkIcon, Crown, Highlighter, Lock, Trash2 } from 'lucide-react';
import {
  getUserDigestFrequency,
  updateSubscriptionTier,
  updateUserDigestFrequency,
} from '../lib/firestoreService';
import { formatEditorialDate } from '../lib/markdown';
import type {
  AppRoute,
  Bookmark,
  DigestFrequency,
  Highlight,
  Post,
  Publication,
  ReadingProgress,
  Subscription,
} from '../types/folio';
import { EditorialImage } from './EditorialImage';

interface SubscriptionsViewProps {
  user: User | null;
  subscriptions: Subscription[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  readingProgressMap: Map<string, ReadingProgress>;
  publications: Publication[];
  posts: Post[];
  onNavigate: (route: AppRoute) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onOpenMembershipCheckout: (pub: Publication) => void;
  onToggleBookmark: (post: Post) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

export function SubscriptionsView({
  user,
  subscriptions,
  bookmarks,
  highlights,
  readingProgressMap,
  publications,
  posts,
  onNavigate,
  onToggleSubscribe,
  onOpenMembershipCheckout,
  onToggleBookmark,
  onDeleteHighlight,
  onSignIn,
  onNotify,
}: SubscriptionsViewProps) {
  const [tab, setTab] = useState<'inbox' | 'saved' | 'highlights' | 'manage'>('inbox');
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('immediate');
  const [savingDigest, setSavingDigest] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getUserDigestFrequency(user.uid).then(setDigestFrequency);
  }, [user]);

  const pubMap = useMemo(() => {
    const map = new Map<string, Publication>();
    publications.forEach((p) => map.set(p.id, p));
    return map;
  }, [publications]);

  const postMap = useMemo(() => {
    const map = new Map<string, Post>();
    posts.forEach((p) => map.set(p.id, p));
    return map;
  }, [posts]);

  const inboxPosts = useMemo(() => {
    const subPubIds = new Set(subscriptions.map((s) => s.publicationId));
    return posts.filter((p) => subPubIds.has(p.publicationId));
  }, [posts, subscriptions]);

  const handleDigestChange = async (next: DigestFrequency) => {
    if (!user) return;
    setDigestFrequency(next);
    setSavingDigest(true);
    try {
      await updateUserDigestFrequency(user.uid, next);
      onNotify(`Delivery cadence updated to ${next}.`);
    } finally {
      setSavingDigest(false);
    }
  };

  if (!user) {
    return (
      <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] mb-3">
          Your Reading Library
        </h1>
        <p className="text-base text-[var(--text-secondary)] max-w-md mx-auto mb-8 leading-relaxed">
          Sign in with Google to subscribe to independent publications, bookmark essays, save inline highlights, and read every issue in one calm inbox.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-5 py-2.5 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
        >
          Sign In with Google
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-10 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--border-hairline)] mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] mb-1">
            Library
          </h1>
          <p className="text-sm text-[var(--text-muted)] tabular-nums">
            Following {subscriptions.length}{' '}
            {subscriptions.length === 1 ? 'publication' : 'publications'} ·{' '}
            {bookmarks.length} saved · {highlights.length}{' '}
            {highlights.length === 1 ? 'highlight' : 'highlights'}
          </p>
        </div>

        <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('inbox')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'inbox'
                ? 'bg-[#6D28D9] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Reading Inbox
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              tab === 'saved'
                ? 'bg-[#6D28D9] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Saved ({bookmarks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('highlights')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              tab === 'highlights'
                ? 'bg-[#6D28D9] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Highlights ({highlights.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('manage')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              tab === 'manage'
                ? 'bg-[#6D28D9] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Manage ({subscriptions.length})
          </button>
        </div>
      </div>

      {tab === 'manage' && (
        <section className="mb-8 p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Newsletter Delivery Cadence
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Stored privately in your reader account preferences.
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg">
            {(['immediate', 'daily', 'weekly'] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                disabled={savingDigest}
                onClick={() => handleDigestChange(freq)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  digestFrequency === freq
                    ? 'bg-[#6D28D9] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {freq}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'highlights' ? (
        highlights.length === 0 ? (
          <div className="border border-[var(--border-hairline)] rounded-xl p-10 bg-[var(--bg-surface)] text-center">
            <Highlighter className="w-8 h-8 text-[var(--text-accent-soft)] mx-auto mb-3" />
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
              No highlights or margin notes yet
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Select any sentence while reading an essay to highlight passages and record private margin notes here.
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ view: 'explore' })}
              className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
            >
              Browse Dispatches
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {highlights.map((hl) => {
              const borderAccent =
                hl.color === 'amber'
                  ? 'border-l-amber-500'
                  : hl.color === 'emerald'
                  ? 'border-l-emerald-500'
                  : 'border-l-[#8B5CF6]';
              return (
                <article
                  key={hl.id}
                  className={`p-5 rounded-xl border border-[var(--border-hairline)] border-l-4 ${borderAccent} bg-[var(--bg-surface)]`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-accent-soft)]">
                        {hl.publicationName}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate({ view: 'post', postId: hl.postId })}
                        className="font-display text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] text-left cursor-pointer"
                      >
                        {hl.postTitle}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteHighlight(hl.id)}
                      aria-label="Delete highlight"
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-danger)] shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <blockquote className="text-sm italic text-[var(--text-body)] leading-relaxed mb-2">
                    “{hl.quote}”
                  </blockquote>
                  {hl.note && (
                    <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                      Margin note: {hl.note}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--text-muted)] mt-2">
                    Saved {formatEditorialDate(hl.createdAt)}
                  </p>
                </article>
              );
            })}
          </div>
        )
      ) : tab === 'saved' ? (
        bookmarks.length === 0 ? (
          <div className="border border-[var(--border-hairline)] rounded-xl p-10 bg-[var(--bg-surface)] text-center">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
              Your reading queue is empty
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Save essays from Dispatches, publication archives, or the reader view to build a quiet weekend reading list.
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ view: 'explore' })}
              className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
            >
              Browse Dispatches
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {bookmarks.map((bm) => {
              const post = postMap.get(bm.postId);
              if (!post) {
                return (
                  <article
                    key={bm.id}
                    className="py-5 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-accent-soft)] mb-1">
                        {bm.publicationName}
                      </p>
                      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] truncate">
                        {bm.postTitle}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Saved {formatEditorialDate(bm.createdAt)} · Issue no longer published
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleBookmark({
                          id: bm.postId,
                          publicationId: '',
                          authorId: '',
                          authorName: '',
                          authorAvatar: '',
                          publicationName: bm.publicationName,
                          publicationSlug: '',
                          title: bm.postTitle,
                          subtitle: '',
                          slug: '',
                          category: 'Essays',
                          coverImageUrl: '',
                          contentMarkdown: '',
                          excerpt: '',
                          readTimeMinutes: 1,
                          accessTier: 'free',
                          status: 'published',
                          likesCount: 0,
                          publishedAt: null,
                          createdAt: null,
                          updatedAt: null,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-accent)] hover:border-[#8B5CF6] shrink-0 cursor-pointer"
                    >
                      <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
                      <span>Remove</span>
                    </button>
                  </article>
                );
              }

              const prog = readingProgressMap.get(post.id);

              return (
                <article
                  key={bm.id}
                  className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1.5">
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
                        className="hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                      >
                        {post.authorName}
                      </button>
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
                      <span aria-hidden="true">·</span>
                      <span>Saved {formatEditorialDate(bm.createdAt)}</span>
                    </div>

                    <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] leading-snug mb-1.5">
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

                    <button
                      type="button"
                      onClick={() => onToggleBookmark(post)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-accent)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
                      <span>Remove from Saved</span>
                    </button>
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
              );
            })}
          </div>
        )
      ) : subscriptions.length === 0 ? (
        <div className="border border-[var(--border-hairline)] rounded-xl p-10 bg-[var(--bg-surface)] text-center">
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
            No subscriptions yet
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
            Explore publications across technology, architecture, economics, and natural history to start building your reading list.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'explore' })}
            className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
          >
            Browse Dispatches
          </button>
        </div>
      ) : tab === 'inbox' ? (
        inboxPosts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8">
            Your subscribed publications haven’t published any issues yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {inboxPosts.map((post) => {
              const prog = readingProgressMap.get(post.id);
              return (
                <article
                  key={post.id}
                  className="py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1.5">
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
                        className="hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                      >
                        {post.authorName}
                      </button>
                      <span aria-hidden="true">·</span>
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
                          <span className="inline-flex items-center gap-1 text-[var(--text-accent-soft)]">
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            Unlocked
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] leading-snug mb-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigate({ view: 'post', postId: post.id })}
                        className="text-left hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                      >
                        {post.title}
                      </button>
                    </h2>

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {post.subtitle || post.excerpt}
                    </p>
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
              );
            })}
          </div>
        )
      ) : (
        <div className="divide-y divide-[var(--border-hairline)]">
          {subscriptions.map((sub) => {
            const pub = pubMap.get(sub.publicationId);
            return (
              <div
                key={sub.id}
                className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          view: 'publication',
                          slug: sub.publicationSlug,
                        })
                      }
                      className="font-display text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                    >
                      {sub.publicationName}
                    </button>
                    {sub.tier === 'supporting' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border border-[#8B5CF6] text-[var(--text-accent)]">
                        <Crown className="w-2.5 h-2.5" />
                        Supporting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                    Joined {formatEditorialDate(sub.createdAt)} · Current tier:{' '}
                    <span className="font-medium text-[var(--text-accent)]">
                      {sub.tier === 'supporting' ? 'Supporting' : 'Free'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {sub.tier === 'supporting' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateSubscriptionTier(sub.id, 'free');
                        onNotify(`Switched ${sub.publicationName} to free tier.`);
                      }}
                      className="px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-body)] hover:border-[#8B5CF6] transition-colors cursor-pointer"
                    >
                      Switch to Free
                    </button>
                  ) : (
                    pub && (
                      <button
                        type="button"
                        onClick={() => onOpenMembershipCheckout(pub)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#8B5CF6] bg-[var(--bg-active-soft)] rounded-lg text-[var(--text-accent)] hover:bg-[#6D28D9] hover:text-white transition-colors cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Upgrade to Supporting</span>
                      </button>
                    )
                  )}

                  {pub && (
                    <button
                      type="button"
                      onClick={() => onToggleSubscribe(pub)}
                      className="px-3 py-1.5 text-xs font-medium border border-[var(--border-danger)] bg-[var(--bg-danger-soft)] rounded-lg text-[var(--text-danger)] hover:bg-[var(--bg-danger-hover)] transition-colors cursor-pointer"
                    >
                      Unsubscribe
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
