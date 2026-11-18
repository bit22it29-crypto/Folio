import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowUpRight,
  Crown,
  Edit3,
  Heart,
  MessageSquare,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react';
import {
  addNoteReply,
  createNote,
  deleteNote,
  deleteNoteReply,
  seedStarterCatalog,
  subscribeNoteReplies,
  updateNote,
} from '../lib/firestoreService';
import { formatRelativeTime } from '../lib/markdown';
import type {
  AppRoute,
  Note,
  NoteReply,
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
  followedAuthorIds: Set<string>;
  noteReplyCounts: Map<string, number>;
  user: User | null;
  profile: UserProfile | null;
  likedNoteIds: Set<string>;
  onNavigate: (route: AppRoute) => void;
  onToggleNoteLike: (note: Note) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

interface NoteRepliesPanelProps {
  note: Note;
  user: User | null;
  profile: UserProfile | null;
  onNavigate: (route: AppRoute) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

function NoteRepliesPanel({
  note,
  user,
  profile,
  onNavigate,
  onSignIn,
  onNotify,
}: NoteRepliesPanelProps) {
  const [replies, setReplies] = useState<NoteReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (note.isShowcase) {
      setReplies([]);
      return;
    }
    const unsub = subscribeNoteReplies(note.id, setReplies);
    return () => unsub();
  }, [note.id, note.isShowcase]);

  const handleSubmitReply = async () => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (note.isShowcase) {
      await seedStarterCatalog(user, profile);
      onNotify('Live catalog synced — you can reply to notes now.');
      return;
    }
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await addNoteReply({
        note,
        user,
        profile,
        body: replyText,
      });
      setReplyText('');
      onNotify('Reply added.');
    } catch {
      onNotify('Could not post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pl-12 pt-4 border-t border-[var(--border-subtle)] space-y-4">
      {note.isShowcase ? (
        <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Sync the starter catalog into Firestore to reply on this Salon thread.
          </p>
          {user && profile ? (
            <button
              type="button"
              onClick={() => void seedStarterCatalog(user, profile)}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] cursor-pointer whitespace-nowrap"
            >
              Enable Live Replies
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] cursor-pointer whitespace-nowrap"
            >
              Sign In
            </button>
          )}
        </div>
      ) : (
        <>
          {replies.length > 0 && (
            <div className="space-y-3">
              {replies.map((rep) => {
                const canDelete = Boolean(
                  user && (user.uid === rep.authorId || user.uid === note.authorId)
                );
                return (
                  <div
                    key={rep.id}
                    className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({ view: 'author', authorId: rep.authorId })
                          }
                          className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                        >
                          {rep.authorName}
                        </button>
                        <span className="text-[var(--text-muted)]">
                          @{rep.authorHandle}
                        </span>
                        <span className="text-[var(--text-muted)]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {formatRelativeTime(rep.createdAt)}
                        </span>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void deleteNoteReply(note.id, rep.id)}
                          aria-label="Delete reply"
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-danger)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-body)] whitespace-pre-wrap leading-relaxed">
                      {rep.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {user ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={600}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                    e.preventDefault();
                    void handleSubmitReply();
                  }
                }}
                placeholder={`Reply to ${note.authorName}...`}
                className="flex-1 px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)]"
              />
              <button
                type="button"
                disabled={submitting || !replyText.trim()}
                onClick={() => void handleSubmitReply()}
                className="px-3.5 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {submitting ? 'Replying...' : 'Reply'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="text-xs font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
            >
              Sign in to reply to this note
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function NotesView({
  notes,
  posts,
  userPublications,
  subscriptions,
  followedAuthorIds,
  noteReplyCounts,
  user,
  profile,
  likedNoteIds,
  onNavigate,
  onToggleNoteLike,
  onSignIn,
  onNotify,
}: NotesViewProps) {
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const [body, setBody] = useState('');
  const [quotedPostId, setQuotedPostId] = useState('');
  const [restackTarget, setRestackTarget] = useState<Note | null>(null);
  const [posting, setPosting] = useState(false);

  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const subscribedPubIds = useMemo(
    () => new Set(subscriptions.map((s) => s.publicationId)),
    [subscriptions]
  );

  const supportingPubIds = useMemo(
    () =>
      new Set(
        subscriptions
          .filter((s) => s.tier === 'supporting')
          .map((s) => s.publicationId)
      ),
    [subscriptions]
  );

  const visibleNotes = useMemo(() => {
    if (feedFilter === 'all') return notes;
    return notes.filter(
      (n) =>
        (user && n.authorId === user.uid) ||
        followedAuthorIds.has(n.authorId) ||
        (n.publicationId && subscribedPubIds.has(n.publicationId))
    );
  }, [notes, feedFilter, user, followedAuthorIds, subscribedPubIds]);

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
        restackedNote:
          restackTarget && !restackTarget.isShowcase ? restackTarget : undefined,
      });
      setBody('');
      setQuotedPostId('');
      setRestackTarget(null);
      onNotify(restackTarget ? 'Restacked note to Salon.' : 'Posted to Salon.');
    } finally {
      setPosting(false);
    }
  };

  const handleStartRestack = (note: Note) => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (note.isShowcase) {
      setBody(`“${note.body.slice(0, 220)}” — ${note.authorName}\n\n`);
      setRestackTarget(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onNotify('Quoted sample note into your composer.');
      return;
    }
    setRestackTarget(note);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editingNoteBody.trim()) return;
    setSavingEdit(true);
    try {
      await updateNote(noteId, editingNoteBody);
      setEditingNoteId(null);
      setEditingNoteBody('');
      onNotify('Note updated.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleReplies = (noteId: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const livePosts = posts.filter((p) => !p.isShowcase);

  return (
    <main className="max-w-[740px] mx-auto px-4 sm:px-6 py-10 pb-24">
      <div className="pb-6 border-b border-[var(--border-hairline)] mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] mb-2">
            Salon
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Short dispatches, reading marginalia, and recommendations from independent writers.
          </p>
        </div>

        <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg self-start shrink-0">
          <button
            type="button"
            onClick={() => setFeedFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              feedFilter === 'all'
                ? 'bg-[var(--accent-solid)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Notes
          </button>
          <button
            type="button"
            onClick={() => setFeedFilter('following')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              feedFilter === 'following'
                ? 'bg-[var(--accent-solid)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Following
          </button>
        </div>
      </div>

      {/* Note Composer */}
      <section className="mb-10 border border-[var(--border-hairline)] rounded-xl p-5 bg-[var(--bg-surface)]">
        {user ? (
          <>
            {restackTarget && (
              <div className="mb-3 p-3 rounded-lg border border-[var(--accent-border)]/50 bg-[var(--bg-active-soft)] flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text-accent)] flex items-center gap-1.5 mb-0.5">
                    <Repeat2 className="w-3.5 h-3.5" />
                    <span>Restacking {restackTarget.authorName}</span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {restackTarget.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestackTarget(null)}
                  aria-label="Clear restack"
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder={
                restackTarget
                  ? 'Add your commentary to this restack...'
                  : 'Share a quick observation, quote, or work-in-progress...'
              }
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
                {posting ? 'Posting...' : restackTarget ? 'Restack Note' : 'Post Note'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Sign in with Google to share short-form notes, restack essays, and reply to writers.
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
      {visibleNotes.length === 0 ? (
        <div className="border border-[var(--border-hairline)] rounded-xl p-10 bg-[var(--bg-surface)] text-center">
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-2">
            No Salon notes from people you follow yet
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-5">
            Follow writers or subscribe to publications across Dispatches to see their notes here.
          </p>
          <button
            type="button"
            onClick={() => setFeedFilter('all')}
            className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            View All Notes
          </button>
        </div>
      ) : (
        <section className="divide-y divide-[var(--border-hairline)]">
          {visibleNotes.map((note) => {
            const isLiked = likedNoteIds.has(note.id);
            const isAuthor = Boolean(user && user.uid === note.authorId && !note.isShowcase);
            const showSupporterCrest = Boolean(
              user &&
                user.uid === note.authorId &&
                note.publicationId &&
                supportingPubIds.has(note.publicationId)
            );
            const replyCount = noteReplyCounts.get(note.id) || 0;
            const repliesExpanded = expandedNoteIds.has(note.id);

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
                        {note.editedAt && (
                          <span className="text-[11px] text-[var(--text-muted)] italic">
                            (edited)
                          </span>
                        )}
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
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingNoteBody(note.body);
                        }}
                        aria-label="Edit note"
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-accent)] cursor-pointer p-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteNote(note.id)}
                        aria-label="Delete note"
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-danger)] cursor-pointer p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingNoteId === note.id ? (
                  <div className="pl-12 mb-3">
                    <textarea
                      rows={3}
                      maxLength={600}
                      value={editingNoteBody}
                      onChange={(e) => setEditingNoteBody(e.target.value)}
                      className="w-full p-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit || !editingNoteBody.trim()}
                        onClick={() => void handleSaveEdit(note.id)}
                        className="px-3 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[15px] text-[var(--text-body)] leading-relaxed whitespace-pre-wrap pl-12 mb-3">
                    {note.body}
                  </p>
                )}

                {note.restackedNoteId && note.restackedBody && (
                  <div className="pl-12 mb-3">
                    <div className="p-3.5 border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface)]">
                      <p className="text-[11px] font-semibold text-[var(--text-accent-soft)] flex items-center gap-1.5 mb-1">
                        <Repeat2 className="w-3 h-3" />
                        <span>Restacked from {note.restackedAuthorName || 'Writer'}</span>
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {note.restackedBody}
                      </p>
                    </div>
                  </div>
                )}

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

                <div className="pl-12 flex items-center gap-5">
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

                  <button
                    type="button"
                    onClick={() => toggleReplies(note.id)}
                    aria-expanded={repliesExpanded}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer tabular-nums ${
                      repliesExpanded
                        ? 'text-[var(--text-accent)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{replyCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartRestack(note)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                    <span>Restack</span>
                  </button>
                </div>

                {repliesExpanded && (
                  <NoteRepliesPanel
                    note={note}
                    user={user}
                    profile={profile}
                    onNavigate={onNavigate}
                    onSignIn={onSignIn}
                    onNotify={onNotify}
                  />
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
