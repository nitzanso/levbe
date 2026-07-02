'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, BookOpen, MessageCircle, CalendarDays,
  ChevronLeft, ChevronRight, LogOut, Bell, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { nickname, partnerNick } from '@/lib/nicknames'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  recipient: string
  type: string
  entity_type: string | null
  entity_id: string | null
  message: string
  read: boolean
  created_at: string
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/home',      icon: Home,          label: 'Home'        },
  { href: '/our-days',  icon: BookOpen,      label: 'Our Days'    },
  { href: '/talk',      icon: MessageCircle, label: 'Talk It Out' },
  { href: '/together',  icon: CalendarDays,  label: 'Together'    },
]

// ─── Colors ───────────────────────────────────────────────────────────────────

const SIDEBAR_BG   = '#FFF5F5'
const BORDER_COLOR = '#F5EDE8'
const ACTIVE_BG    = '#FFE5E5'
const ACTIVE_COLOR = '#FF6B6B'
const IDLE_COLOR   = '#7A5C5C'
const MUTED_COLOR  = '#B08585'

// ─── Notification helpers ─────────────────────────────────────────────────────

function notifPath(n: Notification): string {
  if (n.type === 'comment' || n.type === 'reaction') {
    if (n.entity_type === 'photo') return '/photos'
    if (n.entity_type === 'note') return '/notes'
    if (n.entity_type === 'achievement') return '/proud'
    if (n.entity_type === 'task') return '/tasks'
    return '/home'
  }
  const MAP: Record<string, string> = {
    photo: '/photos', drawing: '/notes', note: '/notes',
    achievement: '/proud', task_comment: '/tasks',
    ping: '/home', dream_added: '/home', daily_nudge: '/home',
  }
  return MAP[n.type] ?? '/home'
}

