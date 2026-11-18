import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Edit3,
  Headphones,
  Heart,
  Highlighter,
  Lock,
  MessageSquare,
  Quote,
  Rss,
  Share2,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  addComment,
  createNote,
  deleteComment,
  seedStarterCatalog,
  subscribeComments,
  updateComment,
} from '../lib/firestoreService';
import {
  extractMarkdownHeadings,
  formatEditorialDate,
  formatRelativeTime,
  renderMarkdownToSafeHtml,
} from '../lib/markdown';
import type {
  AppRoute,
  Comment,
  Highlight,
  HighlightColor,
  Post,
  Publication,
  ReaderPrefs,
  ReadingProgress,
  UserProfile,
} from '../types/folio';
import { EditorialImage } from './EditorialImage';
import { VoiceReaderBar } from './VoiceReaderBar';

interface PostReaderViewProps {
  post: Post;
  publication?: Publication;
  relatedPosts: Post[];
  user: User | null;
  profile: UserProfile | null;
  isSubscribed: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  savedProgress?: ReadingProgress;
  highlights: Highlight[];
  readerPrefs?: ReaderPrefs;
  onUpdateReaderPrefs?: (prefs: ReaderPrefs) => void;
  onNavigate: (route: AppRoute) => void;
  onToggleSubscribe: (pub: Publication) => void;
  onOpenMembershipCheckout?: (pub: Publication) => void;
  onToggleLike: (post: Post) => void;
  onToggleBookmark: (post: Post) => void;
  onSaveProgress: (postId: string, percent: number, scrollY: number) => void;
  onCreateHighlight: (input: {
    post: Post;
    quote: string;
    note: string;
    color: HighlightColor;
  }) => Promise<void>;
  onDeleteHighlight: (highlightId: string) => void;
  onSignIn: () => void;
  onNotify: (msg: string) => void;
}

const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 17,
  fontFamily: 'sans',
  width: 'standard',
};

const FONT_SIZE_CLASSES: Record<number, string> = {
  15: '!text-[15px]',
  17: '!text-[17px]',
  19: '!text-[19px]',
  21: '!text-[21px]',
};

