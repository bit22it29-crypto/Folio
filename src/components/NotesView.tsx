import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowUpRight, Crown, Heart, Trash2 } from 'lucide-react';
import { createNote, deleteNote } from '../lib/firestoreService';
import { formatRelativeTime } from '../lib/markdown';
import type {
  AppRoute,
  Note,
  Post,
  Publication,
  Subscription,
  UserProfile,
} from '../types/folio';

interface NotesViewProps {
  notes: Note[];
  posts: Post[];
  userPublications: Publication[];
  subscriptions: Subscription[];
  user: User | null;
  profile: UserProfile | null;
  likedNoteIds: Set<string>;
  onNavigate: (route: AppRoute) => void;
  onToggleNoteLike: (note: Note) => void;
  onSignIn: () => void;
}

export function NotesView({
  notes,
  posts,
  userPublications,
  subscriptions,
  user,
  profile,
  likedNoteIds,
  onNavigate,
  onToggleNoteLike,
  onSignIn,
}: NotesViewProps) {
  const [body, setBody] = useState('');
  const [quotedPostId, setQuotedPostId] = useState('');
  const [posting, setPosting] = useState(false);

  const supportingPubIds = new Set(
    subscriptions
      .filter((s) => s.tier === 'supporting')
      .map((s) => s.publicationId)
  );

  const handlePublishNote = async () => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (!body.trim()) return;
    setPosting(true);
    try {
      const quoted = posts.find((p) => p.id === quotedPostId && !p.isShowcase);
      await createNote({
        user,
        profile,
        publication: userPublications[0],
        body,
        quotedPost: quoted,
      });
      setBody('');
      setQuotedPostId('');
    } finally {
      setPosting(false);
    }
  };

  const livePosts = posts.filter((p) => !p.isShowcase);

  return (
    <main className="max-w-[740px] mx-auto px-4 sm:px-6 py-10 pb-24">
      <div className="pb-6 border-b border-[var(--border-hairline)] mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] mb-2">
          Salon
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Short dispatches, reading marginalia, and recommendations from independent writers.
        </p>
      </div>

      {/* Note Composer */}
      <section className="mb-10 border border-[var(--border-hairline)] rounded-xl p-5 bg-[var(--bg-surface)]">
        {user ? (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Share a quick observation, quote, or work-in-progress..."
              className="w-full p-3.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)]"
            />

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {livePosts.length > 0 && (
                  <select
                    value={quotedPostId}
                    onChange={(e) => setQuotedPostId(e.target.value)}
                    aria-label="Reference an essay"
                    className="text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 text-[var(--text-body)] max-w-full sm:max-w-[260px] truncate"
                  >
                    <option value="">Optional: Reference an essay</option>
                    {livePosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                  {body.length} / 600
                </span>
              </div>

              <button
                type="button"
                disabled={posting || !body.trim()}
                onClick={handlePublishNote}
                className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {posting ? 'Posting...' : 'Post Note'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Sign in with Google to share short-form notes and react to writers.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}
      </section>

      {/* Notes Stream */}
      <section className="divide-y divide-[var(--border-hairline)]">
        {notes.map((note) => {
          const isLiked = likedNoteIds.has(note.id);
          const isAuthor = Boolean(user && user.uid === note.authorId && !note.isShowcase);
          const showSupporterCrest = Boolean(
            user &&
              user.uid === note.authorId &&
              note.publicationId &&
              supportingPubIds.has(note.publicationId)
          );
          return (
            <article key={note.id} className="py-6">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'author', authorId: note.authorId })
                    }
                    className="shrink-0 cursor-pointer"
                    aria-label={`View ${note.authorName}'s profile`}
                  >
                    {note.authorAvatar ? (
                      <img
                        src={note.authorAvatar}
                        alt={note.authorName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-[var(--border-hairline)] hover:border-[var(--accent-border)] transition-colors"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-[var(--accent-solid)] text-white text-xs font-medium flex items-center justify-center">
                        {note.authorName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ view: 'author', authorId: note.authorId })
                        }
                        className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                      >
                        {note.authorName}
                      </button>
                      {showSupporterCrest && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border border-[var(--accent-border)] text-[var(--text-accent)]">
                          <Crown className="w-2.5 h-2.5" />
                          Supporter
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        @{note.authorHandle}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatRelativeTime(note.createdAt)}
                      </span>
                    </div>
                    {note.publicationName && note.publicationSlug && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            view: 'publication',
                            slug: note.publicationSlug!,
                          })
                        }
                        className="text-xs text-[var(--text-accent-soft)] hover:underline cursor-pointer"
                      >
                        {note.publicationName}
                      </button>
                    )}
                  </div>
                </div>

                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    aria-label="Delete note"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-danger)] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <p className="text-[15px] text-[var(--text-body)] leading-relaxed whitespace-pre-wrap pl-12 mb-3">
                {note.body}
              </p>

              {note.quotedPostId && note.quotedPostTitle && (
                <div className="pl-12 mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'post', postId: note.quotedPostId! })
                    }
                    className="w-full text-left p-3.5 border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface)] hover:border-[var(--accent-border)] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-accent-soft)] mb-0.5">
                        Referenced Essay
                      </p>
                      <p className="font-display text-sm font-semibold text-[var(--text-primary)] truncate">
                        {note.quotedPostTitle}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[var(--text-accent-soft)] shrink-0" />
                  </button>
                </div>
              )}

              <div className="pl-12 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => onToggleNoteLike(note)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer tabular-nums ${
                    isLiked
                      ? 'text-[var(--text-accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{note.likesCount}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
