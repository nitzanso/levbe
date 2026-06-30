'use client'

import Link from 'next/link'
import { Calendar, Star, PenLine, CheckCircle, Sparkles, Camera } from 'lucide-react'
import Card from '@/components/Card'
import SignOutButton from '@/components/SignOutButton'

interface Props {
  userEmail: string
  userName: string
  quote: { text: string; author: string | null } | null
  nextVisit: { start_date: string; traveler: string; notes: string | null } | null
  todayCheckin: { mood: number } | null
  latestNote: { type: string; content: string; author: string; created_at: string } | null
  achievements: { text: string; author: string; created_at: string }[]
  weekMoment: { idea_text: string; confirmed: boolean } | null
  pendingPhotoCount: number
  partnerName: string
}

const moodEmoji = ['', '😔', '😕', '😐', '🙂', '😊']
const moodLabel = ['', 'Struggling', 'A bit low', 'Okay', 'Good', 'Great']

function daysUntil(dateStr: string) {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function HomeClient({ userName, quote, nextVisit, todayCheckin, latestNote, achievements, weekMoment, pendingPhotoCount, partnerName }: Props) {
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="px-4 pb-6">
      {/* Header */}
      <div className="pt-14 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: '#B08585' }}>{greeting},</p>
          <h1 className="text-2xl font-bold capitalize" style={{ color: '#2D1B1B' }}>{userName} ♡</h1>
        </div>
        <SignOutButton />
      </div>

      {/* Daily quote */}
      {quote ? (
        <div className="mt-4 rounded-3xl p-5" style={{ background: 'linear-gradient(135deg, #FFE5E5, #FFF8D6)' }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B08585' }}>Today&apos;s quote</div>
          <p className="text-base leading-relaxed font-medium" style={{ color: '#2D1B1B' }}>"{quote.text}"</p>
          {quote.author && <p className="text-sm mt-2" style={{ color: '#B08585' }}>— {quote.author}</p>}
        </div>
      ) : (
        <div className="mt-4 rounded-3xl p-5" style={{ background: 'linear-gradient(135deg, #FFE5E5, #FFF8D6)' }}>
          <p className="text-base" style={{ color: '#B08585' }}>Add your first quote in the database to see it here ♡</p>
        </div>
      )}

      {/* Pending photo from partner */}
      {pendingPhotoCount > 0 && (
        <div className="mt-4">
          <Link href="/photos">
            <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
              style={{ background: 'linear-gradient(135deg, #FFF8D6, #FFE5E5)' }}>
              <span className="text-3xl flex-shrink-0">📸</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                  {partnerName} sent you {pendingPhotoCount === 1 ? 'a photo' : `${pendingPhotoCount} photos`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>Tap to open it ✨</p>
              </div>
              <Camera size={18} style={{ color: '#FF6B6B', flexShrink: 0 }} />
            </div>
          </Link>
        </div>
      )}

      {/* Check-in prompt */}
      <div className="mt-4">
        {todayCheckin ? (
          <Card accent="teal">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{moodEmoji[todayCheckin.mood]}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#2D1B1B' }}>You checked in — {moodLabel[todayCheckin.mood]}</p>
                <p className="text-xs" style={{ color: '#B08585' }}>Today&apos;s feeling is logged</p>
              </div>
            </div>
          </Card>
        ) : (
          <Link href="/checkin">
            <Card className="hover:shadow-md transition-shadow" accent="coral">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle size={22} style={{ color: '#FF6B6B' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>How are you feeling?</p>
                    <p className="text-xs" style={{ color: '#B08585' }}>Log today&apos;s check-in</p>
                  </div>
                </div>
                <span style={{ color: '#B08585' }}>→</span>
              </div>
            </Card>
          </Link>
        )}
      </div>

      {/* This week's moment */}
      <div className="mt-3">
        <Link href="/this-week">
          <Card className="hover:shadow-md transition-shadow" accent={weekMoment?.confirmed ? 'teal' : 'gold'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={22} style={{ color: weekMoment?.confirmed ? '#4ECDC4' : '#FFD93D' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                    {weekMoment ? weekMoment.idea_text : 'No moment planned yet this week'}
                  </p>
                  <p className="text-xs" style={{ color: '#B08585' }}>
                    {weekMoment?.confirmed ? 'Confirmed ✓' : 'Tap to plan this week'}
                  </p>
                </div>
              </div>
              <span style={{ color: '#B08585' }}>→</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Next visit */}
      {nextVisit && (
        <div className="mt-3">
          <Link href="/visits">
            <Card accent="coral">
              <div className="flex items-center gap-3">
                <Calendar size={22} style={{ color: '#FF6B6B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                    {nextVisit.traveler} visits — {formatDate(nextVisit.start_date)}
                  </p>
                  <p className="text-xs" style={{ color: '#B08585' }}>
                    {daysUntil(nextVisit.start_date) === 0 ? 'Today!' : `${daysUntil(nextVisit.start_date)} days away`}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Latest note from partner */}
      {latestNote && (
        <div className="mt-3">
          <Link href="/notes">
            <Card accent="teal">
              <div className="flex items-center gap-3">
                <PenLine size={22} style={{ color: '#4ECDC4' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1" style={{ color: '#B08585' }}>
                    A note from your love · {timeAgo(latestNote.created_at)}
                  </p>
                  {latestNote.type === 'note' ? (
                    <p className="text-sm font-handwriting truncate" style={{ color: '#2D1B1B' }}>{latestNote.content}</p>
                  ) : (
                    <p className="text-sm" style={{ color: '#2D1B1B' }}>A doodle is waiting for you ✏️</p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Proud of us feed preview */}
      {achievements.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: '#2D1B1B' }}>Proud of us lately</h2>
            <Link href="/proud" className="text-xs" style={{ color: '#FF6B6B' }}>See all →</Link>
          </div>
          <div className="space-y-2">
            {achievements.map((a, i) => (
              <Card key={i}>
                <div className="flex gap-2 items-start">
                  <Star size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#FFD93D' }} />
                  <p className="text-sm" style={{ color: '#2D1B1B' }}>{a.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
