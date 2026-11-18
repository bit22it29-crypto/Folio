import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bell,
  BookMarked,
  CheckCheck,
  LogOut,
  Moon,
  PenSquare,
  Search,
  Sun,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/markdown';
import type {
  AppNotification,
  AppRoute,
  Post,
  Subscription,
  UserProfile,
} from '../types/folio';

interface NavbarProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  user: User | null;
  profile: UserProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  notifications: AppNotification[];
  subscriptions: Subscription[];
  posts: Post[];
  onMarkNotificationRead: (notifId: string) => void;
  onMarkAllNotificationsRead: () => void;
}

export function Navbar({
  route,
  onNavigate,
  user,
  profile,
  onSignIn,
  onSignOut,
  authLoading,
  theme,
  onToggleTheme,
  onOpenSearch,
  notifications,
  subscriptions,
  posts,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const zone3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (zone3Ref.current && !zone3Ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navItems: Array<{ label: string; view: AppRoute['view'] }> = [
    { label: 'Dispatches', view: 'explore' },
    { label: 'Salon', view: 'notes' },
    { label: 'Library', view: 'subscriptions' },
    { label: 'Studio', view: 'studio' },
  ];

  const displayName = profile?.displayName || user?.displayName || 'Writer';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Recent dispatches from subscribed publications to surface in the bell alongside live alerts
  const recentSubscribedPosts = useMemo(() => {
    if (!user || subscriptions.length === 0) return [];
    const subPubIds = new Set(subscriptions.map((s) => s.publicationId));
    return posts.filter((p) => subPubIds.has(p.publicationId)).slice(0, 3);
  }, [user, subscriptions, posts]);

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border-hairline)] transition-colors">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate({ view: 'explore' })}
          className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8B5CF6]"
        >
          Folio
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav
          aria-label="Primary"
          className="flex items-center gap-4 sm:gap-7 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive =
              route.view === item.view ||
              (item.view === 'explore' &&
                (route.view === 'post' ||
                  route.view === 'publication' ||
                  route.view === 'topic'));
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate({ view: item.view } as AppRoute)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8B5CF6] ${
                  isActive
                    ? 'text-[var(--text-primary)] border-[#8B5CF6]'
                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Search, Notifications, Theme Toggle & User Action */}
        <div className="flex items-center gap-2 shrink-0 relative" ref={zone3Ref}>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search Folio (Ctrl+K or Cmd+K)"
            title="Search essays, publications, #topics & writers (⌘K)"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#8B5CF6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-accent-soft)]" aria-hidden="true" />
            <span className="hidden lg:inline font-mono text-[11px] text-[var(--text-muted)]">
              ⌘K
            </span>
          </button>

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setMenuOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="relative inline-flex items-center justify-center p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#8B5CF6] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#6D28D9] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Activity & Dispatches
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-accent)] hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                    {notifications.length === 0 && recentSubscribedPosts.length === 0 ? (
                      <p className="px-4 py-8 text-xs text-center text-[var(--text-muted)]">
                        No recent alerts yet. Replies, likes, and new issues from publications you follow appear here.
                      </p>
                    ) : (
                      <>
                        {notifications.slice(0, 10).map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => {
                              if (!notif.read) onMarkNotificationRead(notif.id);
                              setNotifOpen(false);
                              if (notif.postId) {
                                onNavigate({ view: 'post', postId: notif.postId });
                              } else if (notif.publicationSlug) {
                                onNavigate({ view: 'publication', slug: notif.publicationSlug });
                              }
                            }}
                            className={`w-full px-4 py-3 text-left transition-colors cursor-pointer ${
                              notif.read
                                ? 'hover:bg-[var(--bg-surface-hover)]'
                                : 'bg-[var(--bg-active-soft)] hover:bg-[var(--bg-surface-hover)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                {notif.title}
                              </span>
                              {!notif.read && (
                                <span
                                  className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0"
                                  aria-label="Unread"
                                />
                              )}
                            </div>
                            {notif.body && (
                              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                {notif.body}
                              </p>
                            )}
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                              {formatRelativeTime(notif.createdAt)}
                            </p>
                          </button>
                        ))}

                        {recentSubscribedPosts.length > 0 && (
                          <div className="bg-[var(--bg-surface-alt)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Latest from Subscriptions
                          </div>
                        )}
                        {recentSubscribedPosts.map((p) => (
                          <button
                            key={`sub-feed-${p.id}`}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              onNavigate({ view: 'post', postId: p.id });
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                          >
                            <p className="text-xs font-medium text-[var(--text-accent)] truncate">
                              {p.publicationName}
                            </p>
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {p.title}
                            </p>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Switch to Light mode'
                : 'Switch to Obsidian dark theme'
            }
            aria-pressed={theme === 'light'}
            title={
              theme === 'dark'
                ? 'Switch to Light mode for daytime reading'
                : 'Switch to Obsidian dark theme'
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#8B5CF6] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8B5CF6]"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#FDE68A]" aria-hidden="true" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#6D28D9]" aria-hidden="true" />
                <span className="hidden md:inline">Obsidian</span>
              </>
            )}
          </button>

          {user ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[#6D28D9] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8B5CF6]"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#6D28D9] text-white text-xs font-medium flex items-center justify-center">
                    {initials}
                  </span>
                )}
                <span className="hidden sm:inline text-sm font-medium text-[var(--text-primary)] max-w-[140px] truncate">
                  {displayName}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl shadow-2xl py-1.5 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-[var(--border-hairline)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-[var(--text-accent-soft)] truncate">
                      @{profile?.handle || 'writer'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate({ view: 'studio' });
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-body)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <PenSquare className="w-4 h-4 text-[var(--text-accent-soft)]" />
                    <span>Writer Studio</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate({ view: 'subscriptions' });
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-body)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <BookMarked className="w-4 h-4 text-[var(--text-accent-soft)]" />
                    <span>Library & Inbox</span>
                  </button>
                  <div className="border-t border-[var(--border-hairline)] mt-1 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-danger)] hover:bg-[var(--bg-danger-hover)] flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
