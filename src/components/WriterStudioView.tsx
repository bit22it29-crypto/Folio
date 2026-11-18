import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bold,
  CalendarClock,
  Check,
  Code,
  Copy,
  Download,
  Edit3,
  Eye,
  Heading2,
  History,
  ImagePlus,
  Italic,
  Link2,
  Mail,
  MessageSquare,
  Minus,
  Pin,
  Plus,
  Quote,
  RotateCcw,
  Rss,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EDITORIAL_IMAGES } from '../data/showcaseContent';
import {
  createPost,
  createPostRevision,
  createPublication,
  deletePost,
  deletePublication,
  notifySubscribersOfIssue,
  recordNewsletterDispatch,
  seedStarterCatalog,
  setPublicationPinnedPost,
  subscribePostRevisions,
  updatePost,
  updatePublication,
  updateUserProfile,
} from '../lib/firestoreService';
import { formatEditorialDate, renderMarkdownToSafeHtml } from '../lib/markdown';
import { countWords, estimateReadTimeMinutes, normalizeTags } from '../lib/validation';
import {
  CATEGORIES,
  type AccessTier,
  type AppRoute,
  type Category,
  type NewsletterDispatch,
  type Post,
  type PostRevision,
  type PostStatus,
  type Publication,
  type Subscription,
  type UserProfile,
} from '../types/folio';

interface WriterStudioViewProps {
  user: User | null;
  profile: UserProfile | null;
  userPublications: Publication[];
  allPublications: Publication[];
  authorPosts: Post[];
  ownerSubscribers: Subscription[];
  ownerDispatches: NewsletterDispatch[];
  commentCounts: Map<string, number>;
  hasFirestorePublications: boolean;
  initialEditPostId?: string;
  onNavigate: (route: AppRoute) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
  onProfileUpdated: (profile: UserProfile) => void;
}

const ACCENT_SWATCHES = ['#8B5CF6', '#7C3AED', '#A855F7', '#9333EA', '#6D28D9'];

const COVER_PRESETS = [
  { label: 'Library Hall', url: EDITORIAL_IMAGES.architecture },
  { label: 'Desk & Notebook', url: EDITORIAL_IMAGES.computing },
  { label: 'Botanical Folio', url: EDITORIAL_IMAGES.botanical },
  { label: 'Dawn Tram', url: EDITORIAL_IMAGES.transit },
  { label: 'Ceramic Studio', url: EDITORIAL_IMAGES.studio },
];

function toDatetimeLocalValue(date: Date | null | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

async function uploadCoverFileToServer(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Image must be 2MB or smaller.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read file.'));
    };
    reader.onerror = () => reject(new Error('File read error.'));
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/uploads/cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, filename: file.name }),
  });
  const payload = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !payload.url) {
    throw new Error(payload.error || 'Upload failed.');
  }
  return payload.url;
}

