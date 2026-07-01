'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Sparkles, Calendar, Flag, Star,
  CheckCircle, MessageCircle, PenLine, Camera,
  ChevronLeft, ChevronRight, LogOut, ListTodo, CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/home',       icon: Home,          label: 'Home'            },
  { href: '/this-week',  icon: Sparkles,      label: 'This Week'       },
  { href: '/visits',     icon: Calendar,      label: 'Visits'          },
  { href: '/calendar',   icon: CalendarDays,  label: 'Calendar'        },
  { href: '/milestones', icon: Flag,          label: 'Milestones'      },
  { href: '/proud',      icon: Star,          label: 'Proud of Us'     },
  { href: '/checkin',    icon: CheckCircle,   label: 'Check In'        },
  { href: '/talk',       icon: MessageCircle, label: 'Talk It Out'     },
  { href: '/tasks',      icon: ListTodo,      label: 'Tasks'           },
  { href: '/notes',      icon: PenLine,       label: 'Notes & Doodles' },
  { href: '/photos',     icon: Camera,        label: 'Photos'          },
]

const SIDEBAR_BG     = '#FFF5F5'
const BORDER_COLOR   = '#F5EDE8'
const ACTIVE_BG      = '#FFE5E5'
const ACTIVE_COLOR   = '#FF6B6B'
const IDLE_COLOR     = '#7A5C5C'
const MUTED_COLOR    = '#B08585'

export default function SideNav({ pendingPhotos = 0 }: { pendingPhotos?: number }) {
  const pathname = usePathname()
  const router   = useRouter()

  // Desktop: expanded or icon-only rail
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  // Mobile: drawer open/closed
  const [mobileOpen, setMobileOpen] = useState(false)

  // Load desktop collapse preference from localStorage after mount
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

  // ── Shared panel content (used by both desktop sidebar and mobile drawer) ──

  function NavContent({ isMobile }: { isMobile: boolean }) {
    const showLabels = isMobile || !collapsed

    return (
      <div className="flex flex-col h-full select-none">

        {/* Header — logo + collapse control */}
        <div
          className="flex items-center flex-shrink-0 py-5"
          style={{ padding: showLabels ? '20px 20px' : '20px 0', justifyContent: showLabels ? 'space-between' : 'center' }}
        >
          {showLabels ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="text-xl leading-none">🩵</span>
                <span className="text-lg font-bold" style={{ color: ACTIVE_COLOR, letterSpacing: '-0.3px' }}>
                  Levbe
                </span>
              </div>
              {/* Desktop collapse-to-rail button */}
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

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: '0 8px' }}>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active    = pathname.startsWith(href)
              const hasBadge  = href === '/photos' && pendingPhotos > 0

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
                    {hasBadge && (
                      <span
                        className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-white"
                        style={{ width: 16, height: 16, fontSize: 9, fontWeight: 700, background: ACTIVE_COLOR }}
                      >
                        {pendingPhotos > 9 ? '9+' : pendingPhotos}
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
          className="flex-shrink-0 py-4"
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

  // Sidebar width on desktop — before mount, render expanded to avoid flicker on first load
  const desktopWidth = !mounted || !collapsed ? 220 : 56

  return (
    <>
      {/* ── Desktop sticky sidebar (in flow — pushes main content right) ── */}
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
        {/* Expand button — floats at the right edge when collapsed */}
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

      {/* ── Mobile: translucent backdrop when drawer is open ── */}
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

      {/* ── Mobile: always-visible edge handle ── */}
      {!mobileOpen && (
        <button
          className="md:hidden fixed top-1/2 left-0 z-50 flex items-center justify-center"
          style={{
            width: 22,
            height: 60,
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
    </>
  )
}
