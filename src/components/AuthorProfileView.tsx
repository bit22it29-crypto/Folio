import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Heart,
  Lock,
  MessageSquare,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { getAuthorPublicProfile } from '../lib/firestoreService';
import { formatEditorialDate, formatRelativeTime } from '../lib/markdown';
import type {
  AppRoute,
  Note,
  Post,
  Publication,
  Subscription,
  UserProfile,
} from '../types/folio';
import { EditorialImage } from './EditorialImage';

interface AuthorProfileViewProps {
  authorId: string;
  currentUserId?: string;
  publications: Publication[];
  posts: Post[];
  notes: Note[];
  subscriptions: Subscription[];
  isFollowing: boolean;
  followerCount: number;
  commentCounts: Map<string, number>;
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  onNavigate: (route: AppRoute) => void;
  onToggleFollowAuthor: (authorId: string, authorName: string) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onToggleLike: (post: Post) => void;
  onToggleBookmark: (post: Post) => void;
}

export function AuthorProfileView({
  authorId,
  currentUserId,
  publications,
  posts,
  notes,
  subscriptions,
  isFollowing,
  followerCount,
  commentCounts,
  likedPostIds,
  bookmarkedPostIds,
  onNavigate,
  onToggleFollowAuthor,
  onToggleSubscribe,
  onToggleLike,
  onToggleBookmark,
}: AuthorProfileViewProps) {
  const [authorProfile, setAuthorProfile] = useState<UserProfile | null>(null);

  const authorPubs = publications.filter((p) => p.ownerId === authorId);
  const authorPosts = posts.filter((p) => p.authorId === authorId);
  const authorNotes = notes.filter((n) => n.authorId === authorId);

  useEffect(() => {
    if (authorId.startsWith('showcase_')) {
      setAuthorProfile(null);
      return;
    }
    void getAuthorPublicProfile(authorId).then(setAuthorProfile);
  }, [authorId]);

  const fallbackName =
    authorPubs[0]?.ownerName ||
    authorPosts[0]?.authorName ||
    authorNotes[0]?.authorName ||
    'Independent Writer';
  const displayName = authorProfile?.displayName || fallbackName;
  const handle =
    authorProfile?.handle ||
    authorNotes[0]?.authorHandle ||
    displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bio =
    authorProfile?.bio ||
    authorPubs[0]?.tagline ||
    'Independent writer and publisher on Folio.';
  const avatarUrl =
    authorProfile?.avatarUrl ||
    authorPosts[0]?.authorAvatar ||
    authorNotes[0]?.authorAvatar ||
    '';

  const subIds = new Set(subscriptions.map((s) => s.publicationId));

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

      {/* Author Header */}
      <section className="p-6 sm:p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center gap-6 mb-10">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full object-cover border border-[var(--border-strong)] shrink-0"
          />
        ) : (
          <span className="w-20 h-20 rounded-full bg-[var(--accent-solid)] text-white font-display text-2xl font-semibold flex items-center justify-center shrink-0">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-accent-soft)] mb-1">
            <span>@{handle}</span>
            <span className="text-[var(--text-muted)]" aria-hidden="true">
              ·
            </span>
            <span className="text-[var(--text-muted)] tabular-nums">
              {authorPubs.length} {authorPubs.length === 1 ? 'publication' : 'publications'}
            </span>
            <span className="text-[var(--text-muted)]" aria-hidden="true">
              ·
            </span>
            <span className="text-[var(--text-muted)] tabular-nums">
              {authorPosts.length} {authorPosts.length === 1 ? 'essay' : 'essays'}
            </span>
            <span className="text-[var(--text-muted)]" aria-hidden="true">
              ·
            </span>
            <span className="text-[var(--text-accent)] font-medium tabular-nums">
              {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">
              {displayName}
            </h1>

            {currentUserId !== authorId && (
              <button
                type="button"
                onClick={() => onToggleFollowAuthor(authorId, displayName)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isFollowing
                    ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)] text-[var(--text-accent)]'
                    : 'border-transparent bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow Writer</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">{bio}</p>
        </div>
      </section>

      {/* Author Publications */}
      {authorPubs.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] pb-3 border-b border-[var(--border-hairline)] mb-5">
            Publications by {displayName}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {authorPubs.map((pub) => {
              const isSub = subIds.has(pub.id);
              return (
                <div
                  key={pub.id}
                  className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-accent-soft)] mb-1">
                      {pub.category} · {pub.subscriberCount.toLocaleString()} subscribers
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ view: 'publication', slug: pub.slug })
                      }
                      className="font-display text-xl font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] text-left cursor-pointer"
                    >
                      {pub.name}
                    </button>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {pub.tagline}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(pub)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 cursor-pointer ${
                      isSub
                        ? 'bg-[var(--bg-active-soft)] text-[var(--text-primary)] border border-[var(--border-strong)]'
                        : 'bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {isSub ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Essays + Recent Notes Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <section className="lg:col-span-8">
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] pb-4 border-b border-[var(--border-hairline)]">
            Published Essays
          </h2>

          {authorPosts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8">No published essays yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {authorPosts.map((post) => (
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

                    <h3 className="font-display text-xl font-semibold text-[var(--text-primary)] leading-snug mb-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigate({ view: 'post', postId: post.id })}
                        className="text-left hover:text-[var(--text-accent)] cursor-pointer"
                      >
                        {post.title}
                      </button>
                    </h3>

                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
                      {post.subtitle || post.excerpt}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] tabular-nums">
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
                        onClick={() => onNavigate({ view: 'post', postId: post.id })}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                        aria-label="View responses"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{commentCounts.get(post.id) || 0}</span>
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
                      className="w-full sm:w-36 aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 cursor-pointer"
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
        </section>

        <aside className="lg:col-span-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] pb-3 border-b border-[var(--border-hairline)] mb-4">
              Recent Salon Notes
            </h2>
            {authorNotes.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No Salon notes yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {authorNotes.slice(0, 5).map((note) => (
                  <div key={note.id} className="py-3.5 first:pt-0 last:pb-0">
                    <p className="text-xs text-[var(--text-muted)] mb-1">
                      {formatRelativeTime(note.createdAt)}
                    </p>
                    <p className="text-sm text-[var(--text-body)] leading-relaxed">
                      {note.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