const WIDTH_CLASSES: Record<ReaderPrefs['width'], string> = {
  narrow: 'max-w-[60ch]',
  standard: 'max-w-[68ch]',
  wide: 'max-w-[76ch]',
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlBasic(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyHighlightsToHtml(html: string, postHighlights: Highlight[]): string {
  if (postHighlights.length === 0) return html;
  let result = html;
  for (const hl of postHighlights) {
    const rawQuote = hl.quote.trim();
    if (rawQuote.length < 3) continue;
    const htmlQuote = escapeHtmlBasic(rawQuote);
    const regex = new RegExp(`(${escapeRegExp(htmlQuote)})`, 'i');
    const parts = result.split(/(<[^>]+>)/g);
    let insideMark = false;
    let replaced = false;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      if (!segment) continue;
      if (segment.startsWith('<')) {
        if (/^<mark\b/i.test(segment)) insideMark = true;
        else if (/^<\/mark>/i.test(segment)) insideMark = false;
        continue;
      }
      if (!insideMark && !replaced && regex.test(segment)) {
        parts[i] = segment.replace(
          regex,
          `<mark class="folio-highlight-mark" data-color="${hl.color}">$1</mark>`
        );
        replaced = true;
      }
    }
    result = parts.join('');
  }
  return result;
}

function annotateVoiceSegments(
  html: string,
  postTitle: string
): { annotatedHtml: string; segments: string[] } {
  const segments: string[] = [postTitle.trim() || 'Untitled Essay'];
  if (typeof DOMParser === 'undefined') {
    return { annotatedHtml: html, segments };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const voiceBlockTags = new Set(['P', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL']);
  let idx = 1;
  Array.from(doc.body.children).forEach((el) => {
    if (!voiceBlockTags.has(el.tagName)) return;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    el.setAttribute('data-voice-idx', String(idx));
    segments.push(text);
    idx += 1;
  });
  return {
    annotatedHtml: doc.body.innerHTML,
    segments,
  };
}

export function PostReaderView({
  post,
  publication,
  relatedPosts,
  user,
  profile,
  isSubscribed,
  isLiked,
  isBookmarked,
  savedProgress,
  highlights,
  readerPrefs: externalReaderPrefs,
  onUpdateReaderPrefs,
  onNavigate,
  onToggleSubscribe,
  onOpenMembershipCheckout,
  onToggleLike,
  onToggleBookmark,
  onSaveProgress,
  onCreateHighlight,
  onDeleteHighlight,
  onSignIn,
  onNotify,
}: PostReaderViewProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Resume reading prompt
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const lastSavedProgressRef = useRef<{ postId: string; percent: number }>({
    postId: post.id,
    percent: 0,
  });
  const saveTimerRef = useRef<number | null>(null);

  // Typography preferences
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [localReaderPrefs, setLocalReaderPrefs] = useState<ReaderPrefs>(() => {
    try {
      const raw = localStorage.getItem('folio-reader-prefs');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
        return {
          fontSize:
            parsed.fontSize && [15, 17, 19, 21].includes(parsed.fontSize)
              ? parsed.fontSize
              : 17,
          fontFamily: parsed.fontFamily === 'serif' ? 'serif' : 'sans',
          width:
            parsed.width === 'narrow' || parsed.width === 'wide'
              ? parsed.width
              : 'standard',
        };
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_READER_PREFS;
  });

  const readerPrefs = externalReaderPrefs ?? localReaderPrefs;
  const setReaderPrefs = (updater: (prev: ReaderPrefs) => ReaderPrefs) => {
    const next = updater(readerPrefs);
    if (onUpdateReaderPrefs) {
      onUpdateReaderPrefs(next);
    } else {
      setLocalReaderPrefs(next);
    }
  };

  // Voice reading state
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [activeVoiceIdx, setActiveVoiceIdx] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceJumpRequest, setVoiceJumpRequest] = useState<{
    idx: number;
    seq: number;
  } | null>(null);

  // Text selection & Highlight toolbar
  const articleRef = useRef<HTMLElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const typographyRef = useRef<HTMLDivElement>(null);
  const [selectionState, setSelectionState] = useState<{
    quote: string;
    top: number;
    left: number;
    noteMode: boolean;
    color: HighlightColor;
    noteText: string;
  } | null>(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(true);

  // Quote-in-Salon modal state
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [postingQuote, setPostingQuote] = useState(false);

  const postHighlights = useMemo(
    () => highlights.filter((h) => h.postId === post.id),
    [highlights, post.id]
  );

  // Persist reader prefs
  useEffect(() => {
    try {
      localStorage.setItem('folio-reader-prefs', JSON.stringify(readerPrefs));
    } catch {
      // Ignore storage error
    }
  }, [readerPrefs]);

  // Close typography popover on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (typographyRef.current && !typographyRef.current.contains(e.target as Node)) {
        setTypographyOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Reset per-post UI state on post switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setResumeDismissed(false);
    setSelectionState(null);
    setVoiceOpen(false);
    setActiveVoiceIdx(0);
    setVoiceJumpRequest(null);
    lastSavedProgressRef.current = { postId: post.id, percent: 0 };
  }, [post.id]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Scroll tracking & throttled progress save
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        docHeight <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));
      setScrollProgress(pct);

      if (pct >= 3 && Math.abs(pct - lastSavedProgressRef.current.percent) >= 3) {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
          lastSavedProgressRef.current = { postId: post.id, percent: pct };
          onSaveProgress(post.id, pct, scrollTop);
        }, 1200);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [post.id, onSaveProgress]);

  useEffect(() => {
    if (post.isShowcase) {
      setComments([]);
      return;
    }
    const unsub = subscribeComments(post.id, setComments);
    return () => unsub();
  }, [post.id, post.isShowcase]);

  const isAuthor = Boolean(user && user.uid === post.authorId);
  const isPaywalled =
    post.accessTier === 'subscribers' && !isSubscribed && !isAuthor;

  const displayedMarkdown = useMemo(() => {
    if (!isPaywalled) return post.contentMarkdown;
    const paragraphs = post.contentMarkdown.split(/\n\n+/);
    const previewCount = Math.max(2, Math.ceil(paragraphs.length * 0.45));
    return paragraphs.slice(0, previewCount).join('\n\n');
  }, [post.contentMarkdown, isPaywalled]);

  const headings = useMemo(
    () => extractMarkdownHeadings(displayedMarkdown),
    [displayedMarkdown]
  );

  const { safeHtml, voiceSegments } = useMemo(() => {
    const base = renderMarkdownToSafeHtml(displayedMarkdown);
    const highlighted = applyHighlightsToHtml(base, postHighlights);
    const { annotatedHtml, segments } = annotateVoiceSegments(highlighted, post.title);
    return { safeHtml: annotatedHtml, voiceSegments: segments };
  }, [displayedMarkdown, postHighlights, post.title]);

  const remainingMinutes = Math.max(
    1,
    Math.ceil(post.readTimeMinutes * (1 - scrollProgress / 100))
  );

  const scrollToVoiceIndex = useCallback((idx: number) => {
    const container = articleRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-voice-idx="${idx}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    container.querySelectorAll('.folio-voice-active').forEach((el) => {
      el.classList.remove('folio-voice-active');
    });
    if (!voiceOpen) return;
    const target = container.querySelector(`[data-voice-idx="${activeVoiceIdx}"]`);
    if (target instanceof HTMLElement) {
      target.classList.add('folio-voice-active');
      if (autoFollow && activeVoiceIdx > 0) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [voiceOpen, activeVoiceIdx, autoFollow, safeHtml]);

  const handleToggleVoiceReading = () => {
    if (voiceOpen) {
      setVoiceOpen(false);
      setActiveVoiceIdx(0);
    } else {
      setVoiceOpen(true);
      setVoiceJumpRequest({ idx: activeVoiceIdx, seq: Date.now() });
    }
  };

  const handleProseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!voiceOpen) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }
    const target = e.target as HTMLElement | null;
    if (!target || target.closest('a, button')) return;
    const block = target.closest('[data-voice-idx]');
    if (!block) return;
    const idxAttr = block.getAttribute('data-voice-idx');
    const idx = idxAttr ? Number(idxAttr) : NaN;
    if (!Number.isNaN(idx) && idx >= 0 && idx < voiceSegments.length) {
      setVoiceJumpRequest({ idx, seq: Date.now() });
    }
  };

  const handleProseSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }
    const text = sel.toString().trim().replace(/\s+/g, ' ');
    if (text.length < 3 || text.length > 600) {
      return;
    }
    const range = sel.getRangeAt(0);
    if (!proseRef.current || !proseRef.current.contains(range.commonAncestorContainer)) {
      return;
    }
    const rect = range.getBoundingClientRect();
    const centerLeft = Math.min(
      Math.max(rect.left + rect.width / 2, 160),
      window.innerWidth - 160
    );
    const topPos = Math.max(rect.top - 52, 74);
    setSelectionState({
      quote: text,
      top: topPos,
      left: centerLeft,
      noteMode: false,
      color: 'purple',
      noteText: '',
    });
  };

  const handleSaveHighlight = async (color: HighlightColor, noteText = '') => {
    if (!selectionState) return;
    setSavingHighlight(true);
    try {
      await onCreateHighlight({
        post,
        quote: selectionState.quote,
        note: noteText.trim(),
        color,
      });
      setSelectionState(null);
      window.getSelection()?.removeAllRanges();
      setHighlightsPanelOpen(true);
    } finally {
      setSavingHighlight(false);
    }
  };

  const commentIds = useMemo(() => new Set(comments.map((c) => c.id)), [comments]);

  const topLevelComments = useMemo(() => {
    const base = comments.filter(
      (c) => !c.parentCommentId || !commentIds.has(c.parentCommentId)
    );
    if (commentSort === 'newest') {
      return [...base].reverse();
    }
    return base;
  }, [comments, commentIds, commentSort]);

  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    comments.forEach((c) => {
      if (c.parentCommentId && commentIds.has(c.parentCommentId)) {
        const list = map.get(c.parentCommentId) || [];
        list.push(c);
        map.set(c.parentCommentId, list);
      }
    });
    return map;
  }, [comments, commentIds]);

  const copyPostUrlToClipboard = async (url: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {
      // Fall through to execCommand fallback
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: post.title,
          text: post.subtitle || post.excerpt || `${post.title} — ${post.publicationName}`,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    const ok = await copyPostUrlToClipboard(url);
    if (ok) {
      setCopied(true);
      onNotify('Post link copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } else {
      onNotify('Unable to copy link in this browser.');
    }
  };

  const handleOpenQuoteSalon = (prefilledQuote?: string) => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    const selection = prefilledQuote || window.getSelection()?.toString().trim() || '';
    setQuoteText(
      selection
        ? `"${selection.slice(0, 320)}" — reading ${post.title}`
        : `Reading "${post.title}" by ${post.authorName} — `
    );
    setSelectionState(null);
    setQuoteModalOpen(true);
  };

  const handlePublishQuoteNote = async () => {
    if (!user || !profile || !quoteText.trim()) return;
    setPostingQuote(true);
    try {
      await createNote({
        user,
        profile,
        publication,
        body: quoteText,
        quotedPost: post.isShowcase ? undefined : post,
      });
      setQuoteModalOpen(false);
      setQuoteText('');
      onNotify('Shared note to Salon.');
    } finally {
      setPostingQuote(false);
    }
  };

  const handlePostComment = async (
    parentId: string | null = null,
    parentAuthorId: string | null = null
  ) => {
    if (!user || !profile) {
      onSignIn();
      return;
    }
    if (post.isShowcase) {
      await seedStarterCatalog(user, profile);
      onNotify('Live catalog synced — you can post your comment now.');
      return;
    }
    if (post.status !== 'published') {
      onNotify('Publish this issue before posting comments.');
      return;
    }
    const text = (parentId ? replyBody : commentBody).trim();
    if (!text) return;
    setSubmittingComment(true);
    try {
      await addComment({
        postId: post.id,
        postTitle: post.title,
        postAuthorId: post.authorId,
        user,
        profile,
        body: text,
        parentCommentId: parentId,
        parentCommentAuthorId: parentAuthorId,
      });
      if (parentId) {
        setReplyBody('');
        setReplyToId(null);
        onNotify('Reply posted.');
      } else {
        setCommentBody('');
        onNotify('Comment posted.');
      }
    } catch {
      onNotify('Could not post comment. Please verify your sign-in status.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!user || post.isShowcase || !editingCommentBody.trim()) return;
    setSavingCommentEdit(true);
    try {
      await updateComment(post.id, commentId, editingCommentBody);
      setEditingCommentId(null);
      setEditingCommentBody('');
      onNotify('Comment updated.');
    } catch {
      onNotify('Could not update comment.');
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || post.isShowcase) return;
    setDeletingCommentId(commentId);
    try {
      await deleteComment(post.id, commentId);
      if (replyToId === commentId) {
        setReplyToId(null);
        setReplyBody('');
      }
      onNotify('Comment deleted.');
    } catch {
      onNotify('Could not delete comment.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const showResumeBanner =
    !resumeDismissed &&
    savedProgress &&
    savedProgress.percent >= 5 &&
    savedProgress.percent < 95 &&
    scrollProgress < 5;

  const handleResumeReading = () => {
    if (!savedProgress) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targetY =
      savedProgress.scrollY > 40
        ? savedProgress.scrollY
        : Math.round((docHeight * savedProgress.percent) / 100);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
    setResumeDismissed(true);
  };

  const proseSizeClass = FONT_SIZE_CLASSES[readerPrefs.fontSize] || '!text-[17px]';
  const proseWidthClass = WIDTH_CLASSES[readerPrefs.width];
  const proseFamilyClass = readerPrefs.fontFamily === 'serif' ? 'folio-prose-serif' : '';

  return (
    <div className="bg-[var(--bg-canvas)] min-h-screen">
      {/* Reading progress bar */}
      <div
        className="fixed top-16 left-0 right-0 h-[2px] bg-[var(--bg-surface-alt)] z-30 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="h-full bg-[var(--accent-border)] transition-[width] duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Publication Masthead Sub-bar */}
      <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface-alt)]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate({ view: 'explore' })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dispatches</span>
            </button>
            <span className="text-[var(--border-strong)]" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              onClick={() =>
                onNavigate({ view: 'publication', slug: post.publicationSlug })
              }
              className="font-display text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] truncate cursor-pointer"
            >
              {post.publicationName}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-xs text-[var(--text-muted)] tabular-nums mr-1">
              {scrollProgress > 5
                ? `${remainingMinutes} min left`
                : `${post.readTimeMinutes} min read`}
            </span>

            {/* Voice Reading Toggle */}
            <button
              type="button"
              onClick={handleToggleVoiceReading}
              aria-pressed={voiceOpen}
              title="Listen with Voice Reading"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                voiceOpen
                  ? 'border-[var(--accent-border)] bg-[var(--accent-solid)]/15 text-[var(--text-accent)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)]'
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
              <span className="hidden sm:inline">{voiceOpen ? 'Reading' : 'Voice Read'}</span>
            </button>

            {/* Typography Controls Popover */}
            <div className="relative" ref={typographyRef}>
              <button
                type="button"
                onClick={() => setTypographyOpen((prev) => !prev)}
                aria-expanded={typographyOpen}
                aria-label="Reader typography settings"
                title="Adjust font size, typeface & width"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface)] hover:border-[var(--accent-border)] cursor-pointer"
              >
                <Type className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                <span>Aa</span>
              </button>

              {typographyOpen && (
                <div
                  role="dialog"
                  aria-label="Reader Typography"
                  className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl shadow-2xl p-4 z-50 space-y-4"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      Font Size
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 17, 19, 21].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            setReaderPrefs((prev) => ({ ...prev, fontSize: sz }))
                          }
                          className={`py-1.5 text-xs font-medium rounded-md border cursor-pointer tabular-nums ${
                            readerPrefs.fontSize === sz
                              ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                              : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          {sz}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      Typeface
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['sans', 'serif'] as const).map((fam) => (
                        <button
                          key={fam}
                          type="button"
                          onClick={() =>
                            setReaderPrefs((prev) => ({ ...prev, fontFamily: fam }))
                          }
                          className={`py-1.5 text-xs font-medium rounded-md border capitalize cursor-pointer ${
                            readerPrefs.fontFamily === fam
                              ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                              : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          {fam === 'sans' ? 'Modern Sans' : 'Editorial Serif'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      Column Measure
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['narrow', 'standard', 'wide'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() =>
                            setReaderPrefs((prev) => ({ ...prev, width: w }))
                          }
                          className={`py-1.5 text-xs font-medium rounded-md border capitalize cursor-pointer ${
                            readerPrefs.width === w
                              ? 'bg-[var(--accent-solid)] text-white border-[var(--accent-border)]'
                              : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--accent-border)]'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <a
              href={`/api/publications/${encodeURIComponent(post.publicationSlug)}/rss.xml`}
              target="_blank"
              rel="noreferrer"
              title="Open RSS Feed"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface)]"
            >
              <Rss className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
              <span className="hidden sm:inline">RSS</span>
            </a>

            {publication && (
              <button
                type="button"
                onClick={() => onToggleSubscribe(publication)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isSubscribed
                    ? 'bg-[var(--bg-active-soft)] text-[var(--text-body)] border border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    : 'bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Reader Grid with Optional Desktop Section Outline */}
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {headings.length > 0 && (
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <p className="text-xs font-semibold text-[var(--text-accent-soft)] mb-3">
                In This Essay
              </p>
              <nav aria-label="Essay outline" className="space-y-2">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={`block text-xs leading-snug text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${
                      h.level === 3 ? 'pl-3 text-[var(--text-muted)]' : 'font-medium'
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        <article
          ref={articleRef}
          className={
            headings.length > 0
              ? 'lg:col-span-9 max-w-[780px]'
              : 'lg:col-span-12 max-w-[780px] mx-auto w-full'
          }
        >
          {/* Resume Reading Banner */}
          {showResumeBanner && savedProgress && (
            <div className="mb-6 p-3.5 rounded-xl border border-[var(--accent-border)]/50 bg-[var(--bg-active-soft)] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-primary)] tabular-nums">
                You previously read <strong>{savedProgress.percent}%</strong> of this essay.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeReading}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] cursor-pointer"
                >
                  Resume from {savedProgress.percent}%
                </button>
                <button
                  type="button"
                  onClick={() => setResumeDismissed(true)}
                  aria-label="Dismiss resume banner"
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <VoiceReaderBar
            open={voiceOpen}
            postId={post.id}
            postTitle={post.title}
            segments={voiceSegments}
            activeIdx={activeVoiceIdx}
            autoFollow={autoFollow}
            jumpRequest={voiceJumpRequest}
            onActiveIdxChange={setActiveVoiceIdx}
            onToggleAutoFollow={() => setAutoFollow((prev) => !prev)}
            onScrollToActive={() => scrollToVoiceIndex(activeVoiceIdx)}
            onClose={() => {
              setVoiceOpen(false);
              setActiveVoiceIdx(0);
            }}
            onNotify={onNotify}
          />

          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
              <span className="text-[var(--text-accent)] font-medium">{post.category}</span>
              <span aria-hidden="true">·</span>
              <span>{formatEditorialDate(post.publishedAt || post.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{post.readTimeMinutes} min read</span>
              {post.accessTier === 'subscribers' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-[var(--text-accent)] font-medium">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Subscribers Only
                  </span>
                </>
              )}
            </div>

            <h1
              data-voice-idx="0"
              className="font-display text-3xl sm:text-5xl font-semibold leading-[1.12] tracking-tight text-[var(--text-heading)] headline-balance mb-4"
            >
              {post.title}
            </h1>

            {post.subtitle && (
              <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed mb-4">
                {post.subtitle}
              </p>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {post.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onNavigate({ view: 'topic', tag })}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-accent)] transition-colors cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-[var(--border-hairline)]">
              <div className="flex items-center gap-3">
                {post.authorAvatar ? (
                  <img
                    src={post.authorAvatar}
                    alt={post.authorName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-[var(--border-hairline)]"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-[var(--accent-solid)] text-white text-xs font-medium flex items-center justify-center">
                    {post.authorName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'author', authorId: post.authorId })
                    }
                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer block text-left"
                  >
                    {post.authorName}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ view: 'publication', slug: post.publicationSlug })
                    }
                    className="text-xs text-[var(--text-accent-soft)] hover:underline cursor-pointer"
                  >
                    {post.publicationName}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(post)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer tabular-nums ${
                    isLiked
                      ? 'border-[var(--accent-border)] text-[var(--text-accent)] bg-[var(--accent-solid)]/15 dark:bg-[var(--accent-solid)]/25'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{post.likesCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleBookmark(post)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isBookmarked
                      ? 'border-[var(--accent-border)] text-[var(--text-accent)] bg-[var(--accent-solid)]/15 dark:bg-[var(--accent-solid)]/25'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`}
                  />
                  <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenQuoteSalon()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] transition-colors cursor-pointer"
                >
                  <Quote className="w-3.5 h-3.5" />
                  <span>Quote in Salon</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoiceReading}
                  aria-pressed={voiceOpen}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    voiceOpen
                      ? 'border-[var(--accent-border)] text-[var(--text-accent)] bg-[var(--accent-solid)]/15 dark:bg-[var(--accent-solid)]/25'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" />
                  <span>{voiceOpen ? 'Voice Active' : 'Voice Read'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share this post"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--text-success)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </header>

          {post.coverImageUrl && (
            <figure className="mb-10">
              <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] aspect-[16/10]">
                <EditorialImage
                  src={post.coverImageUrl}
                  alt={post.title}
                  fallbackTitle={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="text-xs text-[var(--text-muted)] italic mt-2.5">
                Fig. 1 — {post.publicationName},{' '}
                {formatEditorialDate(post.publishedAt || post.createdAt)}
              </figcaption>
            </figure>
          )}

          {/* Long-form Markdown Prose with Highlighting & Voice Reading Sync */}
          <div
            ref={proseRef}
            onClick={handleProseClick}
            onMouseUp={handleProseSelection}
            onTouchEnd={handleProseSelection}
            className={`folio-prose ${proseSizeClass} ${proseWidthClass} ${proseFamilyClass} ${
              voiceOpen ? 'folio-voice-clickable' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {/* Subscriber-Only Paywall Gate */}
          {isPaywalled && publication && (
            <div className="mt-10 border border-[var(--border-strong)] rounded-xl bg-[var(--bg-surface)] p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-active-soft)] border border-[var(--border-strong)] flex items-center justify-center mx-auto mb-4">
                <Lock className="w-4 h-4 text-[var(--text-accent)]" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)] mb-2">
                This dispatch is for {publication.name} subscribers
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
                Subscribe to {publication.name} to unlock the full monograph and gather upcoming issues in your Library.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleSubscribe(publication)}
                  className="px-5 py-2.5 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Subscribe Free to Read
                </button>
                {onOpenMembershipCheckout && (
                  <button
                    type="button"
                    onClick={() => onOpenMembershipCheckout(publication)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border border-[var(--accent-border)] bg-[var(--bg-canvas)] text-[var(--text-accent)] rounded-lg hover:bg-[var(--bg-active-soft)] transition-colors cursor-pointer"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Become a Supporting Member ($7/mo)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reader Highlights & Margin Notes Panel */}
          {postHighlights.length > 0 && (
            <section className="mt-12 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setHighlightsPanelOpen((prev) => !prev)}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Highlighter className="w-4 h-4 text-[var(--text-accent-soft)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                    Your Highlights & Margin Notes ({postHighlights.length})
                  </span>
                </div>
                {highlightsPanelOpen ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              {highlightsPanelOpen && (
                <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                  {postHighlights.map((hl) => (
                    <div key={hl.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm italic text-[var(--text-body)]">
                          “{hl.quote}”
                        </p>
                        {hl.note && (
                          <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5">
                            Margin note: {hl.note}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteHighlight(hl.id)}
                        aria-label="Delete highlight"
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-danger)] shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* End-of-Essay Action Footer */}
          <div className="mt-12 pt-6 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleLike(post)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer tabular-nums ${
                  isLiked
                    ? 'border-[var(--accent-border)] text-[var(--text-accent)] bg-[var(--accent-solid)]/15 dark:bg-[var(--accent-solid)]/25'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-border)]'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>
                  {isLiked ? 'Liked' : 'Like'} · {post.likesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onToggleBookmark(post)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'border-[var(--accent-border)] text-[var(--text-accent)] bg-[var(--accent-solid)]/15 dark:bg-[var(--accent-solid)]/25'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-border)]'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`}
                />
                <span>{isBookmarked ? 'Saved to Library' : 'Save for Later'}</span>
              </button>

              <a
                href="#discussion"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors tabular-nums"
              >
                <MessageSquare className="w-4 h-4 text-[var(--text-accent-soft)]" />
                <span>
                  {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                </span>
              </a>

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share this post"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--text-success)]" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-[var(--text-accent-soft)]" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>

            {publication && (
              <button
                type="button"
                onClick={() =>
                  onNavigate({ view: 'publication', slug: publication.slug })
                }
                className="text-sm font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
              >
                More from {publication.name}
              </button>
            )}
          </div>

          {/* Related Issues from Publication */}
          {relatedPosts.length > 0 && (
            <section className="mt-12 pt-8 border-t border-[var(--border-hairline)]">
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-5">
                Further Reading from {post.publicationName}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPosts.slice(0, 2).map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onNavigate({ view: 'post', postId: rel.id })}
                    className="text-left p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--accent-border)] transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-[var(--text-muted)] mb-1">
                      {formatEditorialDate(rel.publishedAt || rel.createdAt)} ·{' '}
                      {rel.readTimeMinutes} min
                    </p>
                    <p className="font-display text-lg font-semibold text-[var(--text-primary)] line-clamp-2">
                      {rel.title}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Threaded Reader Discussion */}
          <section id="discussion" className="mt-14 pt-10 border-t border-[var(--border-hairline)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                  Reader Salon
                </h2>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  {comments.length} {comments.length === 1 ? 'response' : 'responses'}
                </span>
              </div>

              {comments.length > 1 && (
                <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg">
                  {(['oldest', 'newest'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCommentSort(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                        commentSort === mode
                          ? 'bg-[var(--accent-solid)] text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {post.status !== 'published' ? (
              <div className="border border-[var(--border-hairline)] rounded-xl p-6 bg-[var(--bg-surface)] text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  Reader comments open once this draft is published.
                </p>
              </div>
            ) : !user ? (
              <div className="mb-8 border border-[var(--border-hairline)] rounded-xl p-5 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  Sign in with Google to post comments and join the reader discussion.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sign In to Comment
                </button>
              </div>
            ) : post.isShowcase ? (
              <div className="mb-8 border border-[var(--border-hairline)] rounded-xl p-5 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  Sync the starter catalog into Firestore to post live comments on this issue.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (profile) void seedStarterCatalog(user, profile);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Enable Live Comments
                </button>
              </div>
            ) : (
              <div className="mb-8">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Write a comment..."
                  className="w-full p-4 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)] transition-colors"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    {commentBody.length} / 2000
                  </span>
                  <button
                    type="button"
                    disabled={submittingComment || !commentBody.trim()}
                    onClick={() => handlePostComment(null, null)}
                    className="px-4 py-2 text-sm font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            )}

            {topLevelComments.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">
                No comments yet. Open the discussion above.
              </p>
            ) : (
              <div className="space-y-6 divide-y divide-[var(--border-hairline)]">
                {topLevelComments.map((comment) => {
                  const replies = repliesByParent.get(comment.id) || [];
                  const isCommentOwner = Boolean(user && user.uid === comment.authorId);
                  const canDelete = Boolean(
                    user && (isCommentOwner || user.uid === post.authorId)
                  );
                  return (
                    <div key={comment.id} className="pt-6 first:pt-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {comment.authorAvatar ? (
                            <img
                              src={comment.authorAvatar}
                              alt={comment.authorName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover border border-[var(--border-hairline)]"
                            />
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-[var(--accent-solid)] text-white text-xs flex items-center justify-center">
                              {comment.authorName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({ view: 'author', authorId: comment.authorId })
                            }
                            className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                          >
                            {comment.authorName}
                          </button>
                          {isCommentOwner && (
                            <span className="text-xs text-[var(--text-accent-soft)]">(You)</span>
                          )}
                          <span className="text-xs text-[var(--text-muted)]">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                          {comment.editedAt && (
                            <span className="text-[11px] text-[var(--text-muted)] italic">
                              (edited)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isCommentOwner && !post.isShowcase && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentBody(comment.body);
                              }}
                              aria-label="Edit comment"
                              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-accent)] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingCommentId === comment.id}
                              onClick={() => handleDeleteComment(comment.id)}
                              aria-label="Delete comment"
                              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-danger)] disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="pl-9 mt-2">
                          <textarea
                            rows={2}
                            maxLength={2000}
                            value={editingCommentBody}
                            onChange={(e) => setEditingCommentBody(e.target.value)}
                            className="w-full p-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                          />
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setEditingCommentId(null)}
                              className="px-3 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingCommentEdit || !editingCommentBody.trim()}
                              onClick={() => handleSaveCommentEdit(comment.id)}
                              className="px-3 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                            >
                              {savingCommentEdit ? 'Saving...' : 'Save Edit'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap pl-9">
                          {comment.body}
                        </p>
                      )}

                      {user && post.status === 'published' && !post.isShowcase && (
                        <div className="pl-9 mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setReplyToId((prev) => (prev === comment.id ? null : comment.id))
                            }
                            className="text-xs font-medium text-[var(--text-accent-soft)] hover:underline cursor-pointer"
                          >
                            {replyToId === comment.id ? 'Cancel' : 'Reply'}
                          </button>
                        </div>
                      )}

                      {replyToId === comment.id && (
                        <div className="pl-9 mt-3">
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={2}
                            maxLength={2000}
                            placeholder={`Reply to ${comment.authorName}...`}
                            className="w-full p-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-border)]"
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              type="button"
                              disabled={submittingComment || !replyBody.trim()}
                              onClick={() => handlePostComment(comment.id, comment.authorId)}
                              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                            >
                              {submittingComment ? 'Posting...' : 'Post Reply'}
                            </button>
                          </div>
                        </div>
                      )}

                      {replies.length > 0 && (
                        <div className="pl-9 mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                          {replies.map((reply) => {
                            const isReplyOwner = Boolean(user && user.uid === reply.authorId);
                            const canDeleteReply = Boolean(
                              user && (isReplyOwner || user.uid === post.authorId)
                            );
                            return (
                              <div key={reply.id}>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onNavigate({ view: 'author', authorId: reply.authorId })
                                      }
                                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer"
                                    >
                                      {reply.authorName}
                                    </button>
                                    {isReplyOwner && (
                                      <span className="text-[var(--text-accent-soft)]">(You)</span>
                                    )}
                                    <span className="text-[var(--text-muted)]">
                                      {formatRelativeTime(reply.createdAt)}
                                    </span>
                                    {reply.editedAt && (
                                      <span className="text-[11px] text-[var(--text-muted)] italic">
                                        (edited)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isReplyOwner && !post.isShowcase && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(reply.id);
                                          setEditingCommentBody(reply.body);
                                        }}
                                        aria-label="Edit reply"
                                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-accent)] cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        disabled={deletingCommentId === reply.id}
                                        onClick={() => handleDeleteComment(reply.id)}
                                        aria-label="Delete reply"
                                        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-danger)] disabled:opacity-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {editingCommentId === reply.id ? (
                                  <div className="mt-1">
                                    <textarea
                                      rows={2}
                                      maxLength={2000}
                                      value={editingCommentBody}
                                      onChange={(e) => setEditingCommentBody(e.target.value)}
                                      className="w-full p-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
                                    />
                                    <div className="flex justify-end gap-2 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCommentId(null)}
                                        className="px-2.5 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingCommentEdit || !editingCommentBody.trim()}
                                        onClick={() => handleSaveCommentEdit(reply.id)}
                                        className="px-2.5 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">
                                    {reply.body}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </article>
      </div>

      {/* Floating Text Selection Toolbar for Highlighting & Margin Notes */}
      {selectionState && (
        <div
          role="toolbar"
          aria-label="Passage Highlight Actions"
          className="fixed z-50 -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl shadow-2xl p-2"
          style={{ top: `${selectionState.top}px`, left: `${selectionState.left}px` }}
        >
          {!selectionState.noteMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingHighlight}
                onClick={() => handleSaveHighlight('purple')}
                title="Highlight in Purple"
                className="w-6 h-6 rounded-md bg-[#8B5CF6] border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                aria-label="Highlight in purple"
              />
              <button
                type="button"
                disabled={savingHighlight}
                onClick={() => handleSaveHighlight('amber')}
                title="Highlight in Amber"
                className="w-6 h-6 rounded-md bg-amber-500 border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                aria-label="Highlight in amber"
              />
              <button
                type="button"
                disabled={savingHighlight}
                onClick={() => handleSaveHighlight('emerald')}
                title="Highlight in Emerald"
                className="w-6 h-6 rounded-md bg-emerald-500 border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                aria-label="Highlight in emerald"
              />
              <span className="w-px h-4 bg-[var(--border-hairline)] mx-0.5" />
              <button
                type="button"
                onClick={() =>
                  setSelectionState((prev) =>
                    prev ? { ...prev, noteMode: true } : null
                  )
                }
                className="px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:text-[var(--text-accent)] cursor-pointer whitespace-nowrap"
              >
                Margin Note
              </button>
              <button
                type="button"
                onClick={() => handleOpenQuoteSalon(selectionState.quote)}
                className="px-2 py-1 text-xs font-medium text-[var(--text-accent)] hover:underline cursor-pointer whitespace-nowrap"
              >
                Quote
              </button>
              <button
                type="button"
                onClick={() => setSelectionState(null)}
                aria-label="Dismiss toolbar"
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-72 p-1.5 space-y-2">
              <p className="text-[11px] italic text-[var(--text-muted)] line-clamp-2">
                “{selectionState.quote}”
              </p>
              <textarea
                rows={2}
                maxLength={500}
                value={selectionState.noteText}
                onChange={(e) =>
                  setSelectionState((prev) =>
                    prev ? { ...prev, noteText: e.target.value } : null
                  )
                }
                placeholder="Write a margin note..."
                className="w-full p-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(['purple', 'amber', 'emerald'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setSelectionState((prev) =>
                          prev ? { ...prev, color: c } : null
                        )
                      }
                      aria-label={`Select ${c} highlight`}
                      className={`w-4 h-4 rounded-sm cursor-pointer ${
                        c === 'purple'
                          ? 'bg-[#8B5CF6]'
                          : c === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      } ${selectionState.color === c ? 'ring-2 ring-[var(--text-primary)]' : ''}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectionState(null)}
                    className="px-2 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingHighlight}
                    onClick={() =>
                      handleSaveHighlight(selectionState.color, selectionState.noteText)
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
                  >
                    {savingHighlight ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote in Salon Modal */}
      {quoteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quote in Salon"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                Quote in Salon
              </h3>
              <button
                type="button"
                onClick={() => setQuoteModalOpen(false)}
                aria-label="Close modal"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-accent-soft)] mb-3">
              Referencing: {post.title}
            </p>
            <textarea
              rows={4}
              maxLength={600}
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              className="w-full p-3.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {quoteText.length} / 600
              </span>
              <button
                type="button"
                disabled={postingQuote || !quoteText.trim()}
                onClick={handlePublishQuoteNote}
                className="px-4 py-2 text-xs font-medium bg-[var(--accent-solid)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                {postingQuote ? 'Sharing...' : 'Post to Salon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