function notifIcon(type: string): string {
  const ICONS: Record<string, string> = {
    photo: '📷', drawing: '✏️', note: '💛', achievement: '🌟',
    comment: '💬', reaction: '👍', ping: '👋',
    task_comment: '💬', dream_added: '🌍', daily_nudge: '🌙',
  }
  return ICONS[type] ?? '🔔'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SideNav({
  pendingPhotos = 0,
  userId,
  userName,
}: {
  pendingPhotos?: number
  userId: string
  userName: string
}) {
  const pathname = usePathname()
  const router   = useRouter()

  // Desktop: expanded or icon-only rail
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  // Mobile: drawer open/closed
  const [mobileOpen, setMobileOpen] = useState(false)

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifError, setNotifError] = useState<string | null>(null)

  // Load collapse preference from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem('levbe-nav-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
    setMounted(true)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll while mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Load notifications + realtime subscription
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    supabase
      .from('notifications')
      .select('*')
      .eq('recipient', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Levbe] Notification load error:', error.message, '— Run supabase-notifications-v2.sql in Supabase SQL Editor if you haven\'t already.')
          setNotifError(error.message)
          return
        }
        console.log(`[Levbe] Loaded ${data?.length ?? 0} notifications for user ${userId}`)
        if (data) setNotifications(data as Notification[])
      })

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient=eq.${userId}`,
      }, payload => {
        console.log('[Levbe] Realtime notification received:', payload.new)
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient=eq.${userId}`,
      }, payload => {
        setNotifications(prev =>
          prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n)
        )
      })
      .subscribe((status, err) => {
        if (err || status === 'CHANNEL_ERROR') {
          console.error('[Levbe] Realtime subscription error:', status, err)
        } else {
          console.log('[Levbe] Realtime subscription status:', status)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Derived notification counts
  const totalUnread  = notifications.filter(n => !n.read).length
  const notesUnread  = notifications.filter(n => !n.read && (n.type === 'note' || n.type === 'drawing')).length
  const proudUnread  = notifications.filter(n => !n.read && n.type === 'achievement').length
  const tasksUnread  = notifications.filter(n => !n.read && n.type === 'task_comment').length

  function badgeCount(href: string): number {
    if (href === '/our-days') return pendingPhotos + notesUnread + proudUnread
    if (href === '/together') return tasksUnread
    return 0
  }

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('levbe-nav-collapsed', String(next))
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleNotifClick(notif: Notification) {
    setNotifOpen(false)
    if (!notif.read) {
      const supabase = createClient()
      supabase.from('notifications').update({ read: true }).eq('id', notif.id).then(() => {})
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    router.push(notifPath(notif))
  }

  async function markAllRead() {
    if (totalUnread === 0) return
    const supabase = createClient()
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    supabase.from('notifications').update({ read: true }).in('id', ids).then(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Shared panel content ────────────────────────────────────────────────────

  function NavContent({ isMobile }: { isMobile: boolean }) {
    const showLabels = isMobile || !collapsed

    return (
      <div className="flex flex-col h-full select-none">

        {/* Header — logo + collapse control */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            padding: showLabels ? '20px 20px' : '20px 0',
            justifyContent: showLabels ? 'space-between' : 'center',
          }}
        >
          {showLabels ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="text-xl leading-none">🩵</span>
                <span className="text-lg font-bold" style={{ color: ACTIVE_COLOR, letterSpacing: '-0.3px' }}>
                  Levbe
                </span>
              </div>
              {!isMobile && (
                <button
                  onClick={toggleCollapsed}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ background: ACTIVE_BG, color: ACTIVE_COLOR }}
                  title="Collapse navigation"
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </button>
              )}
            </>
          ) : (
            <span className="text-xl leading-none">🩵</span>
          )}
        </div>

        {/* Notification bell — above nav links */}
        <div style={{ padding: showLabels ? '0 8px 6px' : '0 0 6px' }}>
          <button
            onClick={() => { if (isMobile) setMobileOpen(false); setNotifOpen(true) }}
            className="w-full flex items-center rounded-xl transition-colors"
            style={{
              gap: showLabels ? 12 : 0,
              padding: showLabels ? '9px 12px' : '9px 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
              color: totalUnread > 0 ? ACTIVE_COLOR : IDLE_COLOR,
              background: notifOpen ? ACTIVE_BG : 'transparent',
            }}
            title={!showLabels ? `Notifications${totalUnread > 0 ? ` (${totalUnread})` : ''}` : undefined}
          >
            <span className="relative flex-shrink-0">
              <Bell size={20} strokeWidth={1.8} />
              {totalUnread > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center text-white"
                  style={{ width: 16, height: 16, fontSize: 9, fontWeight: 700, background: ACTIVE_COLOR }}
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </span>
            {showLabels && <span className="text-sm font-medium">Notifications</span>}
            {showLabels && totalUnread > 0 && (
              <span
                className="ml-auto rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1.5"
                style={{ minWidth: 20, height: 20, background: ACTIVE_COLOR }}
              >
                {totalUnread}
              </span>
            )}
          </button>
        </div>

        {/* Divider */}
        <div style={{ margin: showLabels ? '0 20px 8px' : '0 8px 8px', height: 1, background: BORDER_COLOR }} />

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: '0 8px' }}>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              const badge  = badgeCount(href)

              return (
                <Link
                  key={href}
                  href={href}
                  title={!showLabels ? label : undefined}
                  className="flex items-center rounded-xl transition-all duration-150"
                  style={{
                    gap: showLabels ? 12 : 0,
                    padding: showLabels ? '10px 12px' : '10px 0',
                    justifyContent: showLabels ? 'flex-start' : 'center',
                    background: active ? ACTIVE_BG : 'transparent',
                    color: active ? ACTIVE_COLOR : IDLE_COLOR,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span className="relative flex-shrink-0">
                    <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                    {badge > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-white"
                        style={{ width: 16, height: 16, fontSize: 9, fontWeight: 700, background: ACTIVE_COLOR }}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  {showLabels && (
                    <span className="text-sm truncate">{label}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Bottom — sign out */}
        <div
          className="flex-shrink-0"
          style={{ padding: showLabels ? '16px 8px' : '16px 0', borderTop: `1px solid ${BORDER_COLOR}` }}
        >
          <button
            onClick={handleSignOut}
            className="w-full flex items-center rounded-xl transition-colors hover:opacity-70"
            style={{
              gap: showLabels ? 12 : 0,
              padding: showLabels ? '10px 12px' : '10px 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
              color: MUTED_COLOR,
            }}
            title={!showLabels ? 'Sign out' : undefined}
          >
            <LogOut size={18} strokeWidth={1.8} className="flex-shrink-0" />
            {showLabels && <span className="text-sm">Sign out</span>}
          </button>
        </div>
      </div>
    )
  }

  // Sidebar width on desktop
  const desktopWidth = !mounted || !collapsed ? 220 : 56

  return (
    <>
      {/* ── Desktop sticky sidebar ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen border-r overflow-hidden"
        style={{
          width: desktopWidth,
          minWidth: desktopWidth,
          background: SIDEBAR_BG,
          borderColor: BORDER_COLOR,
          transition: 'width 280ms ease, min-width 280ms ease',
          zIndex: 20,
        }}
      >
        {mounted && collapsed && (
          <button
            onClick={toggleCollapsed}
            className="absolute top-5 -right-3.5 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
            style={{ background: ACTIVE_COLOR, color: 'white', border: `2px solid ${SIDEBAR_BG}` }}
            title="Expand navigation"
          >
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        )}
        <NavContent isMobile={false} />
      </aside>

      {/* ── Mobile: backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(45,27,27,0.22)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ── */}
      <aside
        className="md:hidden fixed inset-y-0 left-0 z-50 flex flex-col border-r"
        style={{
          width: 272,
          background: SIDEBAR_BG,
          borderColor: BORDER_COLOR,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <NavContent isMobile={true} />
      </aside>

      {/* ── Mobile: edge handle ── */}
      {!mobileOpen && !notifOpen && (
        <button
          className="md:hidden fixed top-1/2 left-0 z-50 flex items-center justify-center"
          style={{
            width: 22, height: 60,
            transform: 'translateY(-50%)',
            borderRadius: '0 14px 14px 0',
            background: ACTIVE_COLOR,
            color: 'white',
            boxShadow: '3px 0 12px rgba(255,107,107,0.35)',
          }}
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      )}

      {/* ── Notification panel ── */}
      {/* Backdrop — transparent, just catches outside clicks */}
      {notifOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 29 }}
          onClick={() => setNotifOpen(false)}
        />
      )}
      {/* Panel — always mounted, slides in/out */}
      <div
        className="fixed inset-y-0 right-0 flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: 'min(320px, 100vw)',
          background: '#FFFAF7',
          borderLeft: `1px solid ${BORDER_COLOR}`,
          transform: notifOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
          zIndex: 30,
        }}
      >
        <NotificationPanel
          notifications={notifications}
          userName={userName}
          notifError={notifError}
          onClose={() => setNotifOpen(false)}
          onNotifClick={handleNotifClick}
          onMarkAll={markAllRead}
          totalUnread={totalUnread}
        />
      </div>
    </>
  )
}

// ─── Notification Panel ────────────────────────────────────────────────────────

function NotificationPanel({
  notifications, userName, notifError, onClose, onNotifClick, onMarkAll, totalUnread,
}: {
  notifications: Notification[]
  userName: string
  notifError: string | null
  onClose: () => void
  onNotifClick: (n: Notification) => void
  onMarkAll: () => void
  totalUnread: number
}) {
  const myNick = nickname(userName)
  const pNick  = partnerNick(userName)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: 16, borderBottom: `1px solid #F5EDE8` }}
      >
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#2D1B1B' }}>Notifications</h2>
          {totalUnread > 0 && (
            <p className="text-xs" style={{ color: '#B08585' }}>{totalUnread} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <button
              onClick={onMarkAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: '#F5EDE8', color: '#7A5C5C' }}
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose}>
            <X size={20} style={{ color: '#B08585' }} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifError && (
          <div className="mx-4 mt-4 p-3 rounded-xl text-xs" style={{ background: '#FFF5F5', color: '#B08585', border: '1px solid #FFE5E5' }}>
            ⚠️ Could not load notifications — check the browser console. If you haven&apos;t yet, run <strong>supabase-notifications-v2.sql</strong> in your Supabase SQL Editor.
          </div>
        )}
        {!notifError && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center pb-12">
            <div className="text-4xl mb-3">🤍</div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#2D1B1B' }}>
              Nothing yet, {myNick} —
            </p>
            <p className="text-sm" style={{ color: '#B08585' }}>
              when {pNick} shares something it&apos;ll show up here
            </p>
          </div>
        ) : (
          <div>
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => onNotifClick(n)}
                className="w-full flex items-start gap-3 px-5 py-3.5 text-left border-b transition-colors hover:opacity-80"
                style={{
                  borderColor: '#F5EDE8',
                  background: n.read ? 'transparent' : '#FFF5F5',
                }}
              >
                {/* Icon */}
                <span className="flex-shrink-0 text-lg leading-none mt-0.5">
                  {notifIcon(n.type)}
                </span>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-snug"
                    style={{
                      color: '#2D1B1B',
                      fontWeight: n.read ? 400 : 600,
                    }}
                  >
                    {n.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {/* Unread dot */}
                {!n.read && (
                  <div
                    className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                    style={{ background: '#FF6B6B' }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
