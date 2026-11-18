import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AuthorProfileView } from './components/AuthorProfileView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExploreFrontPage } from './components/ExploreFrontPage';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MembershipCheckoutModal } from './components/MembershipCheckoutModal';
import { Navbar } from './components/Navbar';
import { NotesView } from './components/NotesView';
import { PostReaderView } from './components/PostReaderView';
import { PublicationView } from './components/PublicationView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { TopicView } from './components/TopicView';
import { WriterStudioView } from './components/WriterStudioView';
import {
  SHOWCASE_NOTES,
  SHOWCASE_POSTS,
  SHOWCASE_PUBLICATIONS,
} from './data/showcaseContent';
import { auth, googleProvider } from './lib/firebase';
import {
  createHighlight,
  deleteHighlight,
  ensureUserProfile,
  markAllNotificationsRead,
  markNotificationRead,
  saveReadingProgress,
  seedStarterCatalog,
  subscribeAuthorPosts,
  subscribeNotes,
  subscribeOwnerDispatches,
  subscribePublicationSubscribers,
  subscribePublications,
  subscribePublishedPosts,
  subscribeUserBookmarks,
  subscribeUserHighlights,
  subscribeUserNoteLikes,
  subscribeUserNotifications,
  subscribeUserPostLikes,
  subscribeUserReadingProgress,
  subscribeUserSubscriptions,
  toggleNoteLike,
  togglePostBookmark,
  togglePostLike,
  toggleSubscription,
  updatePost,
  updateSubscriptionTier,
} from './lib/firestoreService';
import type {
  AppNotification,
  AppRoute,
  Bookmark,
  Highlight,
  HighlightColor,
  NewsletterDispatch,
  Note,
  Post,
  Publication,
  ReadingProgress,
  Subscription,
  UserProfile,
} from './types/folio';

function parseRouteFromUrl(): AppRoute {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('post');
  if (postId) return { view: 'post', postId };
  const slug = params.get('pub');
  if (slug) return { view: 'publication', slug };
  const authorId = params.get('author');
  if (authorId) return { view: 'author', authorId };
  const topic = params.get('topic');
  if (topic) return { view: 'topic', tag: topic };
  const view = params.get('view');
  if (view === 'notes') return { view: 'notes' };
  if (view === 'subscriptions') return { view: 'subscriptions' };
  if (view === 'studio') return { view: 'studio' };
  return { view: 'explore' };
}

