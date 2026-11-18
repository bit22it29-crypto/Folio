import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Crown,
  Edit3,
  Lock,
  MessageSquare,
  Pin,
  PinOff,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  createPublicationChatMessage,
  deletePublicationChatMessage,
  seedStarterCatalog,
  subscribePublicationChat,
  togglePinPublicationChatMessage,
  updatePublicationChatMessage,
} from '../lib/firestoreService';
import { formatRelativeTime } from '../lib/markdown';
import { LIMITS } from '../lib/validation';
import type {
  AppRoute,
  ChatThreadTier,
  Publication,
  PublicationChatMessage,
  Subscription,
  UserProfile,
} from '../types/folio';

interface PublicationChatPanelProps {
  publication: Publication;
  subscription?: Subscription;
  user: User | null;
  profile: UserProfile | null;
  onNavigate: (route: AppRoute) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onOpenMembershipCheckout: (pub: Publication) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

function formatRoleLabel(role: PublicationChatMessage['authorRole']): string {
  if (role === 'owner') return 'Editor';
  if (role === 'supporting') return 'Supporting Member';
  return 'Subscriber';
}

export function PublicationChatPanel({
  publication,
  subscription,
  user,
  profile,
  onNavigate,
  onToggleSubscribe,
  onOpenMembershipCheckout,
  onSignIn,
  onNotify,
}: PublicationChatPanelProps) {
  const [messages, setMessages] = useState<PublicationChatMessage[]>([]);
  const [tierFilter, setTierFilter] = useState<'all' | 'supporting'>('all');
  const [composerBody, setComposerBody] = useState('');
  const [composerTier, setComposerTier] = useState<ChatThreadTier>('subscribers');
  const [pinNewThread, setPinNewThread] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  const isOwner = Boolean(user && user.uid === publication.ownerId);
  const isSubscribed = Boolean(subscription);
  const isSupporting = subscription?.tier === 'supporting';
  const canParticipateFree = isOwner || isSubscribed;
  const canAccessSupporting = isOwner || isSupporting;

  useEffect(() => {
    if (publication.isShowcase) {
      setMessages([]);
      return;
    }
    const unsub = subscribePublicationChat(publication.id, setMessages);
    return () => unsub();
  }, [publication.id, publication.isShowcase]);

  const { rootThreads, repliesByParent } = useMemo(() => {
    const roots: PublicationChatMessage[] = [];
    const replyMap = new Map<string, PublicationChatMessage[]>();

    for (const msg of messages) {
      if (msg.parentMessageId) {
        const list = replyMap.get(msg.parentMessageId) || [];
        list.push(msg);
        replyMap.set(msg.parentMessageId, list);
      } else {
        roots.push(msg);
      }
    }

    const filteredRoots =
      tierFilter === 'supporting'
        ? roots.filter((m) => m.threadTier === 'supporting')
        : roots;

    filteredRoots.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const at = a.createdAt ? a.createdAt.getTime() : 0;
      const bt = b.createdAt ? b.createdAt.getTime() : 0;
      return bt - at;
    });

    return { rootThreads: filteredRoots, repliesByParent: replyMap };
  }, [messages, tierFilter]);

  const handleSeedLiveCatalog = async () => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    setSeeding(true);
    try {
      await seedStarterCatalog(user, profile);
      onNotify('Live publication synced — Subscriber Chat is now open.');
    } catch {
      onNotify('Could not sync live catalog.');
    } finally {
      setSeeding(false);
    }
  };

  const handlePostThread = async () => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (!canParticipateFree) {
      onToggleSubscribe(publication);
      return;
    }
    const clean = composerBody.trim();
    if (!clean) return;
    setSubmitting(true);
    try {
      await createPublicationChatMessage({
        publication,
        subscription,
        user,
        profile,
        body: clean,
        threadTier: canAccessSupporting ? composerTier : 'subscribers',
        isPinned: isOwner && pinNewThread,
      });
      setComposerBody('');
      setPinNewThread(false);
      onNotify('Thread posted to Subscriber Chat.');
    } catch {
      onNotify('Could not post message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReply = async (parent: PublicationChatMessage) => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (parent.threadTier === 'supporting' && !canAccessSupporting) {
      onOpenMembershipCheckout(publication);
      return;
    }
    if (!canParticipateFree) {
      onToggleSubscribe(publication);
      return;
    }
    const clean = replyBody.trim();
    if (!clean) return;
    setSubmitting(true);
    try {
      await createPublicationChatMessage({
        publication,
        subscription,
        user,
        profile,
        body: clean,
        threadTier: parent.threadTier,
        parentMessageId: parent.id,
        parentAuthorId: parent.authorId,
      });
      setReplyBody('');
      setReplyingToId(null);
      onNotify('Reply sent.');
    } catch {
      onNotify('Could not send reply.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    const clean = editingBody.trim();
    if (!clean) return;
    setSubmitting(true);
    try {
      await updatePublicationChatMessage(publication.id, msgId, clean);
      setEditingMsgId(null);
      setEditingBody('');
      onNotify('Message updated.');
    } catch {
      onNotify('Could not update message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (msg: PublicationChatMessage) => {
    try {
      await togglePinPublicationChatMessage(publication.id, msg.id, !msg.isPinned);
      onNotify(msg.isPinned ? 'Thread unpinned.' : 'Thread pinned to top.');
    } catch {
      onNotify('Could not update pin state.');
    }
  };

  const handleDelete = async (msgId: string) => {
    try {
      await deletePublicationChatMessage(publication.id, msgId);
      onNotify('Message removed.');
    } catch {
      onNotify('Could not delete message.');
    }
  };

  if (publication.isShowcase) {
    return (
      <section className="pt-8">
        <div className="p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-center max-w-2xl mx-auto">
          <MessageSquare className="w-7 h-7 text-[var(--text-accent-soft)] mx-auto mb-3" />
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
            {publication.name} Subscriber Chat
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
            Sync the starter publication catalog into Firestore to launch real-time
            subscriber threads, editor office hours, and supporting-member salons.
          </p>
          {user && profile ? (
            <button
              type="button"
              onClick={handleSeedLiveCatalog}
              disabled={seeding}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              {seeding ? 'Syncing Live Chat...' : 'Enable Live Chat'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In to Enable Chat
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pt-8 space-y-6">
      {/* Header & Channel Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Subscriber Chat
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Direct reader salon hosted by {publication.ownerName} · {messages.length}{' '}
            {messages.length === 1 ? 'message' : 'messages'}
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTierFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tierFilter === 'all'
                ? 'bg-[var(--bg-active-soft)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Threads
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('supporting')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tierFilter === 'supporting'
                ? 'bg-[var(--bg-active-soft)] text-[var(--text-accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Supporters Lounge</span>
          </button>
        </div>
      </div>

      {/* Composer or Membership Gate */}
      {!user ? (
        <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Join {publication.name}&apos;s subscriber conversation
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Sign in and subscribe to start threads or reply to {publication.ownerName}.
            </p>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign In to Join
          </button>
        </div>
      ) : !canParticipateFree ? (
        <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Subscriber-only discussion lounge
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Subscribe free to join open threads, or upgrade for Supporters Lounge access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSubscribe(publication)}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Subscribe Free
            </button>
            <button
              type="button"
              onClick={() => onOpenMembershipCheckout(publication)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--accent-border)] rounded-lg bg-[var(--bg-canvas)] text-[var(--text-accent)] hover:bg-[var(--bg-active-soft)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Supporting ($7/mo)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Start a new thread as {profile?.displayName || 'Subscriber'}
            </span>
            <div className="flex items-center gap-3">
              {canAccessSupporting && (
                <select
                  aria-label="Thread audience"
                  value={composerTier}
                  onChange={(e) => setComposerTier(e.target.value as ChatThreadTier)}
                  className="text-xs px-2.5 py-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                >
                  <option value="subscribers">All Subscribers</option>
                  <option value="supporting">Supporters Lounge Only</option>
                </select>
              )}
              {isOwner && (
                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pinNewThread}
                    onChange={(e) => setPinNewThread(e.target.checked)}
                    className="rounded border-[var(--border-strong)] accent-[var(--accent-solid)]"
                  />
                  <span>Pin thread</span>
                </label>
              )}
            </div>
          </div>

          <textarea
            value={composerBody}
            onChange={(e) => setComposerBody(e.target.value)}
            maxLength={LIMITS.chatBodyMax}
            rows={3}
            placeholder={
              isOwner
                ? `Prompt a discussion, share an office-hours question, or update ${publication.name} readers...`
                : `Share a question or thought with ${publication.name} subscribers...`
            }
            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)] resize-y"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              {composerBody.length}/{LIMITS.chatBodyMax}
            </span>
            <button
              type="button"
              onClick={handlePostThread}
              disabled={submitting || !composerBody.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post Thread</span>
            </button>
          </div>
        </div>
      )}

      {/* Threads List */}
      {rootThreads.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <MessageSquare className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2.5" />
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
            No chat threads yet
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {tierFilter === 'supporting'
              ? 'No Supporters Lounge threads have been opened yet.'
              : `Be the first to open a conversation in ${publication.name}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rootThreads.map((thread) => {
            const replies = repliesByParent.get(thread.id) || [];
            const isThreadLockedForReader =
              thread.threadTier === 'supporting' && !canAccessSupporting;
            const canEditThread = Boolean(user && user.uid === thread.authorId);
            const canDeleteThread = Boolean(
              user && (user.uid === thread.authorId || isOwner)
            );

            return (
              <article
                key={thread.id}
                className={`p-5 rounded-xl border bg-[var(--bg-surface)] transition-colors ${
                  thread.isPinned
                    ? 'border-[var(--accent-border)]'
                    : 'border-[var(--border-hairline)]'
                }`}
              >
                {/* Thread Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {thread.authorAvatar ? (
                      <img
                        src={thread.authorAvatar}
                        alt={thread.authorName}
                        className="w-8 h-8 rounded-full object-cover border border-[var(--border-hairline)] shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-active-soft)] border border-[var(--border-hairline)] flex items-center justify-center text-xs font-semibold text-[var(--text-accent)] shrink-0">
                        {thread.authorName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({ view: 'author', authorId: thread.authorId })
                          }
                          className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer truncate"
                        >
                          {thread.authorName}
                        </button>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span
                          className={
                            thread.authorRole === 'owner' ||
                            thread.authorRole === 'supporting'
                              ? 'font-medium text-[var(--text-accent)]'
                              : 'text-[var(--text-muted)]'
                          }
                        >
                          {formatRoleLabel(thread.authorRole)}
                        </span>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {formatRelativeTime(thread.createdAt)}
                        </span>
                        {thread.editedAt && (
                          <span className="text-[var(--text-muted)]">(edited)</span>
                        )}
                      </div>
                      {(thread.isPinned || thread.threadTier === 'supporting') && (
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-accent)] mt-0.5">
                          {thread.isPinned && (
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Pin className="w-3 h-3" />
                              Pinned by Editor
                            </span>
                          )}
                          {thread.isPinned && thread.threadTier === 'supporting' && (
                            <span aria-hidden="true" className="text-[var(--text-muted)]">
                              ·
                            </span>
                          )}
                          {thread.threadTier === 'supporting' && (
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Crown className="w-3 h-3" />
                              Supporters Lounge
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Owner / Author Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleTogglePin(thread)}
                        title={thread.isPinned ? 'Unpin thread' : 'Pin thread'}
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-accent)] hover:bg-[var(--bg-canvas)] cursor-pointer"
                      >
                        {thread.isPinned ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {canEditThread && !isThreadLockedForReader && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(thread.id);
                          setEditingBody(thread.body);
                        }}
                        title="Edit message"
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteThread && (
                      <button
                        type="button"
                        onClick={() => handleDelete(thread.id)}
                        title="Delete message"
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-canvas)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Thread Body or Supporters Gate */}
                {isThreadLockedForReader ? (
                  <div className="mt-2 p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Lock className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                      <span>
                        This thread is reserved for Supporting Members of{' '}
                        {publication.name}.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenMembershipCheckout(publication)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Upgrade ($7/mo)</span>
                    </button>
                  </div>
                ) : editingMsgId === thread.id ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      maxLength={LIMITS.chatBodyMax}
                      rows={2}
                      className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(thread.id)}
                        disabled={submitting || !editingBody.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(null);
                          setEditingBody('');
                        }}
                        className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">
                    {thread.body}
                  </p>
                )}

                {/* Reply Footer */}
                {!isThreadLockedForReader && (
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="tabular-nums">
                      {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                    {canParticipateFree ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(replyingToId === thread.id ? null : thread.id);
                          setReplyBody('');
                        }}
                        className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-accent)] cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>{replyingToId === thread.id ? 'Close' : 'Reply'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          user ? onToggleSubscribe(publication) : onSignIn()
                        }
                        className="font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
                      >
                        {user ? 'Subscribe to reply' : 'Sign in to reply'}
                      </button>
                    )}
                  </div>
                )}

                {/* Replies Thread */}
                {!isThreadLockedForReader && (replies.length > 0 || replyingToId === thread.id) && (
                  <div className="mt-3 pl-5 border-l border-[var(--border-hairline)] space-y-3">
                    {replies.map((rep) => {
                      const canEditReply = Boolean(user && user.uid === rep.authorId);
                      const canDeleteReply = Boolean(
                        user && (user.uid === rep.authorId || isOwner)
                      );
                      return (
                        <div key={rep.id} className="pt-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs mb-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate({ view: 'author', authorId: rep.authorId })
                                }
                                className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                              >
                                {rep.authorName}
                              </button>
                              <span aria-hidden="true" className="text-[var(--text-muted)]">
                                ·
                              </span>
                              <span
                                className={
                                  rep.authorRole === 'owner' ||
                                  rep.authorRole === 'supporting'
                                    ? 'font-medium text-[var(--text-accent)]'
                                    : 'text-[var(--text-muted)]'
                                }
                              >
                                {formatRoleLabel(rep.authorRole)}
                              </span>
                              <span aria-hidden="true" className="text-[var(--text-muted)]">
                                ·
                              </span>
                              <span className="text-[var(--text-muted)]">
                                {formatRelativeTime(rep.createdAt)}
                              </span>
                              {rep.editedAt && (
                                <span className="text-[var(--text-muted)]">(edited)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {canEditReply && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsgId(rep.id);
                                    setEditingBody(rep.body);
                                  }}
                                  title="Edit reply"
                                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                              {canDeleteReply && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(rep.id)}
                                  title="Delete reply"
                                  className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {editingMsgId === rep.id ? (
                            <div className="space-y-2 mt-1">
                              <textarea
                                value={editingBody}
                                onChange={(e) => setEditingBody(e.target.value)}
                                maxLength={LIMITS.chatBodyMax}
                                rows={2}
                                className="w-full rounded-lg border border-[var(--accent-border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(rep.id)}
                                  disabled={submitting || !editingBody.trim()}
                                  className="px-2.5 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsgId(null);
                                    setEditingBody('');
                                  }}
                                  className="px-2.5 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">
                              {rep.body}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {replyingToId === thread.id && canParticipateFree && (
                      <div className="pt-2 flex items-start gap-2">
                        <input
                          type="text"
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          maxLength={LIMITS.chatBodyMax}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handlePostReply(thread);
                            }
                          }}
                          placeholder={`Reply to ${thread.authorName}...`}
                          className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)]"
                        />
                        <button
                          type="button"
                          onClick={() => handlePostReply(thread)}
                          disabled={submitting || !replyBody.trim()}
                          className="px-3 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyingToId(null)}
                          aria-label="Cancel reply"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
