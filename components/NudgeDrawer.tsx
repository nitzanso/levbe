'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'

interface NudgeConfig {
  type: string
  message: string
  sub: string
  cta: string
  href: string
  emoji: string
}

const NUDGE_CONFIGS: NudgeConfig[] = [
  {
    type: 'no_entry_today',
    message: "Nothing from today yet",
    sub: "Even a quick highlight keeps the thread alive.",
    cta: "Add something →",
    href: '/our-days',
    emoji: '📝',
  },
  {
    type: 'no_doodle_3d',
    message: "No doodle in 3 days",
    sub: "Draw something — anything — for them.",
    cta: "Open Our Days →",
    href: '/our-days',
    emoji: '✏️',
  },
  {
    type: 'open_tasks',
    message: "You have tasks to work on",
    sub: "Check in on what's in progress.",
    cta: "See tasks →",
    href: '/together',
    emoji: '📋',
  },
  {
    type: 'no_confirmed_visit',
    message: "No confirmed visit planned",
    sub: "When are you two next in the same city?",
    cta: "Plan a visit →",
    href: '/together',
    emoji: '✈️',
  },
  {
    type: 'no_date_night',
    message: "No date night this week",
    sub: "Wednesday's almost here — plan something.",
    cta: "Open Together →",
    href: '/together',
    emoji: '🌙',
  },
]

interface NudgeState {
  [type: string]: number // last shown timestamp
}

const STORAGE_KEY = 'levbe_nudge_state'
const MAX_PER_DAY = 3
const TODAY_KEY = 'levbe_nudge_today'

interface Props {
  hasEntryToday: boolean
  hasDoodleRecent: boolean
  hasOpenTasks: boolean
  hasConfirmedVisit: boolean
  hasDateNightThisWeek: boolean
}

export default function NudgeDrawer({
  hasEntryToday,
  hasDoodleRecent,
  hasOpenTasks,
  hasConfirmedVisit,
  hasDateNightThisWeek,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [nudge, setNudge] = useState<NudgeConfig | null>(null)
  const [open, setOpen] = useState(false)

  const dismiss = useCallback(() => {
    setOpen(false)
    setTimeout(() => setNudge(null), 350)
  }, [])

  const doItNow = useCallback((href: string) => {
    dismiss()
    router.push(href)
  }, [dismiss, router])

  useEffect(() => {
    // Don't nudge on mobile/tiny screens or on the target pages
    const isMobile = window.innerWidth < 640

    // Count nudges shown today
    const todayStr = new Date().toISOString().split('T')[0]
    const todayCountRaw = localStorage.getItem(TODAY_KEY)
    const todayCount = todayCountRaw ? JSON.parse(todayCountRaw) : { date: '', count: 0 }
    const shownToday = todayCount.date === todayStr ? todayCount.count : 0
    if (shownToday >= MAX_PER_DAY) return

    const stateRaw = localStorage.getItem(STORAGE_KEY)
    const state: NudgeState = stateRaw ? JSON.parse(stateRaw) : {}
    const now = Date.now()
    const oneDayMs = 86400000

    // Build candidate nudges in priority order
    const candidates: NudgeConfig[] = []
    if (!hasEntryToday)          candidates.push(NUDGE_CONFIGS[0])
    if (!hasDoodleRecent)        candidates.push(NUDGE_CONFIGS[1])
    if (hasOpenTasks)            candidates.push(NUDGE_CONFIGS[2])
    if (!hasConfirmedVisit)      candidates.push(NUDGE_CONFIGS[3])
    if (!hasDateNightThisWeek && new Date().getDay() >= 3) candidates.push(NUDGE_CONFIGS[4])

    // Pick first candidate not shown in last 24h
    const pick = candidates.find(c => !state[c.type] || (now - state[c.type]) > oneDayMs)
    if (!pick) return

    const delay = setTimeout(() => {
      // Save state
      state[pick.type] = now
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      const newCount = { date: todayStr, count: shownToday + 1 }
      localStorage.setItem(TODAY_KEY, JSON.stringify(newCount))

      setNudge(pick)
      setOpen(true)
    }, 30000) // 30 seconds

    return () => clearTimeout(delay)
  }, [hasEntryToday, hasDoodleRecent, hasOpenTasks, hasConfirmedVisit, hasDateNightThisWeek, pathname])

  if (!nudge) return null

  return (
    <>
      {/* Backdrop (subtle) */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={dismiss}
          style={{ background: 'transparent' }} />
      )}

      {/* Drawer */}
      <div
        className="fixed top-1/2 right-0 z-50 transition-transform"
        style={{
          width: 280,
          transform: `translate(${open ? '0' : '100%'}, -50%)`,
          transitionDuration: '350ms',
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="m-3 rounded-3xl shadow-xl overflow-hidden"
          style={{ background: '#FFFAF7', border: '1px solid #F5EDE8' }}>
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-3xl">{nudge.emoji}</div>
              <button onClick={dismiss}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#F5EDE8' }}>
                <X size={13} style={{ color: '#7A5C5C' }} />
              </button>
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: '#2D1B1B' }}>{nudge.message}</p>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#B08585' }}>{nudge.sub}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doItNow(nudge.href)}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white"
                style={{ background: '#FF6B6B' }}>
                {nudge.cta}
              </button>
              <button onClick={dismiss}
                className="w-full py-2 rounded-2xl text-xs font-medium"
                style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