function buildUrlFromRoute(route: AppRoute): string {
  if (route.view === 'post') return `/?post=${encodeURIComponent(route.postId)}`;
  if (route.view === 'publication') return `/?pub=${encodeURIComponent(route.slug)}`;
  if (route.view === 'author') return `/?author=${encodeURIComponent(route.authorId)}`;
  if (route.view === 'topic') return `/?topic=${encodeURIComponent(route.tag)}`;
  if (route.view === 'notes') return '/?view=notes';
  if (route.view === 'subscriptions') return '/?view=subscriptions';
  if (route.view === 'studio') return '/?view=studio';
  return '/';
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function FolioAppContent() {
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromUrl());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [dbPublications, setDbPublications] = useState<Publication[]>([]);
  const [dbPosts, setDbPosts] = useState<Post[]>([]);
  const [authorPosts, setAuthorPosts] = useState<Post[]>([]);
  const [dbNotes, setDbNotes] = useState<Note[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [ownerSubscribers, setOwnerSubscribers] = useState<Subscription[]>([]);
  const [ownerDispatches, setOwnerDispatches] = useState<NewsletterDispatch[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [likedNoteIds, setLikedNoteIds] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, ReadingProgress>>(
    new Map()
  );
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [guestHighlights, setGuestHighlights] = useState<Highlight[]>(() => {
    try {
      const raw = localStorage.getItem('folio-guest-highlights');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<
        Omit<Highlight, 'createdAt' | 'updatedAt'> & {
          createdAt?: string;
          updatedAt?: string;
        }
      >;
      return parsed.map((h) => ({
        ...h,
        createdAt: h.createdAt ? new Date(h.createdAt) : null,
        updatedAt: h.updatedAt ? new Date(h.updatedAt) : null,
      }));
    } catch {
      return [];
    }
  });

  const [guestProgressMap, setGuestProgressMap] = useState<Map<string, ReadingProgress>>(
    () => {
      try {
        const raw = localStorage.getItem('folio-guest-progress');
        if (!raw) return new Map();
        const parsed = JSON.parse(raw) as Record<
          string,
          { postId: string; percent: number; scrollY: number; updatedAt?: string }
        >;
        const map = new Map<string, ReadingProgress>();
        Object.entries(parsed).forEach(([postId, entry]) => {
          map.set(postId, {
            id: `${postId}_guest`,
            userId: 'guest',
            postId,
            percent: entry.percent,
            scrollY: entry.scrollY,
            updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : null,
          });
        });
        return map;
      } catch {
        return new Map();
      }
    }
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [checkoutPub, setCheckoutPub] = useState<Publication | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('folio-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('folio-theme', theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const autoSeededUidRef = useRef<string | null>(null);
  const promotedScheduledRef = useRef<Set<string>>(new Set());

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((curr) => (curr === message ? null : curr));
    }, 3800);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    const nextUrl = buildUrlFromRoute(nextRoute);
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState({}, '', nextUrl);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parseRouteFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Global Cmd/Ctrl + K search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auth listener + automatic workspace seeding on empty database
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const userProf = await ensureUserProfile(nextUser);
          setProfile(userProf);
          if (autoSeededUidRef.current !== nextUser.uid) {
            autoSeededUidRef.current = nextUser.uid;
            await seedStarterCatalog(nextUser, userProf);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setProfile(null);
        setAuthorPosts([]);
        setSubscriptions([]);
        setOwnerSubscribers([]);
        setOwnerDispatches([]);
        setBookmarks([]);
        setLikedPostIds(new Set());
        setLikedNoteIds(new Set());
        setHighlights([]);
        setReadingProgressMap(new Map());
        setNotifications([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public Firestore streams
  useEffect(() => {
    const unsubPubs = subscribePublications(setDbPublications);
    const unsubPosts = subscribePublishedPosts(setDbPosts);
    const unsubNotes = subscribeNotes(setDbNotes);
    return () => {
      unsubPubs();
      unsubPosts();
      unsubNotes();
    };
  }, []);

  // Authenticated user streams
  useEffect(() => {
    if (!authReady || !user) return;
    const unsubAuthorPosts = subscribeAuthorPosts(user.uid, setAuthorPosts);
    const unsubSubs = subscribeUserSubscriptions(user.uid, setSubscriptions);
    const unsubOwnerSubs = subscribePublicationSubscribers(user.uid, setOwnerSubscribers);
    const unsubOwnerDispatches = subscribeOwnerDispatches(user.uid, setOwnerDispatches);
    const unsubBookmarks = subscribeUserBookmarks(user.uid, setBookmarks);
    const unsubPostLikes = subscribeUserPostLikes(user.uid, setLikedPostIds);
    const unsubNoteLikes = subscribeUserNoteLikes(user.uid, setLikedNoteIds);
    const unsubHighlights = subscribeUserHighlights(user.uid, setHighlights);
    const unsubProgress = subscribeUserReadingProgress(user.uid, setReadingProgressMap);
    const unsubNotifs = subscribeUserNotifications(user.uid, setNotifications);

    return () => {
      unsubAuthorPosts();
      unsubSubs();
      unsubOwnerSubs();
      unsubOwnerDispatches();
      unsubBookmarks();
      unsubPostLikes();
      unsubNoteLikes();
      unsubHighlights();
      unsubProgress();
      unsubNotifs();
    };
  }, [authReady, user]);

  // Automatic due scheduled-post promotion for signed-in author
  useEffect(() => {
    if (!user || authorPosts.length === 0) return;
    const now = Date.now();
    const duePosts = authorPosts.filter(
      (p) =>
        p.status === 'scheduled' &&
        p.scheduledFor &&
        p.scheduledFor.getTime() <= now &&
        !promotedScheduledRef.current.has(p.id)
    );
    if (duePosts.length === 0) return;
    duePosts.forEach((p) => {
      promotedScheduledRef.current.add(p.id);
      void updatePost(p, {
        title: p.title,
        subtitle: p.subtitle,
        category: p.category,
        tags: p.tags,
        coverImageUrl: p.coverImageUrl,
        contentMarkdown: p.contentMarkdown,
        accessTier: p.accessTier,
        status: 'published',
        scheduledFor: null,
      }).then(() => {
        notify(`Scheduled issue "${p.title}" is now published.`);
      });
    });
  }, [user, authorPosts, notify]);

  const publications = useMemo(
    () => (dbPublications.length > 0 ? dbPublications : SHOWCASE_PUBLICATIONS),
    [dbPublications]
  );

  const posts = useMemo(
    () => (dbPosts.length > 0 ? dbPosts : SHOWCASE_POSTS),
    [dbPosts]
  );

  const notes = useMemo(
    () => (dbNotes.length > 0 ? dbNotes : SHOWCASE_NOTES),
    [dbNotes]
  );

  const userPublications = useMemo(
    () => (user ? dbPublications.filter((p) => p.ownerId === user.uid) : []),
    [dbPublications, user]
  );

  const bookmarkedPostIds = useMemo(
    () => new Set(bookmarks.map((b) => b.postId)),
    [bookmarks]
  );

  const activeProgressMap = user ? readingProgressMap : guestProgressMap;
  const activeHighlights = user ? highlights : guestHighlights;

  const activePost =
    route.view === 'post'
      ? posts.find((p) => p.id === route.postId) ||
        authorPosts.find((p) => p.id === route.postId)
      : undefined;

  const activePublication =
    route.view === 'publication'
      ? publications.find((p) => p.slug === route.slug)
      : activePost
      ? publications.find((p) => p.id === activePost.publicationId)
      : undefined;

  const relatedPosts = activePost
    ? posts.filter(
        (p) => p.publicationId === activePost.publicationId && p.id !== activePost.id
      )
    : [];

  // Sync document title & OpenGraph social meta tags on route change
  useEffect(() => {
    const origin = window.location.origin;
    if (route.view === 'post' && activePost) {
      const title = `${activePost.title} — ${activePost.publicationName}`;
      const desc = activePost.subtitle || activePost.excerpt;
      const ogImg = `${origin}/api/og?title=${encodeURIComponent(
        activePost.title
      )}&pub=${encodeURIComponent(activePost.publicationName)}&author=${encodeURIComponent(
        activePost.authorName
      )}`;
      document.title = title;
      upsertMeta('name', 'description', desc);
      upsertMeta('property', 'og:title', title);
      upsertMeta('property', 'og:description', desc);
      upsertMeta('property', 'og:image', ogImg);
      return;
    }
    if (route.view === 'publication' && activePublication) {
      const title = `${activePublication.name} — Folio`;
      const desc = activePublication.tagline;
      const ogImg = `${origin}/api/og?title=${encodeURIComponent(
        activePublication.name
      )}&pub=${encodeURIComponent(activePublication.category)}&author=${encodeURIComponent(
        activePublication.ownerName
      )}`;
      document.title = title;
      upsertMeta('name', 'description', desc);
      upsertMeta('property', 'og:title', title);
      upsertMeta('property', 'og:description', desc);
      upsertMeta('property', 'og:image', ogImg);
      return;
    }
    if (route.view === 'topic') {
      const title = `#${route.tag} — Folio Topic`;
      document.title = title;
      upsertMeta('property', 'og:title', title);
      return;
    }
    document.title = 'Folio — Independent Publishing & Reader Network';
  }, [route, activePost, activePublication]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      notify('Signed in to Folio.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        notify('Could not complete Google sign-in. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    notify('Signed out.');
  };

  const handleToggleSubscribe = async (pub: Publication) => {
    if (!user || !profile) {
      notify('Sign in with Google to subscribe.');
      void handleSignIn();
      return;
    }
    if (pub.isShowcase) {
      await seedStarterCatalog(user, profile);
      notify('Workspace initialized — click Subscribe once more to confirm.');
      return;
    }
    const existing = subscriptions.find((s) => s.publicationId === pub.id);
    await toggleSubscription(pub, user, profile, existing);
    if (existing) {
      notify(`Unsubscribed from ${pub.name}.`);
    } else if (pub.welcomeNote && pub.welcomeNote.trim()) {
      notify(`Subscribed to ${pub.name}: "${pub.welcomeNote.trim()}"`);
    } else {
      notify(`Subscribed to ${pub.name}.`);
    }
  };

  const handleOpenMembershipCheckout = (pub: Publication) => {
    if (!user || !profile) {
      notify('Sign in with Google to become a Supporting Member.');
      void handleSignIn();
      return;
    }
    setCheckoutPub(pub);
  };

  const handleConfirmSupport = async (
    pub: Publication,
    _plan: 'monthly' | 'annual',
    receipt: { receiptId: string; amountUsd: number }
  ) => {
    if (!user || !profile) {
      notify('Sign in with Google to complete supporting membership.');
      return;
    }
    if (pub.isShowcase) {
      await seedStarterCatalog(user, profile);
      notify('Live catalog synced — open Supporting Membership once more to complete.');
      setCheckoutPub(null);
      return;
    }
    const existing = subscriptions.find((s) => s.publicationId === pub.id);
    if (existing) {
      await updateSubscriptionTier(existing.id, 'supporting');
    } else {
      await toggleSubscription(pub, user, profile, undefined, 'supporting');
    }
    notify(
      `Welcome as a Supporting Member of ${pub.name} ($${receipt.amountUsd}).`
    );
  };

  const handleTogglePostLike = async (post: Post) => {
    if (!user || !profile) {
      notify('Sign in with Google to like essays.');
      void handleSignIn();
      return;
    }
    if (post.isShowcase) {
      await seedStarterCatalog(user, profile);
      notify('Live catalog synced.');
      return;
    }
    const liked = likedPostIds.has(post.id);
    await togglePostLike(post.id, user.uid, liked);
  };

  const handleToggleBookmark = async (post: Post) => {
    if (!user || !profile) {
      notify('Sign in with Google to save essays.');
      void handleSignIn();
      return;
    }
    if (post.isShowcase) {
      await seedStarterCatalog(user, profile);
      notify('Live catalog synced — click Save once more to bookmark.');
      return;
    }
    const isBookmarked = bookmarkedPostIds.has(post.id);
    await togglePostBookmark(post, user.uid, isBookmarked);
    notify(isBookmarked ? 'Removed from saved list.' : 'Saved to your reading list.');
  };

  const handleToggleNoteLike = async (note: Note) => {
    if (!user || !profile) {
      notify('Sign in with Google to like notes.');
      void handleSignIn();
      return;
    }
    if (note.isShowcase) {
      await seedStarterCatalog(user, profile);
      notify('Live catalog synced.');
      return;
    }
    const liked = likedNoteIds.has(note.id);
    await toggleNoteLike(note.id, user.uid, liked, {
      authorId: note.authorId,
      actorName: profile.displayName,
      body: note.body,
    });
  };

  const handleSaveProgress = useCallback(
    (postId: string, percent: number, scrollY: number) => {
      const safePct = Math.max(0, Math.min(100, Math.round(percent)));
      const safeY = Math.max(0, Math.round(scrollY));
      if (user) {
        void saveReadingProgress(user.uid, postId, safePct, safeY);
      } else {
        setGuestProgressMap((prev) => {
          const next = new Map(prev);
          next.set(postId, {
            id: `${postId}_guest`,
            userId: 'guest',
            postId,
            percent: safePct,
            scrollY: safeY,
            updatedAt: new Date(),
          });
          try {
            const serializable: Record<
              string,
              { postId: string; percent: number; scrollY: number; updatedAt: string }
            > = {};
            next.forEach((v, k) => {
              serializable[k] = {
                postId: v.postId,
                percent: v.percent,
                scrollY: v.scrollY,
                updatedAt: (v.updatedAt || new Date()).toISOString(),
              };
            });
            localStorage.setItem('folio-guest-progress', JSON.stringify(serializable));
          } catch {
            // Ignore storage errors
          }
          return next;
        });
      }
    },
    [user]
  );

  const handleCreateHighlight = async (input: {
    post: Post;
    quote: string;
    note: string;
    color: HighlightColor;
  }) => {
    if (user) {
      await createHighlight({
        userId: user.uid,
        post: input.post,
        quote: input.quote,
        note: input.note,
        color: input.color,
      });
      notify(input.note ? 'Saved highlight & margin note.' : 'Saved highlight.');
    } else {
      const localHl: Highlight = {
        id: `hl_guest_${Date.now()}`,
        userId: 'guest',
        postId: input.post.id,
        postTitle: input.post.title,
        publicationName: input.post.publicationName,
        quote: input.quote,
        note: input.note,
        color: input.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setGuestHighlights((prev) => {
        const next = [localHl, ...prev];
        try {
          localStorage.setItem('folio-guest-highlights', JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
      notify('Highlight saved locally (sign in to sync across devices).');
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (user && !highlightId.startsWith('hl_guest_')) {
      await deleteHighlight(highlightId);
      notify('Highlight removed.');
    } else {
      setGuestHighlights((prev) => {
        const next = prev.filter((h) => h.id !== highlightId);
        try {
          localStorage.setItem('folio-guest-highlights', JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
      notify('Highlight removed.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors">
      <Navbar
        route={route}
        onNavigate={navigate}
        user={user}
        profile={profile}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        authLoading={authLoading}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setSearchOpen(true)}
        notifications={notifications}
        subscriptions={subscriptions}
        posts={posts}
        onMarkNotificationRead={(id) => void markNotificationRead(id)}
        onMarkAllNotificationsRead={() => void markAllNotificationsRead(notifications)}
      />

      <div className="flex-1">
        {route.view === 'explore' && (
          <ExploreFrontPage
            posts={posts}
            publications={publications}
            notes={notes}
            subscriptions={subscriptions}
            likedPostIds={likedPostIds}
            bookmarkedPostIds={bookmarkedPostIds}
            readingProgressMap={activeProgressMap}
            onNavigate={navigate}
            onToggleSubscribe={handleToggleSubscribe}
            onToggleLike={handleTogglePostLike}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {route.view === 'notes' && (
          <NotesView
            notes={notes}
            posts={posts}
            userPublications={userPublications}
            subscriptions={subscriptions}
            user={user}
            profile={profile}
            likedNoteIds={likedNoteIds}
            onNavigate={navigate}
            onToggleNoteLike={handleToggleNoteLike}
            onSignIn={handleSignIn}
          />
        )}

        {route.view === 'subscriptions' && (
          <SubscriptionsView
            user={user}
            subscriptions={subscriptions}
            bookmarks={bookmarks}
            highlights={activeHighlights}
            readingProgressMap={activeProgressMap}
            publications={publications}
            posts={posts}
            onNavigate={navigate}
            onToggleSubscribe={handleToggleSubscribe}
            onOpenMembershipCheckout={handleOpenMembershipCheckout}
            onToggleBookmark={handleToggleBookmark}
            onDeleteHighlight={handleDeleteHighlight}
            onSignIn={handleSignIn}
            onNotify={notify}
          />
        )}

        {route.view === 'studio' && (
          <WriterStudioView
            user={user}
            profile={profile}
            userPublications={userPublications}
            authorPosts={authorPosts}
            ownerSubscribers={ownerSubscribers}
            ownerDispatches={ownerDispatches}
            hasFirestorePublications={dbPublications.length > 0}
            initialEditPostId={route.editPostId}
            onNavigate={navigate}
            onSignIn={handleSignIn}
            onNotify={notify}
            onProfileUpdated={setProfile}
          />
        )}

        {route.view === 'author' && (
          <AuthorProfileView
            authorId={route.authorId}
            publications={publications}
            posts={posts}
            notes={notes}
            subscriptions={subscriptions}
            likedPostIds={likedPostIds}
            bookmarkedPostIds={bookmarkedPostIds}
            onNavigate={navigate}
            onToggleSubscribe={handleToggleSubscribe}
            onToggleLike={handleTogglePostLike}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {route.view === 'topic' && (
          <TopicView
            tag={route.tag}
            posts={posts}
            likedPostIds={likedPostIds}
            bookmarkedPostIds={bookmarkedPostIds}
            onNavigate={navigate}
            onToggleLike={handleTogglePostLike}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {route.view === 'post' &&
          (activePost ? (
            <PostReaderView
              post={activePost}
              publication={activePublication}
              relatedPosts={relatedPosts}
              user={user}
              profile={profile}
              isSubscribed={Boolean(
                activePublication &&
                  subscriptions.some((s) => s.publicationId === activePublication.id)
              )}
              isLiked={likedPostIds.has(activePost.id)}
              isBookmarked={bookmarkedPostIds.has(activePost.id)}
              savedProgress={activeProgressMap.get(activePost.id)}
              highlights={activeHighlights}
              onNavigate={navigate}
              onToggleSubscribe={handleToggleSubscribe}
              onOpenMembershipCheckout={handleOpenMembershipCheckout}
              onToggleLike={handleTogglePostLike}
              onToggleBookmark={handleToggleBookmark}
              onSaveProgress={handleSaveProgress}
              onCreateHighlight={handleCreateHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onSignIn={handleSignIn}
              onNotify={notify}
            />
          ) : (
            <main className="max-w-[680px] mx-auto px-4 py-20 text-center">
              <h1 className="font-display text-2xl font-semibold mb-2 text-[var(--text-primary)]">
                Issue not found
              </h1>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                This essay may have been unpublished or moved to drafts.
              </p>
              <button
                type="button"
                onClick={() => navigate({ view: 'explore' })}
                className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg cursor-pointer"
              >
                Return to Dispatches
              </button>
            </main>
          ))}

        {route.view === 'publication' &&
          (activePublication ? (
            <PublicationView
              publication={activePublication}
              posts={posts.filter((p) => p.publicationId === activePublication.id)}
              subscription={subscriptions.find(
                (s) => s.publicationId === activePublication.id
              )}
              likedPostIds={likedPostIds}
              bookmarkedPostIds={bookmarkedPostIds}
              readingProgressMap={activeProgressMap}
              onNavigate={navigate}
              onToggleSubscribe={handleToggleSubscribe}
              onOpenMembershipCheckout={handleOpenMembershipCheckout}
              onToggleLike={handleTogglePostLike}
              onToggleBookmark={handleToggleBookmark}
            />
          ) : (
            <main className="max-w-[680px] mx-auto px-4 py-20 text-center">
              <h1 className="font-display text-2xl font-semibold mb-2 text-[var(--text-primary)]">
                Publication not found
              </h1>
              <button
                type="button"
                onClick={() => navigate({ view: 'explore' })}
                className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg cursor-pointer mt-4"
              >
                Browse Dispatches
              </button>
            </main>
          ))}
      </div>

      {/* Quiet Dual-Theme Editorial Footer */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-footer)] py-8 transition-colors">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-semibold text-[var(--text-primary)]">
              Folio
            </span>
            <span>Independent Publishing & Reader Network</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigate({ view: 'explore' })}
              className="hover:text-[var(--text-accent)] cursor-pointer"
            >
              Dispatches
            </button>
            <button
              type="button"
              onClick={() => navigate({ view: 'notes' })}
              className="hover:text-[var(--text-accent)] cursor-pointer"
            >
              Salon
            </button>
            <button
              type="button"
              onClick={() => navigate({ view: 'studio' })}
              className="hover:text-[var(--text-accent)] cursor-pointer"
            >
              Studio
            </button>
          </div>
        </div>
      </footer>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        posts={posts}
        publications={publications}
        notes={notes}
        onNavigate={navigate}
      />

      <MembershipCheckoutModal
        publication={checkoutPub}
        onClose={() => setCheckoutPub(null)}
        onConfirmSupport={handleConfirmSupport}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-[var(--bg-toast)] border border-[#6D28D9] text-[var(--text-primary)] text-xs font-medium px-4 py-2.5 rounded-lg shadow-2xl max-w-sm"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FolioAppContent />
    </ErrorBoundary>
  );
}
