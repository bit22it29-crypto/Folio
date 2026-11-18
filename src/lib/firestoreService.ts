import { type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { SHOWCASE_NOTES, SHOWCASE_POSTS, SHOWCASE_PUBLICATIONS } from '../data/showcaseContent';
import type {
  AccessTier,
  AppNotification,
  Bookmark,
  Category,
  Comment,
  Highlight,
  HighlightColor,
  NewsletterDispatch,
  Note,
  NotificationType,
  Post,
  PostRevision,
  PostStatus,
  Publication,
  ReadingProgress,
  Subscription,
  SubscriptionTier,
  UserProfile,
} from '../types/folio';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  buildExcerpt,
  clampString,
  estimateReadTimeMinutes,
  LIMITS,
  makeHandle,
  makeSafeId,
  normalizeAccentColor,
  normalizeCategory,
  normalizeTags,
  slugify,
} from './validation';

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');
  const displayName = clampString(
    user.displayName || user.email?.split('@')[0] || 'Writer',
    LIMITS.displayNameMax
  );
  const avatarUrl = clampString(user.photoURL || '', LIMITS.urlMax);
  const email = clampString(user.email || `${user.uid}@folio.local`, 160);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const profile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
        createdAt: ReturnType<typeof serverTimestamp>;
        updatedAt: ReturnType<typeof serverTimestamp>;
      } = {
        uid: user.uid,
        displayName,
        handle: makeHandle(displayName, user.uid),
        bio: 'Independent writer and reader on Folio.',
        avatarUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, profile);
      await setDoc(privateRef, {
        uid: user.uid,
        email,
        digestFrequency: 'immediate',
        updatedAt: serverTimestamp(),
      });
      return {
        ...profile,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const data = snap.data();
    return {
      uid: String(data.uid || user.uid),
      displayName: String(data.displayName || displayName),
      handle: String(data.handle || makeHandle(displayName, user.uid)),
      bio: String(data.bio || ''),
      avatarUrl: String(data.avatarUrl || avatarUrl),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function getUserDigestFrequency(
  uid: string
): Promise<'immediate' | 'daily' | 'weekly'> {
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (!snap.exists()) return 'immediate';
    const freq = snap.data().digestFrequency;
    if (freq === 'daily' || freq === 'weekly') return freq;
    return 'immediate';
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateUserDigestFrequency(
  uid: string,
  digestFrequency: 'immediate' | 'daily' | 'weekly'
): Promise<void> {
  const path = `users/${uid}/private/info`;
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      digestFrequency,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  input: {
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string;
  }
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const cleanHandle = input.handle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, LIMITS.handleMax);
  const handle = cleanHandle.length >= 2 ? cleanHandle : makeHandle(input.displayName, uid);
  const displayName = clampString(input.displayName, LIMITS.displayNameMax);
  const bio = clampString(input.bio, LIMITS.bioMax);
  const avatarUrl = clampString(input.avatarUrl, LIMITS.urlMax);

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName,
      handle,
      bio,
      avatarUrl,
      updatedAt: serverTimestamp(),
    });
    return {
      uid,
      displayName,
      handle,
      bio,
      avatarUrl,
      createdAt: null,
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribePublications(
  onData: (pubs: Publication[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'publications';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Publication[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || ''),
          ownerName: String(data.ownerName || ''),
          slug: String(data.slug || d.id),
          name: String(data.name || ''),
          tagline: String(data.tagline || ''),
          description: String(data.description || ''),
          category: normalizeCategory(String(data.category || 'Essays')),
          accentColor: normalizeAccentColor(String(data.accentColor || '#8B5CF6')),
          coverImageUrl: String(data.coverImageUrl || ''),
          pinnedPostId: data.pinnedPostId ? String(data.pinnedPostId) : null,
          welcomeNote: data.welcomeNote ? String(data.welcomeNote) : '',
          subscriberCount: typeof data.subscriberCount === 'number' ? data.subscriberCount : 0,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePublishedPosts(
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'posts';
  // Enforce status == 'published' in query to comply with Firestore list security rule
  const q = query(collection(db, path), where('status', '==', 'published'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Post[] = snapshot.docs
        .map((d) => mapPostDoc(d.id, d.data()))
        .sort((a, b) => {
          const tA = (a.publishedAt || a.createdAt)?.getTime() || 0;
          const tB = (b.publishedAt || b.createdAt)?.getTime() || 0;
          return tB - tA;
        });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAuthorPosts(
  authorId: string,
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'posts';
  const q = query(collection(db, path), where('authorId', '==', authorId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Post[] = snapshot.docs
        .map((d) => mapPostDoc(d.id, d.data()))
        .sort((a, b) => {
          const tA = (a.updatedAt || a.createdAt)?.getTime() || 0;
          const tB = (b.updatedAt || b.createdAt)?.getTime() || 0;
          return tB - tA;
        });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

function mapPostDoc(id: string, data: Record<string, unknown>): Post {
  const rawStatus = data.status;
  const status: PostStatus =
    rawStatus === 'published'
      ? 'published'
      : rawStatus === 'scheduled'
      ? 'scheduled'
      : 'draft';
  const rawTags = Array.isArray(data.tags)
    ? data.tags.filter((t): t is string => typeof t === 'string')
    : [];

  return {
    id,
    publicationId: String(data.publicationId || ''),
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || ''),
    authorAvatar: String(data.authorAvatar || ''),
    publicationName: String(data.publicationName || ''),
    publicationSlug: String(data.publicationSlug || ''),
    title: String(data.title || ''),
    subtitle: String(data.subtitle || ''),
    slug: String(data.slug || id),
    category: normalizeCategory(String(data.category || 'Essays')),
    tags: normalizeTags(rawTags),
    coverImageUrl: String(data.coverImageUrl || ''),
    contentMarkdown: String(data.contentMarkdown || ''),
    excerpt: String(data.excerpt || ''),
    readTimeMinutes: typeof data.readTimeMinutes === 'number' ? data.readTimeMinutes : 3,
    accessTier: data.accessTier === 'subscribers' ? 'subscribers' : 'free',
    status,
    scheduledFor: toDate(data.scheduledFor),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    publishedAt: toDate(data.publishedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeComments(
  postId: string,
  onData: (comments: Comment[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `posts/${postId}/comments`;
  const q = query(collection(db, 'posts', postId, 'comments'), where('postStatus', '==', 'published'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Comment[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            postId: String(data.postId || postId),
            postStatus: 'published' as const,
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || ''),
            authorAvatar: String(data.authorAvatar || ''),
            body: String(data.body || ''),
            parentCommentId: data.parentCommentId ? String(data.parentCommentId) : null,
            editedAt: toDate(data.editedAt),
            createdAt: toDate(data.createdAt),
          };
        })
        .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePostRevisions(
  postId: string,
  authorId: string,
  onData: (revisions: PostRevision[]) => void
): Unsubscribe {
  const path = `posts/${postId}/revisions`;
  const q = query(
    collection(db, 'posts', postId, 'revisions'),
    where('authorId', '==', authorId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PostRevision[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            postId: String(data.postId || postId),
            authorId: String(data.authorId || authorId),
            title: String(data.title || ''),
            subtitle: String(data.subtitle || ''),
            contentMarkdown: String(data.contentMarkdown || ''),
            summary: String(data.summary || ''),
            createdAt: toDate(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createPostRevision(input: {
  postId: string;
  authorId: string;
  title: string;
  subtitle: string;
  contentMarkdown: string;
  summary: string;
}): Promise<void> {
  const revId = makeSafeId('rev');
  const path = `posts/${input.postId}/revisions/${revId}`;
  try {
    await setDoc(doc(db, 'posts', input.postId, 'revisions', revId), {
      id: revId,
      postId: input.postId,
      authorId: input.authorId,
      title: clampString(input.title, LIMITS.postTitleMax) || 'Untitled Issue',
      subtitle: clampString(input.subtitle, LIMITS.postSubtitleMax),
      contentMarkdown: clampString(input.contentMarkdown, LIMITS.postContentMax),
      summary: clampString(input.summary, LIMITS.revisionSummaryMax),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserSubscriptions(
  userId: string,
  onData: (subs: Subscription[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'subscriptions';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => mapSubDoc(d.id, d.data())));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePublicationSubscribers(
  ownerId: string,
  onData: (subs: Subscription[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'subscriptions';
  const q = query(collection(db, path), where('publicationOwnerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => mapSubDoc(d.id, d.data())));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

function mapSubDoc(id: string, data: Record<string, unknown>): Subscription {
  return {
    id,
    publicationId: String(data.publicationId || ''),
    publicationOwnerId: String(data.publicationOwnerId || ''),
    publicationName: String(data.publicationName || ''),
    publicationSlug: String(data.publicationSlug || ''),
    userId: String(data.userId || ''),
    subscriberName: String(data.subscriberName || ''),
    tier: data.tier === 'supporting' ? 'supporting' : 'free',
    status: 'active',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeNotes(
  onData: (notes: Note[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'notes';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Note[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorId: String(data.authorId || ''),
          authorName: String(data.authorName || ''),
          authorHandle: String(data.authorHandle || ''),
          authorAvatar: String(data.authorAvatar || ''),
          publicationId: data.publicationId ? String(data.publicationId) : undefined,
          publicationName: data.publicationName ? String(data.publicationName) : undefined,
          publicationSlug: data.publicationSlug ? String(data.publicationSlug) : undefined,
          body: String(data.body || ''),
          quotedPostId: data.quotedPostId ? String(data.quotedPostId) : undefined,
          quotedPostTitle: data.quotedPostTitle ? String(data.quotedPostTitle) : undefined,
          likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
          createdAt: toDate(data.createdAt),
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserPostLikes(
  userId: string,
  onData: (likedPostIds: Set<string>) => void
): Unsubscribe {
  const path = 'postLikes';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const postId = d.data().postId;
        if (typeof postId === 'string') ids.add(postId);
      });
      onData(ids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserNoteLikes(
  userId: string,
  onData: (likedNoteIds: Set<string>) => void
): Unsubscribe {
  const path = 'noteLikes';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach((d) => {
        const noteId = d.data().noteId;
        if (typeof noteId === 'string') ids.add(noteId);
      });
      onData(ids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserHighlights(
  userId: string,
  onData: (highlights: Highlight[]) => void
): Unsubscribe {
  const path = 'highlights';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Highlight[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          const color: HighlightColor =
            data.color === 'amber' || data.color === 'emerald' ? data.color : 'purple';
          return {
            id: d.id,
            userId: String(data.userId || userId),
            postId: String(data.postId || ''),
            postTitle: String(data.postTitle || ''),
            publicationName: String(data.publicationName || ''),
            quote: String(data.quote || ''),
            note: String(data.note || ''),
            color,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createHighlight(input: {
  userId: string;
  post: Post;
  quote: string;
  note: string;
  color: HighlightColor;
}): Promise<Highlight> {
  const id = makeSafeId('hl');
  const payload = {
    id,
    userId: input.userId,
    postId: input.post.id,
    postTitle: clampString(input.post.title, LIMITS.postTitleMax),
    publicationName: clampString(input.post.publicationName, LIMITS.pubNameMax),
    quote: clampString(input.quote, LIMITS.highlightQuoteMax),
    note: clampString(input.note, LIMITS.highlightNoteMax),
    color: input.color,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'highlights', id), payload);
    return {
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `highlights/${id}`);
  }
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'highlights', highlightId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `highlights/${highlightId}`);
  }
}

export function subscribeUserReadingProgress(
  userId: string,
  onData: (progressMap: Map<string, ReadingProgress>) => void
): Unsubscribe {
  const path = 'readingProgress';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const map = new Map<string, ReadingProgress>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const postId = String(data.postId || '');
        if (!postId) return;
        map.set(postId, {
          id: d.id,
          userId: String(data.userId || userId),
          postId,
          percent: typeof data.percent === 'number' ? data.percent : 0,
          scrollY: typeof data.scrollY === 'number' ? data.scrollY : 0,
          updatedAt: toDate(data.updatedAt),
        });
      });
      onData(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveReadingProgress(
  userId: string,
  postId: string,
  percent: number,
  scrollY: number
): Promise<void> {
  const progressId = `${postId}_${userId}`;
  const path = `readingProgress/${progressId}`;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const safeScrollY = Math.max(0, Math.round(scrollY));
  try {
    await setDoc(doc(db, 'readingProgress', progressId), {
      id: progressId,
      userId,
      postId,
      percent: safePercent,
      scrollY: safeScrollY,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserNotifications(
  userId: string,
  onData: (notifications: AppNotification[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('recipientId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            recipientId: String(data.recipientId || userId),
            actorId: String(data.actorId || ''),
            actorName: String(data.actorName || ''),
            type: (data.type as NotificationType) || 'welcome',
            title: String(data.title || ''),
            body: String(data.body || ''),
            postId: data.postId ? String(data.postId) : undefined,
            publicationSlug: data.publicationSlug ? String(data.publicationSlug) : undefined,
            read: Boolean(data.read),
            createdAt: toDate(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createNotification(input: {
  recipientId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  body: string;
  postId?: string;
  publicationSlug?: string;
}): Promise<void> {
  if (!input.recipientId || input.recipientId.startsWith('showcase_')) return;
  const id = makeSafeId('ntf');
  const payload: Record<string, unknown> = {
    id,
    recipientId: input.recipientId,
    actorId: input.actorId,
    actorName: clampString(input.actorName || 'Folio Reader', LIMITS.displayNameMax) || 'Folio Reader',
    type: input.type,
    title: clampString(input.title, LIMITS.notifTitleMax),
    body: clampString(input.body, LIMITS.notifBodyMax),
    read: false,
    createdAt: serverTimestamp(),
  };
  if (input.postId) payload.postId = input.postId;
  if (input.publicationSlug) payload.publicationSlug = clampString(input.publicationSlug, LIMITS.pubSlugMax);

  try {
    await setDoc(doc(db, 'notifications', id), payload);
  } catch {
    // Non-critical side-effect notification should never crash primary user workflow
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function markAllNotificationsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

// --- Mutations ---
export async function createPublication(input: {
  user: User;
  profile: UserProfile;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  accentColor: string;
  coverImageUrl: string;
  welcomeNote?: string;
}): Promise<Publication> {
  const id = makeSafeId('pub');
  const name = clampString(input.name, LIMITS.pubNameMax);
  const slug = slugify(name, LIMITS.pubSlugMax);
  const welcomeNote = clampString(input.welcomeNote || '', LIMITS.welcomeNoteMax);
  const payload = {
    id,
    ownerId: input.user.uid,
    ownerName: clampString(input.profile.displayName, LIMITS.displayNameMax),
    slug,
    name,
    tagline: clampString(input.tagline, LIMITS.pubTaglineMax),
    description: clampString(input.description, LIMITS.pubDescMax),
    category: normalizeCategory(input.category),
    accentColor: normalizeAccentColor(input.accentColor),
    coverImageUrl: clampString(input.coverImageUrl, LIMITS.urlMax),
    pinnedPostId: null,
    welcomeNote,
    subscriberCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'publications', id), payload);
    return {
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `publications/${id}`);
  }
}

export async function updatePublication(
  pubId: string,
  input: {
    ownerName: string;
    name: string;
    tagline: string;
    description: string;
    category: Category;
    accentColor: string;
    coverImageUrl: string;
    pinnedPostId?: string | null;
    welcomeNote?: string;
  }
): Promise<void> {
  const name = clampString(input.name, LIMITS.pubNameMax);
  const updates: Record<string, unknown> = {
    ownerName: clampString(input.ownerName, LIMITS.displayNameMax),
    slug: slugify(name, LIMITS.pubSlugMax),
    name,
    tagline: clampString(input.tagline, LIMITS.pubTaglineMax),
    description: clampString(input.description, LIMITS.pubDescMax),
    category: normalizeCategory(input.category),
    accentColor: normalizeAccentColor(input.accentColor),
    coverImageUrl: clampString(input.coverImageUrl, LIMITS.urlMax),
    updatedAt: serverTimestamp(),
  };
  if (input.pinnedPostId !== undefined) {
    updates.pinnedPostId = input.pinnedPostId || null;
  }
  if (input.welcomeNote !== undefined) {
    updates.welcomeNote = clampString(input.welcomeNote, LIMITS.welcomeNoteMax);
  }
  try {
    await updateDoc(doc(db, 'publications', pubId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `publications/${pubId}`);
  }
}

export async function setPublicationPinnedPost(
  pubId: string,
  pinnedPostId: string | null
): Promise<void> {
  try {
    await updateDoc(doc(db, 'publications', pubId), {
      pinnedPostId: pinnedPostId || null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `publications/${pubId}`);
  }
}

export async function deletePublication(pubId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'publications', pubId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `publications/${pubId}`);
  }
}

export async function createPost(input: {
  user: User;
  profile: UserProfile;
  publication: Publication;
  title: string;
  subtitle: string;
  category: Category;
  tags?: string[];
  coverImageUrl: string;
  contentMarkdown: string;
  accessTier: AccessTier;
  status: PostStatus;
  scheduledFor?: Date | null;
}): Promise<string> {
  const id = makeSafeId('post');
  const title = clampString(input.title, LIMITS.postTitleMax);
  const contentMarkdown = clampString(input.contentMarkdown, LIMITS.postContentMax);
  const subtitle = clampString(input.subtitle, LIMITS.postSubtitleMax);
  const tags = normalizeTags(input.tags || []);

  const payload: Record<string, unknown> = {
    id,
    publicationId: input.publication.id,
    authorId: input.user.uid,
    authorName: clampString(input.profile.displayName, LIMITS.displayNameMax),
    authorAvatar: clampString(input.profile.avatarUrl, LIMITS.urlMax),
    publicationName: clampString(input.publication.name, LIMITS.pubNameMax),
    publicationSlug: clampString(input.publication.slug, LIMITS.pubSlugMax),
    title,
    subtitle,
    slug: slugify(title, LIMITS.postSlugMax),
    category: normalizeCategory(input.category),
    tags,
    coverImageUrl: clampString(input.coverImageUrl, LIMITS.urlMax),
    contentMarkdown,
    excerpt: clampString(buildExcerpt(contentMarkdown, subtitle), LIMITS.postExcerptMax),
    readTimeMinutes: estimateReadTimeMinutes(contentMarkdown),
    accessTier: input.accessTier,
    status: input.status,
    scheduledFor:
      input.status === 'scheduled' && input.scheduledFor
        ? Timestamp.fromDate(input.scheduledFor)
        : null,
    likesCount: 0,
    publishedAt: input.status === 'published' ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'posts', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `posts/${id}`);
  }
}

export async function updatePost(
  post: Post,
  input: {
    title: string;
    subtitle: string;
    category: Category;
    tags?: string[];
    coverImageUrl: string;
    contentMarkdown: string;
    accessTier: AccessTier;
    status: PostStatus;
    scheduledFor?: Date | null;
  }
): Promise<void> {
  const title = clampString(input.title, LIMITS.postTitleMax);
  const contentMarkdown = clampString(input.contentMarkdown, LIMITS.postContentMax);
  const subtitle = clampString(input.subtitle, LIMITS.postSubtitleMax);
  const tags = normalizeTags(input.tags !== undefined ? input.tags : post.tags || []);

  const updates: Record<string, unknown> = {
    title,
    subtitle,
    slug: slugify(title, LIMITS.postSlugMax),
    category: normalizeCategory(input.category),
    tags,
    coverImageUrl: clampString(input.coverImageUrl, LIMITS.urlMax),
    contentMarkdown,
    excerpt: clampString(buildExcerpt(contentMarkdown, subtitle), LIMITS.postExcerptMax),
    readTimeMinutes: estimateReadTimeMinutes(contentMarkdown),
    accessTier: input.accessTier,
    status: input.status,
    scheduledFor:
      input.status === 'scheduled' && input.scheduledFor
        ? Timestamp.fromDate(input.scheduledFor)
        : null,
    updatedAt: serverTimestamp(),
  };

  if (input.status === 'published' && !post.publishedAt) {
    updates.publishedAt = serverTimestamp();
  }

  try {
    await updateDoc(doc(db, 'posts', post.id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
  }
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'posts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
  }
}

export async function toggleSubscription(
  publication: Publication,
  user: User,
  profile: UserProfile,
  existingSub: Subscription | undefined,
  tier: SubscriptionTier = 'free'
): Promise<void> {
  const subId = `${publication.id}_${user.uid}`;
  const subRef = doc(db, 'subscriptions', subId);
  const pubRef = doc(db, 'publications', publication.id);

  try {
    const batch = writeBatch(db);
    if (existingSub) {
      batch.delete(subRef);
      batch.update(pubRef, { subscriberCount: increment(-1) });
    } else {
      batch.set(subRef, {
        id: subId,
        publicationId: publication.id,
        publicationOwnerId: publication.ownerId,
        publicationName: clampString(publication.name, LIMITS.pubNameMax),
        publicationSlug: clampString(publication.slug, LIMITS.pubSlugMax),
        userId: user.uid,
        subscriberName: clampString(profile.displayName, LIMITS.displayNameMax),
        tier,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(pubRef, { subscriberCount: increment(1) });
    }
    await batch.commit();

    if (!existingSub) {
      if (publication.welcomeNote && publication.welcomeNote.trim()) {
        await createNotification({
          recipientId: user.uid,
          actorId: user.uid,
          actorName: publication.ownerName || publication.name,
          type: 'welcome',
          title: `Welcome to ${publication.name}`,
          body: publication.welcomeNote,
          publicationSlug: publication.slug,
        });
      }
      if (publication.ownerId && publication.ownerId !== user.uid) {
        await createNotification({
          recipientId: publication.ownerId,
          actorId: user.uid,
          actorName: profile.displayName,
          type: 'new_subscriber',
          title: `New subscriber to ${publication.name}`,
          body: `${profile.displayName} joined on the ${tier} tier.`,
          publicationSlug: publication.slug,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscriptions/${subId}`);
  }
}

export async function updateSubscriptionTier(
  subId: string,
  tier: SubscriptionTier
): Promise<void> {
  try {
    await updateDoc(doc(db, 'subscriptions', subId), {
      tier,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${subId}`);
  }
}

export async function togglePostLike(
  postId: string,
  userId: string,
  isCurrentlyLiked: boolean
): Promise<void> {
  const likeId = `${postId}_${userId}`;
  const likeRef = doc(db, 'postLikes', likeId);
  const postRef = doc(db, 'posts', postId);

  try {
    const batch = writeBatch(db);
    if (isCurrentlyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, { likesCount: increment(-1) });
    } else {
      batch.set(likeRef, {
        id: likeId,
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, { likesCount: increment(1) });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `postLikes/${likeId}`);
  }
}

export async function addComment(input: {
  postId: string;
  postTitle?: string;
  postAuthorId?: string;
  user: User;
  profile: UserProfile;
  body: string;
  parentCommentId?: string | null;
  parentCommentAuthorId?: string | null;
}): Promise<void> {
  const cleanBody = clampString(input.body.trim(), LIMITS.commentBodyMax);
  if (!cleanBody) return;

  const commentId = makeSafeId('cmt');
  const payload: Record<string, unknown> = {
    id: commentId,
    postId: input.postId,
    postStatus: 'published',
    authorId: input.user.uid,
    authorName:
      clampString(input.profile.displayName || 'Reader', LIMITS.displayNameMax) ||
      'Reader',
    authorAvatar: clampString(input.profile.avatarUrl || '', LIMITS.urlMax),
    body: cleanBody,
    createdAt: serverTimestamp(),
  };

  if (input.parentCommentId) {
    payload.parentCommentId = input.parentCommentId;
  }

  try {
    await setDoc(doc(db, 'posts', input.postId, 'comments', commentId), payload);

    if (
      input.parentCommentId &&
      input.parentCommentAuthorId &&
      input.parentCommentAuthorId !== input.user.uid
    ) {
      await createNotification({
        recipientId: input.parentCommentAuthorId,
        actorId: input.user.uid,
        actorName: input.profile.displayName,
        type: 'comment_reply',
        title: `${input.profile.displayName} replied to your comment`,
        body: cleanBody,
        postId: input.postId,
      });
    } else if (input.postAuthorId && input.postAuthorId !== input.user.uid) {
      await createNotification({
        recipientId: input.postAuthorId,
        actorId: input.user.uid,
        actorName: input.profile.displayName,
        type: 'post_comment',
        title: `New comment on "${input.postTitle || 'your issue'}"`,
        body: cleanBody,
        postId: input.postId,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `posts/${input.postId}/comments/${commentId}`);
  }
}

export async function updateComment(
  postId: string,
  commentId: string,
  body: string
): Promise<void> {
  const cleanBody = clampString(body.trim(), LIMITS.commentBodyMax);
  if (!cleanBody) return;
  try {
    await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
      body: cleanBody,
      editedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}/comments/${commentId}`);
  }
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
  }
}

export async function createNote(input: {
  user: User;
  profile: UserProfile;
  publication?: Publication;
  body: string;
  quotedPost?: Post;
}): Promise<void> {
  const noteId = makeSafeId('note');
  const payload: Record<string, unknown> = {
    id: noteId,
    authorId: input.user.uid,
    authorName: clampString(input.profile.displayName, LIMITS.displayNameMax),
    authorHandle: clampString(input.profile.handle, LIMITS.handleMax),
    authorAvatar: clampString(input.profile.avatarUrl, LIMITS.urlMax),
    body: clampString(input.body, LIMITS.noteBodyMax),
    likesCount: 0,
    createdAt: serverTimestamp(),
  };

  if (input.publication) {
    payload.publicationId = input.publication.id;
    payload.publicationName = clampString(input.publication.name, LIMITS.pubNameMax);
    payload.publicationSlug = clampString(input.publication.slug, LIMITS.pubSlugMax);
  }

  if (input.quotedPost) {
    payload.quotedPostId = input.quotedPost.id;
    payload.quotedPostTitle = clampString(input.quotedPost.title, LIMITS.postTitleMax);
  }

  try {
    await setDoc(doc(db, 'notes', noteId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notes/${noteId}`);
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notes/${noteId}`);
  }
}

export async function toggleNoteLike(
  noteId: string,
  userId: string,
  isCurrentlyLiked: boolean,
  noteMeta?: { authorId: string; actorName: string; body: string }
): Promise<void> {
  const likeId = `${noteId}_${userId}`;
  const likeRef = doc(db, 'noteLikes', likeId);
  const noteRef = doc(db, 'notes', noteId);

  try {
    const batch = writeBatch(db);
    if (isCurrentlyLiked) {
      batch.delete(likeRef);
      batch.update(noteRef, { likesCount: increment(-1) });
    } else {
      batch.set(likeRef, {
        id: likeId,
        noteId,
        userId,
        createdAt: serverTimestamp(),
      });
      batch.update(noteRef, { likesCount: increment(1) });
    }
    await batch.commit();

    if (!isCurrentlyLiked && noteMeta && noteMeta.authorId !== userId) {
      await createNotification({
        recipientId: noteMeta.authorId,
        actorId: userId,
        actorName: noteMeta.actorName,
        type: 'note_like',
        title: `${noteMeta.actorName} liked your Salon note`,
        body: noteMeta.body,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `noteLikes/${likeId}`);
  }
}

// Seeds live Firestore publications/posts/notes owned by the signed-in user on empty first launch
export async function seedStarterCatalog(user: User, profile: UserProfile): Promise<void> {
  try {
    const existingSnap = await getDocs(collection(db, 'publications'));
    if (!existingSnap.empty) {
      return;
    }

    const pubIdMap = new Map<string, string>();
    for (const pub of SHOWCASE_PUBLICATIONS) {
      pubIdMap.set(pub.id, makeSafeId('pub'));
    }

    const postIdMap = new Map<string, string>();
    for (const post of SHOWCASE_POSTS) {
      postIdMap.set(post.id, makeSafeId('post'));
    }

    const pubBatch = writeBatch(db);
    for (const pub of SHOWCASE_PUBLICATIONS) {
      const realId = pubIdMap.get(pub.id)!;
      const realPinnedId = pub.pinnedPostId ? postIdMap.get(pub.pinnedPostId) || null : null;
      pubBatch.set(doc(db, 'publications', realId), {
        id: realId,
        ownerId: user.uid,
        ownerName: clampString(profile.displayName, LIMITS.displayNameMax),
        slug: pub.slug,
        name: pub.name,
        tagline: pub.tagline,
        description: pub.description,
        category: pub.category,
        accentColor: pub.accentColor,
        coverImageUrl: pub.coverImageUrl,
        pinnedPostId: realPinnedId,
        welcomeNote: clampString(pub.welcomeNote || '', LIMITS.welcomeNoteMax),
        subscriberCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await pubBatch.commit();

    const contentBatch = writeBatch(db);
    for (const post of SHOWCASE_POSTS) {
      const realPostId = postIdMap.get(post.id)!;
      const realPubId = pubIdMap.get(post.publicationId) || Array.from(pubIdMap.values())[0];
      contentBatch.set(doc(db, 'posts', realPostId), {
        id: realPostId,
        publicationId: realPubId,
        authorId: user.uid,
        authorName: clampString(profile.displayName, LIMITS.displayNameMax),
        authorAvatar: clampString(profile.avatarUrl || post.authorAvatar, LIMITS.urlMax),
        publicationName: post.publicationName,
        publicationSlug: post.publicationSlug,
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        category: post.category,
        tags: normalizeTags(post.tags || []),
        coverImageUrl: post.coverImageUrl,
        contentMarkdown: post.contentMarkdown,
        excerpt: post.excerpt,
        readTimeMinutes: post.readTimeMinutes,
        accessTier: post.accessTier,
        status: 'published',
        scheduledFor: null,
        likesCount: 0,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const note of SHOWCASE_NOTES) {
      const realNoteId = makeSafeId('note');
      const payload: Record<string, unknown> = {
        id: realNoteId,
        authorId: user.uid,
        authorName: clampString(profile.displayName, LIMITS.displayNameMax),
        authorHandle: clampString(profile.handle, LIMITS.handleMax),
        authorAvatar: clampString(profile.avatarUrl || note.authorAvatar, LIMITS.urlMax),
        body: note.body,
        likesCount: 0,
        createdAt: serverTimestamp(),
      };
      if (note.publicationId && pubIdMap.has(note.publicationId)) {
        payload.publicationId = pubIdMap.get(note.publicationId);
        payload.publicationName = note.publicationName;
        payload.publicationSlug = note.publicationSlug;
      }
      if (note.quotedPostId && postIdMap.has(note.quotedPostId)) {
        payload.quotedPostId = postIdMap.get(note.quotedPostId);
        payload.quotedPostTitle = note.quotedPostTitle;
      }
      contentBatch.set(doc(db, 'notes', realNoteId), payload);
    }

    await contentBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'publications');
  }
}

export async function getAuthorPublicProfile(
  authorId: string
): Promise<UserProfile | null> {
  const path = `users/${authorId}`;
  try {
    const snap = await getDoc(doc(db, 'users', authorId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid || authorId),
      displayName: String(data.displayName || 'Writer'),
      handle: String(data.handle || 'writer'),
      bio: String(data.bio || ''),
      avatarUrl: String(data.avatarUrl || ''),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserBookmarks(
  userId: string,
  onData: (bookmarks: Bookmark[]) => void
): Unsubscribe {
  const path = 'bookmarks';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Bookmark[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            postId: String(data.postId || ''),
            userId: String(data.userId || userId),
            postTitle: String(data.postTitle || ''),
            publicationName: String(data.publicationName || ''),
            createdAt: toDate(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function togglePostBookmark(
  post: Post,
  userId: string,
  isBookmarked: boolean
): Promise<void> {
  const bookmarkId = `${post.id}_${userId}`;
  const path = `bookmarks/${bookmarkId}`;
  try {
    if (isBookmarked) {
      await deleteDoc(doc(db, 'bookmarks', bookmarkId));
    } else {
      await setDoc(doc(db, 'bookmarks', bookmarkId), {
        id: bookmarkId,
        postId: post.id,
        userId,
        postTitle: clampString(post.title, LIMITS.postTitleMax),
        publicationName: clampString(post.publicationName, LIMITS.pubNameMax),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeOwnerDispatches(
  ownerId: string,
  onData: (dispatches: NewsletterDispatch[]) => void
): Unsubscribe {
  const path = 'dispatches';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: NewsletterDispatch[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            publicationId: String(data.publicationId || ''),
            ownerId: String(data.ownerId || ownerId),
            postId: data.postId ? String(data.postId) : undefined,
            title: String(data.title || ''),
            recipientCount:
              typeof data.recipientCount === 'number' ? data.recipientCount : 0,
            messageId: String(data.messageId || ''),
            sentAt: toDate(data.sentAt),
          };
        })
        .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function recordNewsletterDispatch(input: {
  publicationId: string;
  ownerId: string;
  postId?: string;
  title: string;
  recipientCount: number;
  messageId: string;
}): Promise<void> {
  const id = makeSafeId('dsp');
  const payload: Record<string, unknown> = {
    id,
    publicationId: input.publicationId,
    ownerId: input.ownerId,
    title: clampString(input.title, LIMITS.postTitleMax),
    recipientCount: Math.max(0, Math.floor(input.recipientCount)),
    messageId: clampString(input.messageId, 80),
    sentAt: serverTimestamp(),
  };
  if (input.postId) {
    payload.postId = input.postId;
  }

  try {
    await setDoc(doc(db, 'dispatches', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `dispatches/${id}`);
  }
}
