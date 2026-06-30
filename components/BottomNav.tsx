'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PenLine, Heart, CheckCircle, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

const primaryNav = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/checkin', icon: CheckCircle, label: 'Check in' },
  { href: '/notes', icon: PenLine, label: 'Notes' },
  { href: '/proud', icon: Heart, label: 'Proud' },
]

const moreNav = [
  { href: '/photos', label: 'Photos', badge: true },
  { href: '/this-week', label: 'This Week', badge: false },
  { href: '/visits', label: 'Visits', badge: false },
  { href: '/milestones', label: 'Milestones', badge: false },
  { href: '/tasks', label: 'Tasks', badge: false },
  { href: '/talk', label: 'Talk it out', badge: false },
]

interface Props {
  pendingPhotos?: number
}

export default function BottomNav({ pendingPhotos = 0 }: Props) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = moreNav.some(n => pathname.startsWith(n.href))

  return (
    <>
      {/* More overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-20 left-4 right-4" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border" style={{ borderColor: '#F5EDE8' }}>
              {moreNav.map(item => {
                const hasBadge = item.badge && pendingPhotos > 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center px-5 py-4 border-b last:border-0 transition-colors hover:bg-[#FFFAF7]"
                    style={{ borderColor: '#F5EDE8', color: pathname.startsWith(item.href) ? '#FF6B6B' : '#2D1B1B' }}
                  >
                    <span className="font-medium flex-1">{item.label}</span>
                    {hasBadge && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: '#FF6B6B' }}
                      >
                        {pendingPhotos}
                      </span>
                    )}
                    {!hasBadge && pathname.startsWith(item.href) && (
                      <span className="text-lg">♡</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t" style={{ borderColor: '#F5EDE8' }}>
        <div className="flex items-stretch max-w-lg mx-auto">
          {primaryNav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
                style={{ color: active ? '#FF6B6B' : '#B08585' }}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setMoreOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative"
            style={{ color: isMoreActive || moreOpen ? '#FF6B6B' : '#B08585' }}
          >
            <div className="relative">
              <MoreHorizontal size={22} strokeWidth={isMoreActive || moreOpen ? 2.5 : 1.8} />
              {pendingPhotos > 0 && !pathname.startsWith('/photos') && (
                <div
                  className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
                  style={{ background: '#FF6B6B', fontSize: 8, fontWeight: 700 }}
                >
                  {pendingPhotos}
                </div>
              )}
            </div>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