export function WriterStudioView({
  user,
  profile,
  userPublications,
  allPublications,
  authorPosts,
  ownerSubscribers,
  ownerDispatches,
  commentCounts,
  hasFirestorePublications,
  initialEditPostId,
  onNavigate,
  onSignIn,
  onNotify,
  onProfileUpdated,
}: WriterStudioViewProps) {
  const [studioTab, setStudioTab] = useState<
    'write' | 'posts' | 'subscribers' | 'analytics' | 'settings'
  >('write');
  const [selectedPubId, setSelectedPubId] = useState<string>('');
  const [creatingPub, setCreatingPub] = useState(false);

  // Publication form state
  const [pubName, setPubName] = useState('');
  const [pubTagline, setPubTagline] = useState('');
  const [pubDescription, setPubDescription] = useState('');
  const [pubWelcomeNote, setPubWelcomeNote] = useState('');
  const [pubCategory, setPubCategory] = useState<Category>('Essays');
  const [pubAccent, setPubAccent] = useState('#8B5CF6');
  const [pubCover, setPubCover] = useState<string>(EDITORIAL_IMAGES.architecture);
  const [pubRecommendedIds, setPubRecommendedIds] = useState<string[]>([]);
  const [uploadingPubCover, setUploadingPubCover] = useState(false);
  const [savingPub, setSavingPub] = useState(false);
  const [confirmDeletePub, setConfirmDeletePub] = useState(false);

  // Posts tab filtering
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | PostStatus>('all');
  const [postSearchQuery, setPostSearchQuery] = useState('');

  // Author Profile state
  const [authorNameInput, setAuthorNameInput] = useState('');
  const [authorHandleInput, setAuthorHandleInput] = useState('');
  const [authorBioInput, setAuthorBioInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Post composer state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [postCategory, setPostCategory] = useState<Category>('Essays');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [tagDraftInput, setTagDraftInput] = useState('');
  const [postCover, setPostCover] = useState<string>(EDITORIAL_IMAGES.architecture);
  const [uploadingPostCover, setUploadingPostCover] = useState(false);
  const [accessTier, setAccessTier] = useState<AccessTier>('free');
  const [scheduledForInput, setScheduledForInput] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [editorMode, setEditorMode] = useState<'compose' | 'split' | 'preview'>('split');
  const [savingPost, setSavingPost] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Auto-save & revision history state
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<{
    title: string;
    subtitle: string;
    contentMarkdown: string;
    savedAt: string;
  } | null>(null);
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Email newsletter preview & dispatch modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailHtml, setEmailHtml] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [dispatchingEmail, setDispatchingEmail] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState<{
    messageId: string;
    recipientCount: number;
    sentAt: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedRss, setCopiedRss] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePub =
    userPublications.find((p) => p.id === selectedPubId) || userPublications[0] || null;

  useEffect(() => {
    if (activePub && !selectedPubId) {
      setSelectedPubId(activePub.id);
    }
  }, [activePub, selectedPubId]);

  useEffect(() => {
    if (profile) {
      setAuthorNameInput(profile.displayName);
      setAuthorHandleInput(profile.handle);
      setAuthorBioInput(profile.bio);
    }
  }, [profile]);

  useEffect(() => {
    if (activePub && !creatingPub) {
      setPubName(activePub.name);
      setPubTagline(activePub.tagline);
      setPubDescription(activePub.description);
      setPubWelcomeNote(activePub.welcomeNote || '');
      setPubCategory(activePub.category);
      setPubAccent(activePub.accentColor);
      setPubCover(activePub.coverImageUrl || EDITORIAL_IMAGES.architecture);
      setPubRecommendedIds(activePub.recommendedPubIds || []);
      if (!editingPostId) {
        setPostCategory(activePub.category);
      }
    }
  }, [activePub, creatingPub, editingPostId]);

  useEffect(() => {
    if (initialEditPostId) {
      const target = authorPosts.find((p) => p.id === initialEditPostId);
      if (target) {
        loadPostIntoEditor(target);
      }
    }
  }, [initialEditPostId, authorPosts]);

  // Subscribe to post revisions when editing an existing post
  useEffect(() => {
    if (!editingPostId || !user) {
      setRevisions([]);
      return;
    }
    const unsub = subscribePostRevisions(editingPostId, user.uid, setRevisions);
    return () => unsub();
  }, [editingPostId, user]);

  // Check for recoverable localStorage draft on mount/switch
  useEffect(() => {
    if (!user) return;
    const key = `folio_autosave_${user.uid}_${editingPostId || 'new'}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setRecoverableDraft(null);
        return;
      }
      const parsed = JSON.parse(raw) as {
        title?: string;
        subtitle?: string;
        contentMarkdown?: string;
        savedAt?: string;
      };
      if (
        parsed.contentMarkdown &&
        parsed.contentMarkdown.trim().length > 0 &&
        parsed.contentMarkdown !== contentMarkdown
      ) {
        setRecoverableDraft({
          title: parsed.title || '',
          subtitle: parsed.subtitle || '',
          contentMarkdown: parsed.contentMarkdown,
          savedAt: parsed.savedAt || '',
        });
      } else {
        setRecoverableDraft(null);
      }
    } catch {
      setRecoverableDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, editingPostId]);

  // Periodic local auto-save of composer state
  useEffect(() => {
    if (!user || (!title.trim() && !contentMarkdown.trim())) return;
    const key = `folio_autosave_${user.uid}_${editingPostId || 'new'}`;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        localStorage.setItem(
          key,
          JSON.stringify({ title, subtitle, contentMarkdown, savedAt })
        );
        setAutoSavedAt(savedAt);
      } catch {
        // Ignore storage errors
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, editingPostId, title, subtitle, contentMarkdown]);

  function clearAutosaveKey(postId: string | null) {
    if (!user) return;
    try {
      localStorage.removeItem(`folio_autosave_${user.uid}_${postId || 'new'}`);
      setAutoSavedAt(null);
      setRecoverableDraft(null);
    } catch {
      // Ignore storage error
    }
  }

  function loadPostIntoEditor(post: Post) {
    setEditingPostId(post.id);
    setSelectedPubId(post.publicationId);
    setTitle(post.title);
    setSubtitle(post.subtitle);
    setPostCategory(post.category);
    setPostTags(post.tags || []);
    setTagDraftInput('');
    setPostCover(post.coverImageUrl);
    setAccessTier(post.accessTier);
    setScheduledForInput(toDatetimeLocalValue(post.scheduledFor));
    setContentMarkdown(post.contentMarkdown);
    setStudioTab('write');
  }

  function resetComposer() {
    clearAutosaveKey(editingPostId);
    setEditingPostId(null);
    setTitle('');
    setSubtitle('');
    setPostCategory(activePub?.category || 'Essays');
    setPostTags([]);
    setTagDraftInput('');
    setPostCover(activePub?.coverImageUrl || EDITORIAL_IMAGES.architecture);
    setAccessTier('free');
    setScheduledForInput('');
    setContentMarkdown('');
  }

  function addTagTokens(raw: string) {
    const incoming = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;
    setPostTags((prev) => normalizeTags([...prev, ...incoming]));
    setTagDraftInput('');
  }

  function insertMarkdown(before: string, after = '', placeholder = '') {
    const el = textareaRef.current;
    if (!el) {
      setContentMarkdown((prev) => `${prev}${before}${placeholder}${after}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = contentMarkdown.slice(start, end) || placeholder;
    const next =
      contentMarkdown.slice(0, start) +
      before +
      selected +
      after +
      contentMarkdown.slice(end);
    setContentMarkdown(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  const handleUploadCover = async (
    file: File,
    target: 'publication' | 'post'
  ) => {
    if (target === 'publication') setUploadingPubCover(true);
    else setUploadingPostCover(true);
    try {
      const uploadedUrl = await uploadCoverFileToServer(file);
      if (target === 'publication') setPubCover(uploadedUrl);
      else setPostCover(uploadedUrl);
      onNotify('Cover image uploaded.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to upload cover.');
    } finally {
      if (target === 'publication') setUploadingPubCover(false);
      else setUploadingPostCover(false);
    }
  };

  const handleSavePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!pubName.trim() || !pubTagline.trim()) {
      onNotify('Please provide a publication name and tagline.');
      return;
    }
    setSavingPub(true);
    try {
      if (creatingPub || !activePub) {
        const created = await createPublication({
          user,
          profile,
          name: pubName,
          tagline: pubTagline,
          description: pubDescription,
          welcomeNote: pubWelcomeNote,
          category: pubCategory,
          accentColor: pubAccent,
          coverImageUrl: pubCover,
        });
        setSelectedPubId(created.id);
        setCreatingPub(false);
        setStudioTab('write');
        onNotify(`Launched "${created.name}".`);
      } else {
        await updatePublication(activePub.id, {
          ownerName: profile.displayName,
          name: pubName,
          tagline: pubTagline,
          description: pubDescription,
          welcomeNote: pubWelcomeNote,
          category: pubCategory,
          accentColor: pubAccent,
          coverImageUrl: pubCover,
          recommendedPubIds: pubRecommendedIds,
        });
        onNotify('Publication settings updated.');
      }
    } finally {
      setSavingPub(false);
    }
  };

  const handleDeletePublication = async () => {
    if (!activePub) return;
    await deletePublication(activePub.id);
    setConfirmDeletePub(false);
    setSelectedPubId('');
    setStudioTab('write');
    onNotify(`Deleted publication "${activePub.name}".`);
  };

  const handleSaveAuthorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!authorNameInput.trim()) {
      onNotify('Display name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateUserProfile(user.uid, {
        displayName: authorNameInput,
        handle: authorHandleInput,
        bio: authorBioInput,
        avatarUrl: profile.avatarUrl,
      });
      onProfileUpdated({
        ...profile,
        displayName: updated.displayName,
        handle: updated.handle,
        bio: updated.bio,
      });
      onNotify('Author profile updated.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePost = async (targetStatus: PostStatus) => {
    if (!user || !profile || !activePub) return;
    if (title.trim().length < 2) {
      onNotify('Please enter a headline for your issue.');
      return;
    }
    if (contentMarkdown.trim().length < 10) {
      onNotify('Please write at least a short paragraph before saving.');
      return;
    }

    let scheduledDate: Date | null = null;
    if (targetStatus === 'scheduled') {
      if (!scheduledForInput) {
        onNotify('Pick a future date and time to schedule this issue.');
        return;
      }
      const parsed = new Date(scheduledForInput);
      if (Number.isNaN(parsed.getTime())) {
        onNotify('Invalid schedule date.');
        return;
      }
      scheduledDate = parsed;
    }

    setSavingPost(true);
    try {
      const existing = editingPostId
        ? authorPosts.find((p) => p.id === editingPostId)
        : undefined;

      if (existing) {
        await updatePost(existing, {
          title,
          subtitle,
          category: postCategory,
          tags: postTags,
          coverImageUrl: postCover,
          contentMarkdown,
          accessTier,
          status: targetStatus,
          scheduledFor: scheduledDate,
        });
        await createPostRevision({
          postId: existing.id,
          authorId: user.uid,
          title,
          subtitle,
          contentMarkdown,
          summary:
            targetStatus === 'published'
              ? 'Published issue snapshot'
              : targetStatus === 'scheduled'
              ? `Scheduled for ${scheduledDate?.toLocaleString()}`
              : 'Draft saved',
        });
        clearAutosaveKey(existing.id);
        if (targetStatus === 'published' && existing.status !== 'published') {
          void notifySubscribersOfIssue({
            subscribers: pubSubscribers,
            actorId: user.uid,
            actorName: profile.displayName,
            publicationName: activePub.name,
            publicationSlug: activePub.slug,
            postId: existing.id,
            postTitle: title,
          });
        }
        onNotify(
          targetStatus === 'published'
            ? 'Issue updated and published.'
            : targetStatus === 'scheduled'
            ? `Scheduled for ${scheduledDate?.toLocaleString()}.`
            : 'Saved to drafts.'
        );
      } else {
        const newId = await createPost({
          user,
          profile,
          publication: activePub,
          title,
          subtitle,
          category: postCategory,
          tags: postTags,
          coverImageUrl: postCover,
          contentMarkdown,
          accessTier,
          status: targetStatus,
          scheduledFor: scheduledDate,
        });
        await createPostRevision({
          postId: newId,
          authorId: user.uid,
          title,
          subtitle,
          contentMarkdown,
          summary:
            targetStatus === 'published'
              ? 'Initial published snapshot'
              : targetStatus === 'scheduled'
              ? `Scheduled for ${scheduledDate?.toLocaleString()}`
              : 'Initial draft',
        });
        clearAutosaveKey(null);
        setEditingPostId(newId);
        if (targetStatus === 'published') {
          void notifySubscribersOfIssue({
            subscribers: pubSubscribers,
            actorId: user.uid,
            actorName: profile.displayName,
            publicationName: activePub.name,
            publicationSlug: activePub.slug,
            postId: newId,
            postTitle: title,
          });
        }
        onNotify(
          targetStatus === 'published'
            ? 'Issue published to your archive and RSS feed.'
            : targetStatus === 'scheduled'
            ? `Issue scheduled for ${scheduledDate?.toLocaleString()}.`
            : 'Saved to drafts.'
        );
      }
    } finally {
      setSavingPost(false);
    }
  };

  const handleSaveManualSnapshot = async () => {
    if (!user || !editingPostId) {
      onNotify('Save your draft once before creating named snapshots.');
      return;
    }
    setSavingSnapshot(true);
    try {
      await createPostRevision({
        postId: editingPostId,
        authorId: user.uid,
        title,
        subtitle,
        contentMarkdown,
        summary: 'Manual checkpoint',
      });
      onNotify('Saved revision snapshot.');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleExportSubscribersCsv = () => {
    if (!activePub || pubSubscribers.length === 0) return;
    const rows = [
      ['Reader', 'Tier', 'Status', 'Joined'].map(escapeCsvCell).join(','),
      ...pubSubscribers.map((sub) =>
        [
          sub.subscriberName,
          sub.tier,
          sub.status,
          formatEditorialDate(sub.createdAt),
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePub.slug}-subscribers.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`Exported ${pubSubscribers.length} subscribers to CSV.`);
  };

  const handleOpenEmailPreview = async () => {
    if (!activePub) return;
    setEmailModalOpen(true);
    setDispatchReceipt(null);
    setLoadingEmail(true);
    try {
      const res = await fetch('/api/newsletter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationName: activePub.name,
          publicationTagline: activePub.tagline,
          accentColor: activePub.accentColor,
          authorName: profile?.displayName || 'Editorial Team',
          title: title || 'Untitled Issue',
          subtitle,
          contentMarkdown:
            contentMarkdown || 'Start writing your issue to preview email formatting.',
          coverImageUrl: postCover,
        }),
      });
      const data = (await res.json()) as { html?: string };
      setEmailHtml(data.html || '');
    } catch {
      onNotify('Could not compile email preview.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleSendDispatch = async () => {
    if (!activePub || !user) return;
    setDispatchingEmail(true);
    try {
      const dispatchTitle = title || 'Untitled Issue';
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationName: activePub.name,
          publicationTagline: activePub.tagline,
          accentColor: activePub.accentColor,
          authorName: profile?.displayName || 'Editorial Team',
          title: dispatchTitle,
          subtitle,
          contentMarkdown,
          coverImageUrl: postCover,
          subscriberCount: pubSubscribers.length,
        }),
      });
      const data = (await res.json()) as {
        messageId: string;
        recipientCount: number;
        sentAt: string;
      };
      setDispatchReceipt(data);
      await recordNewsletterDispatch({
        publicationId: activePub.id,
        ownerId: user.uid,
        postId: editingPostId || undefined,
        title: dispatchTitle,
        recipientCount: data.recipientCount,
        messageId: data.messageId,
      });
      onNotify(
        `Compiled & queued dispatch (${data.recipientCount} ${
          data.recipientCount === 1 ? 'subscriber' : 'subscribers'
        }).`
      );
    } catch {
      onNotify('Failed to compile dispatch.');
    } finally {
      setDispatchingEmail(false);
    }
  };

  const handleCopyEmailHtml = async () => {
    if (!emailHtml) return;
    await navigator.clipboard.writeText(emailHtml);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSeedCatalog = async () => {
    if (!user || !profile) return;
    setSeeding(true);
    try {
      await seedStarterCatalog(user, profile);
      onNotify('Starter publications and essays loaded into your account.');
    } finally {
      setSeeding(false);
    }
  };

  if (!user) {
    return (
      <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-3xl sm:text-5xl font-semibold text-[var(--text-primary)] headline-balance mb-4">
          Publish Directly to Your Readers
        </h1>
        <p className="text-base text-[var(--text-secondary)] max-w-lg mx-auto mb-8 leading-relaxed">
          Launch an independent publication, write long-form Markdown issues, schedule releases, compile newsletter HTML digests, and serve a live RSS feed.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-5 py-3 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
        >
          Sign In with Google to Start Writing
        </button>
      </main>
    );
  }

  const pubPosts = authorPosts.filter((p) => p.publicationId === activePub?.id);
  const pubSubscribers = ownerSubscribers.filter(
    (s) => s.publicationId === activePub?.id
  );
  const pubDispatches = ownerDispatches.filter(
    (d) => d.publicationId === activePub?.id
  );
  const publishedCount = pubPosts.filter((p) => p.status === 'published').length;
  const scheduledCount = pubPosts.filter((p) => p.status === 'scheduled').length;
  const draftCount = pubPosts.filter((p) => p.status === 'draft').length;
  const supportingCount = pubSubscribers.filter((s) => s.tier === 'supporting').length;
  const totalLikes = pubPosts.reduce((sum, p) => sum + p.likesCount, 0);
  const totalComments = pubPosts.reduce(
    (sum, p) => sum + (commentCounts.get(p.id) || 0),
    0
  );
  const filteredPubPosts = pubPosts.filter((p) => {
    if (postStatusFilter !== 'all' && p.status !== postStatusFilter) return false;
    const q = postSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });
  const recommendablePubs = activePub
    ? allPublications.filter((p) => p.id !== activePub.id && !p.isShowcase)
    : [];
  const rssPath = activePub
    ? `${window.location.origin}/api/publications/${encodeURIComponent(activePub.slug)}/rss.xml`
    : '';

  if (userPublications.length === 0 || creatingPub) {
    return (
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 pb-24">
        <div className="pb-6 border-b border-[var(--border-hairline)] mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[var(--text-primary)] mb-1">
              Launch Your Publication
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Set up your masthead, editorial beat, and purple accent branding.
            </p>
          </div>
          {creatingPub && userPublications.length > 0 && (
            <button
              type="button"
              onClick={() => setCreatingPub(false)}
              className="px-3.5 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-body)] rounded-lg hover:border-[var(--accent-border)] self-start cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {!hasFirestorePublications && (
          <div className="mb-8 p-5 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Want to start with curated publications?
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Import 4 flagship publications, 5 essays, and 3 notes into your live Firestore workspace.
              </p>
            </div>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedCatalog}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {seeding ? 'Importing...' : 'Import Sample Catalog'}
            </button>
          </div>
        )}

        <form onSubmit={handleSavePublication} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
              Publication Name
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={pubName}
              onChange={(e) => setPubName(e.target.value)}
              placeholder="e.g. Obsidian Quarterly"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
              One-Line Tagline
            </label>
            <input
              type="text"
              required
              maxLength={160}
              value={pubTagline}
              onChange={(e) => setPubTagline(e.target.value)}
              placeholder="What readers can expect in their inbox"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                Category
              </label>
              <select
                value={pubCategory}
                onChange={(e) => setPubCategory(e.target.value as Category)}
                className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                Masthead Accent Color
              </label>
              <div className="flex items-center gap-2.5 pt-1">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Select color ${swatch}`}
                    onClick={() => setPubAccent(swatch)}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform cursor-pointer ${
                      pubAccent === swatch
                        ? 'border-[var(--text-primary)] scale-105'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
              About This Publication
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={pubDescription}
              onChange={(e) => setPubDescription(e.target.value)}
              placeholder="Tell readers about your publishing cadence and focus..."
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
              Welcome Message for New Subscribers
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={pubWelcomeNote}
              onChange={(e) => setPubWelcomeNote(e.target.value)}
              placeholder="Optional greeting sent to readers the moment they subscribe..."
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-body)] mb-2">
              Publication Cover Visual
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COVER_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setPubCover(preset.url)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    pubCover === preset.url
                      ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={pubCover}
                onChange={(e) => setPubCover(e.target.value)}
                placeholder="Or paste custom cover image URL..."
                className="flex-1 px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
              />
              <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPubCover ? 'Uploading...' : 'Upload File'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadCover(file, 'publication');
                  }}
                />
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingPub}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingPub ? 'Creating...' : 'Create Publication'}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Studio Workspace Bar */}
      <div className="pb-6 border-b border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activePub?.id || ''}
            onChange={(e) => setSelectedPubId(e.target.value)}
            aria-label="Select publication"
            className="font-display text-xl font-semibold bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
          >
            {userPublications.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setPubName('');
              setPubTagline('');
              setPubDescription('');
              setPubWelcomeNote('');
              setCreatingPub(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Publication</span>
          </button>

          {activePub && (
            <button
              type="button"
              onClick={() => onNavigate({ view: 'publication', slug: activePub.slug })}
              className="text-xs font-medium text-[var(--text-accent-soft)] hover:underline cursor-pointer"
            >
              View Public Site
            </button>
          )}
        </div>

        <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg overflow-x-auto">
          {(
            [
              { id: 'write', label: editingPostId ? 'Edit Issue' : 'Write Issue' },
              { id: 'posts', label: `Posts (${pubPosts.length})` },
              { id: 'subscribers', label: `Subscribers (${pubSubscribers.length})` },
              { id: 'analytics', label: 'Analytics' },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStudioTab(item.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                studioTab === item.id
                  ? 'bg-[var(--accent-solid)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Issue Composer */}
      {studioTab === 'write' && activePub && (
        <section>
          {/* Recoverable Auto-save Notice */}
          {recoverableDraft && (
            <div className="mb-5 p-3.5 rounded-xl border border-[var(--accent-border)]/50 bg-[var(--bg-active-soft)] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Unsaved local auto-save found ({recoverableDraft.savedAt || 'recent'}).
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTitle(recoverableDraft.title);
                    setSubtitle(recoverableDraft.subtitle);
                    setContentMarkdown(recoverableDraft.contentMarkdown);
                    setRecoverableDraft(null);
                    onNotify('Restored local auto-save.');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => clearAutosaveKey(editingPostId)}
                  className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg">
                {(['compose', 'split', 'preview'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditorMode(m)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                      editorMode === m
                        ? 'bg-[var(--accent-solid)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {editingPostId && (
                <>
                  <button
                    type="button"
                    onClick={resetComposer}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--text-accent-soft)] hover:underline cursor-pointer"
                  >
                    + Start Fresh Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevisionsOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--accent-border)] cursor-pointer tabular-nums"
                  >
                    <History className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                    <span>Revisions ({revisions.length})</span>
                  </button>
                </>
              )}

              {autoSavedAt && (
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  Auto-saved {autoSavedAt}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {editingPostId && (
                <button
                  type="button"
                  disabled={savingSnapshot}
                  onClick={handleSaveManualSnapshot}
                  title="Save Revision Snapshot"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--accent-border)] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {savingSnapshot ? 'Saving...' : 'Snapshot'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenEmailPreview}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-primary)] hover:border-[var(--accent-border)] cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                <span>Email Preview</span>
              </button>

              <button
                type="button"
                disabled={savingPost}
                onClick={() => handleSavePost('draft')}
                className="px-3.5 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-body)] hover:border-[var(--accent-border)] disabled:opacity-50 cursor-pointer"
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={savingPost || !scheduledForInput}
                onClick={() => handleSavePost('scheduled')}
                title="Schedule Issue for selected date & time"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--accent-border)] bg-[var(--bg-active-soft)] rounded-lg text-[var(--text-accent)] hover:bg-[var(--accent-solid)] hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>Schedule</span>
              </button>

              <button
                type="button"
                disabled={savingPost}
                onClick={() => handleSavePost('published')}
                className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                {savingPost ? 'Saving...' : 'Publish Issue'}
              </button>
            </div>
          </div>

          {/* Issue Metadata Controls */}
          <div className="p-4 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Category
                </label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value as Category)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Audience Access
                </label>
                <select
                  value={accessTier}
                  onChange={(e) => setAccessTier(e.target.value as AccessTier)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="free">Free for everyone</option>
                  <option value="subscribers">Subscribers only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Schedule Publish (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledForInput}
                  onChange={(e) => setScheduledForInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Cover Preset
                </label>
                <select
                  value={
                    COVER_PRESETS.some((p) => p.url === postCover) ? postCover : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'custom') setPostCover(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                >
                  {COVER_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="">No cover image</option>
                  {!COVER_PRESETS.some((p) => p.url === postCover) && postCover && (
                    <option value="custom">Custom / Uploaded Cover</option>
                  )}
                </select>
              </div>
            </div>

            {/* Cover Upload + Custom URL + Topic Tags */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Custom Cover URL or Local Image Upload (max 2MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={postCover}
                    onChange={(e) => setPostCover(e.target.value)}
                    placeholder="https://... or /uploads/..."
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] rounded-lg text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer shrink-0">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{uploadingPostCover ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadCover(file, 'post');
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Topic Tags (up to 5, press Enter or comma)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg min-h-[34px]">
                  {postTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-[var(--bg-active-soft)] text-[var(--text-accent)] border border-[var(--border-strong)]"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() =>
                          setPostTags((prev) => prev.filter((item) => item !== t))
                        }
                        aria-label={`Remove tag ${t}`}
                        className="hover:text-[var(--text-danger)] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {postTags.length < 5 && (
                    <input
                      type="text"
                      value={tagDraftInput}
                      onChange={(e) => setTagDraftInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTagTokens(tagDraftInput);
                        }
                      }}
                      onBlur={() => {
                        if (tagDraftInput.trim()) addTagTokens(tagDraftInput);
                      }}
                      placeholder={postTags.length === 0 ? 'e.g. architecture, typography' : 'Add tag...'}
                      className="flex-1 min-w-[120px] py-0.5 text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`grid gap-8 ${
              editorMode === 'split'
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1 max-w-[820px] mx-auto'
            }`}
          >
            {editorMode !== 'preview' && (
              <div className="space-y-4">
                <input
                  type="text"
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Issue headline..."
                  className="w-full font-display text-3xl font-semibold bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] border-0 border-b border-[var(--border-hairline)] pb-3 focus:outline-none focus:border-[var(--accent-border)]"
                />
                <input
                  type="text"
                  maxLength={240}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Optional subtitle or deck..."
                  className="w-full text-base bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-placeholder)] border-0 border-b border-[var(--border-subtle)] pb-3 focus:outline-none focus:border-[var(--accent-border)]"
                />

                {/* Markdown Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-1.5 border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface)]">
                  <button
                    type="button"
                    title="Heading"
                    onClick={() => insertMarkdown('\n## ', '', 'Section Heading')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Heading2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Bold"
                    onClick={() => insertMarkdown('**', '**', 'bold text')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onClick={() => insertMarkdown('*', '*', 'italic text')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Pull Quote"
                    onClick={() => insertMarkdown('\n> ', '\n', 'Pull quote text')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Code"
                    onClick={() => insertMarkdown('`', '`', 'code')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Link"
                    onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Section Divider"
                    onClick={() => insertMarkdown('\n\n---\n\n')}
                    className="p-2 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <span className="ml-auto px-2 text-xs text-[var(--text-accent-soft)] tabular-nums">
                    {countWords(contentMarkdown).toLocaleString()} words ·{' '}
                    {estimateReadTimeMinutes(contentMarkdown)} min read
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={18}
                  maxLength={60000}
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                  placeholder="Write your essay in Markdown..."
                  className="w-full p-4 text-[15px] leading-relaxed bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-border)] font-sans"
                />
              </div>
            )}

            {editorMode !== 'compose' && (
              <div className="border border-[var(--border-hairline)] rounded-xl p-6 sm:p-8 bg-[var(--bg-surface)]">
                <p className="text-xs text-[var(--text-accent-soft)] mb-3">
                  {activePub.name} · {postCategory} ·{' '}
                  {accessTier === 'subscribers' ? 'Subscribers Only' : 'Free'}
                </p>
                <h2 className="font-display text-3xl font-semibold text-[var(--text-primary)] headline-balance mb-3">
                  {title || 'Your Issue Headline'}
                </h2>
                {subtitle && (
                  <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-4">
                    {subtitle}
                  </p>
                )}
                {postTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {postTags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className="folio-prose"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToSafeHtml(
                      contentMarkdown ||
                        '*Your live formatted preview appears here as you write.*'
                    ),
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Posts, Scheduled & Drafts */}
      {studioTab === 'posts' && activePub && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              Issues & Drafts
            </h2>
            <button
              type="button"
              onClick={() => {
                resetComposer();
                setStudioTab('write');
              }}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] self-start sm:self-auto cursor-pointer"
            >
              New Issue
            </button>
          </div>

          {pubPosts.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg overflow-x-auto self-start">
                {(
                  [
                    { id: 'all', label: `All (${pubPosts.length})` },
                    { id: 'published', label: `Published (${publishedCount})` },
                    { id: 'scheduled', label: `Scheduled (${scheduledCount})` },
                    { id: 'draft', label: `Drafts (${draftCount})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPostStatusFilter(item.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                      postStatusFilter === item.id
                        ? 'bg-[var(--accent-solid)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
                  placeholder="Filter issues by title or tag..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)]"
                />
              </div>
            </div>
          )}

          {pubPosts.length === 0 ? (
            <div className="border border-[var(--border-hairline)] rounded-xl p-10 text-center bg-[var(--bg-surface)]">
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                You haven’t written any drafts or published issues in {activePub.name} yet.
              </p>
              <button
                type="button"
                onClick={() => setStudioTab('write')}
                className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg cursor-pointer"
              >
                Write First Issue
              </button>
            </div>
          ) : filteredPubPosts.length === 0 ? (
            <div className="border border-[var(--border-hairline)] rounded-xl p-8 text-center bg-[var(--bg-surface)]">
              <p className="text-sm text-[var(--text-muted)]">
                No issues match your current filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)]">
              {filteredPubPosts.map((post) => {
                const isPinned = activePub.pinnedPostId === post.id;
                const respCount = commentCounts.get(post.id) || 0;
                return (
                  <div
                    key={post.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
                        <span
                          className={`font-semibold ${
                            post.status === 'published'
                              ? 'text-[var(--text-success)]'
                              : post.status === 'scheduled'
                              ? 'text-[var(--text-accent)]'
                              : 'text-[var(--text-warning)]'
                          }`}
                        >
                          {post.status === 'published'
                            ? 'Published'
                            : post.status === 'scheduled'
                            ? `Scheduled (${
                                post.scheduledFor
                                  ? post.scheduledFor.toLocaleString()
                                  : 'Pending'
                              })`
                            : 'Draft'}
                        </span>
                        {isPinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[var(--text-accent)] font-semibold">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{post.accessTier === 'subscribers' ? 'Subscribers' : 'Free'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatEditorialDate(post.publishedAt || post.updatedAt)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{post.likesCount} likes</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{respCount} responses</span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] truncate">
                        {post.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {post.status === 'published' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await setPublicationPinnedPost(
                              activePub.id,
                              isPinned ? null : post.id
                            );
                            onNotify(
                              isPinned
                                ? 'Unpinned issue from publication masthead.'
                                : 'Pinned issue to top of publication page.'
                            );
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-lg cursor-pointer ${
                            isPinned
                              ? 'border-[var(--accent-border)] bg-[var(--accent-solid)]/15 text-[var(--text-accent)]'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                          <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus: PostStatus =
                            post.status === 'published' ? 'draft' : 'published';
                          await updatePost(post, {
                            title: post.title,
                            subtitle: post.subtitle,
                            category: post.category,
                            tags: post.tags,
                            coverImageUrl: post.coverImageUrl,
                            contentMarkdown: post.contentMarkdown,
                            accessTier: post.accessTier,
                            status: nextStatus,
                          });
                          if (nextStatus === 'published' && profile) {
                            void notifySubscribersOfIssue({
                              subscribers: pubSubscribers,
                              actorId: user.uid,
                              actorName: profile.displayName,
                              publicationName: activePub.name,
                              publicationSlug: activePub.slug,
                              postId: post.id,
                              postTitle: post.title,
                            });
                          }
                          onNotify(
                            nextStatus === 'published'
                              ? 'Issue published.'
                              : 'Reverted to draft.'
                          );
                        }}
                        className="px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer"
                      >
                        {post.status === 'published' ? 'Unpublish' : 'Publish Now'}
                      </button>

                      {post.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => onNavigate({ view: 'post', postId: post.id })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-body)] hover:border-[var(--accent-border)] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => loadPostIntoEditor(post)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-body)] hover:border-[var(--accent-border)] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {confirmDeleteId === post.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await deletePost(post.id);
                              setConfirmDeleteId(null);
                              if (editingPostId === post.id) resetComposer();
                              onNotify('Issue deleted.');
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium bg-[#B91C1C] text-white rounded-lg cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 text-xs text-[var(--text-muted)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(post.id)}
                          aria-label={`Delete ${post.title}`}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-danger)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Subscribers & RSS Distribution */}
      {studioTab === 'subscribers' && activePub && (
        <section className="space-y-8">
          <div className="p-5 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] mb-1">
                <Rss className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                <span>Live Publication RSS 2.0 Feed</span>
              </div>
              <p className="font-mono text-xs text-[var(--text-secondary)] truncate">{rssPath}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(rssPath);
                  setCopiedRss(true);
                  setTimeout(() => setCopiedRss(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-body)] hover:border-[var(--accent-border)] cursor-pointer"
              >
                {copiedRss ? (
                  <Check className="w-3.5 h-3.5 text-[var(--text-success)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedRss ? 'Copied' : 'Copy Feed URL'}</span>
              </button>
              <a
                href={rssPath}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)]"
              >
                Open XML
              </a>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                Subscriber Roster
              </h2>
              {pubSubscribers.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportSubscribersCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-primary)] hover:border-[var(--accent-border)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            {pubSubscribers.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No subscribers yet. Share your publication page to start growing your audience.
              </p>
            ) : (
              <div className="overflow-x-auto border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Reader</th>
                      <th className="py-3 px-4 font-semibold">Tier</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)] tabular-nums">
                    {pubSubscribers.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                          {sub.subscriberName}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-accent)] capitalize">
                          {sub.tier}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-success)] capitalize">
                          {sub.status}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)]">
                          {formatEditorialDate(sub.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 4: Analytics & Dispatch History */}
      {studioTab === 'analytics' && activePub && (
        <section className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total Subscribers</p>
              <p className="font-display text-3xl font-semibold text-[var(--text-primary)] tabular-nums">
                {pubSubscribers.length}
              </p>
              <p className="text-xs text-[var(--text-accent-soft)] mt-1 tabular-nums">
                {supportingCount} supporting · {pubSubscribers.length - supportingCount} free
              </p>
            </div>

            <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Published Issues</p>
              <p className="font-display text-3xl font-semibold text-[var(--text-primary)] tabular-nums">
                {publishedCount}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                {draftCount} drafts · {scheduledCount} scheduled
              </p>
            </div>

            <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Reader Engagement</p>
              <p className="font-display text-3xl font-semibold text-[var(--text-primary)] tabular-nums">
                {totalLikes}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                likes · {totalComments} {totalComments === 1 ? 'response' : 'responses'}
              </p>
            </div>

            <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Dispatches Sent</p>
              <p className="font-display text-3xl font-semibold text-[var(--text-primary)] tabular-nums">
                {pubDispatches.length}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                {pubDispatches.reduce((sum, d) => sum + d.recipientCount, 0)} total deliveries
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5">
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] pb-3 border-b border-[var(--border-hairline)] mb-4">
                Top Issues by Reader Engagement
              </h2>
              {pubPosts.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No issues written yet.</p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {[...pubPosts]
                    .sort((a, b) => b.likesCount - a.likesCount)
                    .slice(0, 6)
                    .map((p, idx) => (
                      <div
                        key={p.id}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-[var(--text-accent-soft)] tabular-nums w-5">
                            0{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                p.status === 'published'
                                  ? onNavigate({ view: 'post', postId: p.id })
                                  : loadPostIntoEditor(p)
                              }
                              className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-accent)] truncate block text-left cursor-pointer"
                            >
                              {p.title}
                            </button>
                            <p className="text-xs text-[var(--text-muted)] tabular-nums">
                              {p.status} · {p.readTimeMinutes} min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold text-[var(--text-accent)] tabular-nums shrink-0">
                          <span>{p.likesCount} likes</span>
                          <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-normal">
                            <MessageSquare className="w-3 h-3" />
                            <span>{commentCounts.get(p.id) || 0}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5">
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] pb-3 border-b border-[var(--border-hairline)] mb-4">
                Email Dispatch History
              </h2>
              {pubDispatches.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No dispatches compiled yet. Open “Email Preview” from the editor to record your first send.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {pubDispatches.map((dsp) => (
                    <div
                      key={dsp.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {dsp.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                          {dsp.messageId}
                        </p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className="text-xs font-semibold text-[var(--text-accent)]">
                          {dsp.recipientCount}{' '}
                          {dsp.recipientCount === 1 ? 'recipient' : 'recipients'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatEditorialDate(dsp.sentAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 5: Publication & Author Settings */}
      {studioTab === 'settings' && activePub && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-6">
              Publication Settings
            </h2>
            <form onSubmit={handleSavePublication} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Publication Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={pubName}
                  onChange={(e) => setPubName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Tagline
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={pubTagline}
                  onChange={(e) => setPubTagline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                    Category
                  </label>
                  <select
                    value={pubCategory}
                    onChange={(e) => setPubCategory(e.target.value as Category)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2.5 pt-1">
                    {ACCENT_SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => setPubAccent(swatch)}
                        className={`w-8 h-8 rounded-lg border-2 cursor-pointer ${
                          pubAccent === swatch
                            ? 'border-[var(--text-primary)]'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={pubDescription}
                  onChange={(e) => setPubDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Welcome Note for New Subscribers
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={pubWelcomeNote}
                  onChange={(e) => setPubWelcomeNote(e.target.value)}
                  placeholder="Greeting delivered via notification & toast when readers subscribe..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Cover Image URL or Upload
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={pubCover}
                    onChange={(e) => setPubCover(e.target.value)}
                    placeholder="https://... or /uploads/..."
                    className="flex-1 px-3.5 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] rounded-lg text-[var(--text-accent)] hover:border-[var(--accent-border)] cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingPubCover ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadCover(file, 'publication');
                      }}
                    />
                  </label>
                </div>
              </div>

              {recommendablePubs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-body)]">
                      Recommended Publications (Cross-Promotion)
                    </label>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {pubRecommendedIds.length} / 4 selected
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-2.5">
                    Endorse up to 4 peer publications on your public publication page.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    {recommendablePubs.map((candidate) => {
                      const selected = pubRecommendedIds.includes(candidate.id);
                      const atMax = !selected && pubRecommendedIds.length >= 4;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={atMax}
                          onClick={() => {
                            setPubRecommendedIds((prev) =>
                              prev.includes(candidate.id)
                                ? prev.filter((id) => id !== candidate.id)
                                : prev.length < 4
                                ? [...prev, candidate.id]
                                : prev
                            );
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-40 ${
                            selected
                              ? 'border-[var(--accent-border)] bg-[var(--bg-active-soft)]'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {candidate.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">
                              {candidate.category} · {candidate.ownerName}
                            </p>
                          </div>
                          {selected && (
                            <Check className="w-3.5 h-3.5 text-[var(--text-accent)] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingPub}
                  className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                >
                  {savingPub ? 'Saving...' : 'Save Settings'}
                </button>

                {confirmDeletePub ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeletePublication}
                      className="px-3 py-2 text-xs font-medium bg-[#B91C1C] text-white rounded-lg cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePub(false)}
                      className="px-2 py-2 text-xs text-[var(--text-muted)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePub(true)}
                    className="px-3 py-2 text-xs font-medium text-[var(--text-danger)] hover:underline cursor-pointer"
                  >
                    Delete Publication
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6 self-start">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-6">
              Author Profile
            </h2>
            <form onSubmit={handleSaveAuthorProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={authorNameInput}
                  onChange={(e) => setAuthorNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Handle
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={authorHandleInput}
                  onChange={(e) => setAuthorHandleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-body)] mb-1.5">
                  Bio
                </label>
                <textarea
                  rows={3}
                  maxLength={320}
                  value={authorBioInput}
                  onChange={(e) => setAuthorBioInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                {savingProfile ? 'Updating...' : 'Save Author Profile'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Revision History Drawer */}
      {revisionsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Revision History"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end"
        >
          <div className="bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] w-full max-w-md h-full flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Revision History
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Saved checkpoints in Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevisionsOpen(false)}
                aria-label="Close revisions"
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {revisions.length === 0 ? (
                <p className="p-6 text-sm text-[var(--text-muted)] text-center">
                  No revision snapshots yet. Snapshots are created whenever you save, schedule, publish, or click Snapshot.
                </p>
              ) : (
                revisions.map((rev) => (
                  <div key={rev.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-accent)]">
                        {rev.summary || 'Revision'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {rev.createdAt ? rev.createdAt.toLocaleString() : 'Just now'}
                      </span>
                    </div>
                    <p className="font-display text-sm font-semibold text-[var(--text-primary)] truncate">
                      {rev.title}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {rev.contentMarkdown.slice(0, 140)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle(rev.title);
                        setSubtitle(rev.subtitle);
                        setContentMarkdown(rev.contentMarkdown);
                        setRevisionsOpen(false);
                        onNotify('Restored revision into editor.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] rounded-md text-[var(--text-primary)] hover:border-[var(--accent-border)] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore This Version</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Newsletter HTML Preview & Dispatch Modal */}
      {emailModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Newsletter Email Preview"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Newsletter Email Preview & Dispatch
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Compiled server-side into email-safe table HTML
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendDispatch}
                  disabled={dispatchingEmail || !emailHtml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {dispatchingEmail
                      ? 'Compiling...'
                      : `Send Dispatch (${pubSubscribers.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEmailHtml}
                  disabled={!emailHtml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded-lg hover:border-[var(--accent-border)] disabled:opacity-50 cursor-pointer"
                >
                  {copiedEmail ? (
                    <Check className="w-3.5 h-3.5 text-[var(--text-success)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedEmail ? 'Copied HTML' : 'Copy HTML'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  aria-label="Close modal"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {dispatchReceipt && (
              <div className="px-5 py-3 bg-[var(--bg-active-soft)] border-b border-[var(--border-strong)] text-xs text-[var(--text-accent)] flex flex-wrap items-center justify-between gap-2">
                <span>
                  Dispatch compiled (ID <span className="font-mono">{dispatchReceipt.messageId}</span>) for{' '}
                  <strong className="tabular-nums">{dispatchReceipt.recipientCount}</strong>{' '}
                  {dispatchReceipt.recipientCount === 1 ? 'subscriber' : 'subscribers'}.
                </span>
                <span className="text-[var(--text-accent-soft)] tabular-nums">
                  {new Date(dispatchReceipt.sentAt).toLocaleTimeString()}
                </span>
              </div>
            )}

            <div className="flex-1 bg-[var(--bg-canvas)] overflow-hidden">
              {loadingEmail ? (
                <div className="h-96 flex items-center justify-center text-sm text-[var(--text-muted)]">
                  Compiling email digest...
                </div>
              ) : (
                <iframe
                  title="Email Newsletter Preview"
                  srcDoc={emailHtml}
                  sandbox=""
                  className="w-full h-[66vh] border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
