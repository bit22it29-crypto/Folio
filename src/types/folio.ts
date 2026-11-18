export type Category =
  | 'Technology'
  | 'Culture'
  | 'Economics'
  | 'Design'
  | 'Science'
  | 'Essays';

export const CATEGORIES: Category[] = [
  'Technology',
  'Culture',
  'Economics',
  'Design',
  'Science',
  'Essays',
];

export type AccessTier = 'free' | 'subscribers';
export type PostStatus = 'draft' | 'scheduled' | 'published';
export type SubscriptionTier = 'free' | 'supporting';
export type DigestFrequency = 'immediate' | 'daily' | 'weekly';
export type HighlightColor = 'purple' | 'amber' | 'emerald';
export type NotificationType =
  | 'comment_reply'
  | 'post_comment'
  | 'note_like'
  | 'new_subscriber'
  | 'welcome';

export interface UserProfile {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  digestFrequency: DigestFrequency;
  updatedAt: Date | null;
}

export interface Publication {
  id: string;
  ownerId: string;
  ownerName: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  accentColor: string;
  coverImageUrl: string;
  pinnedPostId?: string | null;
  welcomeNote?: string;
  subscriberCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  isShowcase?: boolean;
}

export interface Post {
  id: string;
  publicationId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  publicationName: string;
  publicationSlug: string;
  title: string;
  subtitle: string;
  slug: string;
  category: Category;
  tags?: string[];
  coverImageUrl: string;
  contentMarkdown: string;
  excerpt: string;
  readTimeMinutes: number;
  accessTier: AccessTier;
  status: PostStatus;
  scheduledFor?: Date | null;
  likesCount: number;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  isShowcase?: boolean;
}

export interface PostRevision {
  id: string;
  postId: string;
  authorId: string;
  title: string;
  subtitle: string;
  contentMarkdown: string;
  summary: string;
  createdAt: Date | null;
}

export interface Comment {
  id: string;
  postId: string;
  postStatus: 'published';
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  parentCommentId?: string | null;
  editedAt?: Date | null;
  createdAt: Date | null;
}

export interface Subscription {
  id: string;
  publicationId: string;
  publicationOwnerId: string;
  publicationName: string;
  publicationSlug: string;
  userId: string;
  subscriberName: string;
  tier: SubscriptionTier;
  status: 'active';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Note {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  publicationId?: string;
  publicationName?: string;
  publicationSlug?: string;
  body: string;
  quotedPostId?: string;
  quotedPostTitle?: string;
  likesCount: number;
  createdAt: Date | null;
  isShowcase?: boolean;
}

export interface Bookmark {
  id: string;
  postId: string;
  userId: string;
  postTitle: string;
  publicationName: string;
  createdAt: Date | null;
}

export interface Highlight {
  id: string;
  userId: string;
  postId: string;
  postTitle: string;
  publicationName: string;
  quote: string;
  note: string;
  color: HighlightColor;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  postId: string;
  percent: number;
  scrollY: number;
  updatedAt: Date | null;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  body: string;
  postId?: string;
  publicationSlug?: string;
  read: boolean;
  createdAt: Date | null;
}

export interface NewsletterDispatch {
  id: string;
  publicationId: string;
  ownerId: string;
  postId?: string;
  title: string;
  recipientCount: number;
  messageId: string;
  sentAt: Date | null;
}

export interface ReaderPrefs {
  fontSize: number;
  fontFamily: 'sans' | 'serif';
  width: 'narrow' | 'standard' | 'wide';
}

export type AppRoute =
  | { view: 'explore' }
  | { view: 'notes' }
  | { view: 'subscriptions' }
  | { view: 'studio'; editPostId?: string }
  | { view: 'settings' }
  | { view: 'post'; postId: string }
  | { view: 'publication'; slug: string }
  | { view: 'author'; authorId: string }
  | { view: 'topic'; tag: string };
