'use client'

import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import { Bell, Camera, ChevronDown, ChevronUp, Plus, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { nickname, partnerNick } from '@/lib/nicknames'

interface CheckIn { mood: number; author: string }
interface Dream { id: string; text: string; done: boolean; done_at: string | null }
interface Highlight { id: string; text: string; author: string }
interface Achievement { text: string; author: string }

interface Props {
  userId: string
  userEmail: string
  userName: string
  partnerName: string
  myBackgroundUrl: string | null
  partnerBackgroundUrl: string | null
  nextVisit: { start_date: string; traveler: string } | null
  myCheckin: { mood: number } | null
  partnerCheckin: { mood: number } | null
  weekCheckins: CheckIn[]
  weekPhotos: number
  weekNotes: number
  weekHighlights: Highlight[]
  weekAchievements: Achievement[]
  weekMoment: { idea_text: string; confirmed: boolean } | null
  pendingPhotoCount: number
  dailyIdea: { text: string } | null
  dreams: Dream[]
  quote: { text: string; author: string | null } | null
  todayPingCount: number
}

const MOOD_EMOJI = ['', '😔', '😕', '😐', '🙂', '😊']
const MOOD_LABEL = ['', 'Struggling', 'A bit low', 'Okay', 'Good', 'Great']
const PING_LIMIT = 3

function daysUntil(dateStr: string) {
  const t = new Date(dateStr); t.setHours(0, 0, 0, 0)
  const n = new Date(); n.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - n.getTime()) / 86400000)
}

function journeyMonths(startDate: string) {
  const start = new Date(startDate)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}

// Frosted glass card — overlaid on background photo
function FrostCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl p-4 ${className}`}
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  )
}

export default function HomeClient({
  userId, userEmail, userName, partnerName,
  myBackgroundUrl, partnerBackgroundUrl,
  nextVisit, myCheckin, partnerCheckin,
  weekCheckins, weekPhotos, weekNotes,
  weekHighlights, weekAchievements, weekMoment,
  pendingPhotoCount, dailyIdea, dreams, quote,
  todayPingCount,
}: Props) {
  const myNick = nickname(userName)
  const pNick  = partnerNick(userName) || partnerName
  const supabase = createClient()
  const router = useRouter()

  // Background photo state
  const [showPartnerBg, setShowPartnerBg] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const activeBg = showPartnerBg ? partnerBackgroundUrl : myBackgroundUrl

  // Ping
  const [pingState, setPingState] = useState<'idle' | 'sending' | 'sent' | 'maxed'>(
    todayPingCount >= PING_LIMIT ? 'maxed' : 'idle'
  )

  // Dreams
  const [localDreams, setLocalDreams] = useState<Dream[]>(dreams)
  const [dreamsOpen, setDreamsOpen] = useState(false)
  const [newDream, setNewDream] = useState('')
  const [dreamPending, startDreamTransition] = useTransition()

  // Greeting
  const greeting = (() => {
    const h = new Date().getHours()
    if (h >= 6  && h < 12) return `Good morning, ${myNick} ☀️`
    if (h >= 12 && h < 18) return `Hey ${myNick} 👋`
    if (h >= 18 && h < 23) return `Good evening, ${myNick} 🌙`
    return `Still up, ${myNick}? 🌙`
  })()

  // Journey months
  const journeyStart = process.env.NEXT_PUBLIC_JOURNEY_START_DATE
  const months = journeyStart ? journeyMonths(journeyStart) : null

  async function sendPing() {
    if (pingState !== 'idle') return
    setPingState('sending')
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping' }),
      })
    } catch { /* silent */ }
    setPingState('sent')
    setTimeout(() => setPingState('idle'), 3000)
  }

  async function uploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `backgrounds/${userId}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('user-backgrounds')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage
        .from('user-backgrounds')
        .getPublicUrl(path)
      await supabase.from('users').update({ background_url: publicUrl }).eq('id', userId)
      router.refresh()
    } catch {
      // silent — will just keep the old bg
    } finally {
      setUploading(false)
    }
  }

  async function addDream() {
    if (!newDream.trim()) return
    const text = newDream.trim()
    setNewDream('')
    const tempId = `temp-${Date.now()}`
    const temp: Dream = { id: tempId, text, done: false, done_at: null }
    setLocalDreams(d => [...d, temp])
    startDreamTransition(async () => {
      const { data } = await supabase
        .from('dreams')
        .insert({ author: userId, text })
        .select()
        .single()
      if (data) {
        setLocalDreams(d => d.map(x => x.id === tempId ? data : x))
      }
    })
  }

  async function toggleDream(dream: Dream) {
    const next = !dream.done
    setLocalDreams(d => d.map(x => x.id === dream.id ? { ...x, done: next, done_at: next ? new Date().toISOString() : null } : x))
    await supabase
      .from('dreams')
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq('id', dream.id)
  }

  const weekAvgMood = weekCheckins.length > 0
    ? Math.round(weekCheckins.reduce((s, c) => s + c.mood, 0) / weekCheckins.length)
    : null

  const doneDreams = localDreams.filter(d => d.done).length

  return (
    <div className="min-h-screen relative">
      {/* Background photo layer */}
      <div
        className="fixed inset-0 z-0 transition-all duration-700"
        style={{
          background: activeBg
            ? `url(${activeBg}) center/cover no-repeat`
            : 'linear-gradient(160deg, #FFECD2 0%, #FFD6D6 40%, #D4F1F0 100%)',
        }}
      />
      {/* Soft overlay to help readability */}
      <div className="fixed inset-0 z-0" style={{ background: 'rgba(255,248,244,0.35)' }} />

      {/* Scrollable content */}
      <div className="relative z-10 px-4 pb-10 space-y-4">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="pt-14 pb-2 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#2D1B1B', textShadow: '0 1px 6px rgba(255,255,255,0.6)' }}>
              {greeting}
            </h1>
            {/* Time anchors */}
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {nextVisit && (
                <Link href="/visits">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.75)', color: '#FF6B6B', backdropFilter: 'blur(8px)' }}>
                    {daysUntil(nextVisit.start_date) === 0 ? '🤍 Together today!' : `✈️ ${daysUntil(nextVisit.start_date)}d until next visit`}
                  </span>
                </Link>
              )}
              {months !== null && months > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.75)', color: '#7A5C5C', backdropFilter: 'blur(8px)' }}>
                  🗓 {months} month{months !== 1 ? 's' : ''} together
                </span>
              )}
            </div>
          </div>

          {/* Right controls: background + partner peek + ping */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={sendPing}
              disabled={pingState === 'sending' || pingState === 'maxed'}
              title={pingState === 'maxed' ? `You've already pinged ${PING_LIMIT} times today` : `Ping ${pNick}`}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
              style={{ background: pingState === 'sent' ? 'rgba(78,205,196,0.85)' : 'rgba(255,255,255,0.78)', backdropFilter: 'blur(8px)', opacity: pingState === 'maxed' ? 0.4 : 1 }}
            >
              <Bell size={16} style={{ color: pingState === 'sent' ? 'white' : '#FF6B6B' }} />
            </button>

            <button
              onClick={() => bgInputRef.current?.click()}
              disabled={uploading}
              title="Change your background"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(8px)' }}
            >
              <Camera size={15} style={{ color: uploading ? '#B08585' : '#7A5C5C' }} />
            </button>
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={uploadBackground} />

            {partnerBackgroundUrl && (
              <button
                onClick={() => setShowPartnerBg(p => !p)}
                className="text-[10px] px-2 py-1 rounded-full font-medium"
                style={{ background: showPartnerBg ? 'rgba(78,205,196,0.85)' : 'rgba(255,255,255,0.78)', color: showPartnerBg ? 'white' : '#7A5C5C', backdropFilter: 'blur(8px)' }}
              >
                {showPartnerBg ? `← mine` : `${pNick}'s`}
              </button>
            )}
          </div>
        </div>

        {pingState === 'sent' && (
          <p className="text-center text-xs font-medium" style={{ color: '#2BA99C', textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}>
            Ping sent — {pNick} knows you&apos;re thinking of them 💛
          </p>
        )}

        {/* ── Pending photo nudge ───────────────────────────────── */}
        {pendingPhotoCount > 0 && (
          <Link href="/photos">
            <FrostCard className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">📸</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                  {pNick} sent you {pendingPhotoCount === 1 ? 'a photo' : `${pendingPhotoCount} photos`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>Tap to open it ✨</p>
              </div>
              <span style={{ color: '#B08585' }}>→</span>
            </FrostCard>
          </Link>
        )}

        {/* ── Mood: quick check-in or today's moods ────────────── */}
        {myCheckin ? (
          <FrostCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{MOOD_EMOJI[myCheckin.mood]}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#2D1B1B' }}>
                    You&apos;re feeling {MOOD_LABEL[myCheckin.mood].toLowerCase()} today
                  </p>
                  {partnerCheckin && (
                    <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>
                      {pNick} is {MOOD_LABEL[partnerCheckin.mood].toLowerCase()} {MOOD_EMOJI[partnerCheckin.mood]}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/checkin">
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#FFE5E5', color: '#FF6B6B' }}>Edit</span>
              </Link>
            </div>
          </FrostCard>
        ) : (
          <Link href="/checkin">
            <FrostCard className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤍</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>How are you today?</p>
                  <p className="text-xs" style={{ color: '#B08585' }}>Tell {pNick} how you&apos;re feeling</p>
                </div>
              </div>
              <span style={{ color: '#B08585' }}>→</span>
            </FrostCard>
          </Link>
        )}

        {/* ── This Week Snapshot ───────────────────────────────── */}
        <FrostCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: '#2D1B1B' }}>This week</p>
            {weekMoment && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: weekMoment.confirmed ? '#E0F7F5' : '#FFF8D6', color: weekMoment.confirmed ? '#2BA99C' : '#C5960A' }}>
                {weekMoment.confirmed ? '✓ moment confirmed' : '✨ moment pending'}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'check-ins', value: weekCheckins.length, emoji: weekAvgMood ? MOOD_EMOJI[weekAvgMood] : '📋' },
              { label: 'photos', value: weekPhotos, emoji: '📸' },
              { label: 'notes', value: weekNotes, emoji: '✏️' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-2.5 text-center" style={{ background: 'rgba(255,235,235,0.5)' }}>
                <div className="text-lg">{s.emoji}</div>
                <div className="text-base font-bold leading-tight" style={{ color: '#2D1B1B' }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: '#B08585' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pinned highlights */}
          {weekHighlights.length > 0 && (
            <div className="space-y-1 mb-2">
              {weekHighlights.slice(0, 3).map(h => (
                <div key={h.id} className="flex gap-2 items-start">
                  <span className="text-sm">⭐</span>
                  <p className="text-xs leading-relaxed" style={{ color: '#2D1B1B' }}>{h.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Achievements */}
          {weekAchievements.length > 0 && (
            <div className="space-y-1">
              {weekAchievements.map((a, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm">🌟</span>
                  <p className="text-xs leading-relaxed" style={{ color: '#2D1B1B' }}>{a.text}</p>
                </div>
              ))}
            </div>
          )}

          {weekHighlights.length === 0 && weekAchievements.length === 0 && (
            <p className="text-xs text-center" style={{ color: '#B08585' }}>Nothing pinned yet — add highlights in This Week</p>
          )}

          <Link href="/this-week">
            <p className="text-xs mt-3 text-center font-medium" style={{ color: '#FF6B6B' }}>See full week →</p>
          </Link>
        </FrostCard>

        {/* ── Daily Idea ───────────────────────────────────────── */}
        {dailyIdea && (
          <FrostCard>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#B08585' }}>Today&apos;s idea</p>
            <p className="text-sm leading-relaxed font-medium" style={{ color: '#2D1B1B' }}>💡 {dailyIdea.text}</p>
          </FrostCard>
        )}

        {/* ── Dreams Bucket List ───────────────────────────────── */}
        <FrostCard>
          <button
            onClick={() => setDreamsOpen(o => !o)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: '#2D1B1B' }}>Dreams &amp; bucket list</p>
                <p className="text-xs" style={{ color: '#B08585' }}>
                  {localDreams.length === 0
                    ? 'Add your first dream together'
                    : `${doneDreams} of ${localDreams.length} done`}
                </p>
              </div>
            </div>
            {dreamsOpen ? <ChevronUp size={16} style={{ color: '#B08585' }} /> : <ChevronDown size={16} style={{ color: '#B08585' }} />}
          </button>

          {dreamsOpen && (
            <div className="mt-3 space-y-2">
              {localDreams.map(dream => (
                <button
                  key={dream.id}
                  onClick={() => toggleDream(dream)}
                  className="w-full flex items-center gap-2.5 text-left transition-opacity"
                  style={{ opacity: dream.done ? 0.55 : 1 }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                    style={{ borderColor: dream.done ? '#4ECDC4' : '#E0E0E0', background: dream.done ? '#4ECDC4' : 'transparent' }}
                  >
                    {dream.done && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: '#2D1B1B', textDecoration: dream.done ? 'line-through' : 'none' }}
                  >
                    {dream.text}
                  </p>
                </button>
              ))}

              {/* Add new dream */}
              <div className="flex gap-2 mt-3">
                <input
                  value={newDream}
                  onChange={e => setNewDream(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDream()}
                  placeholder="Add a dream…"
                  className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ background: 'rgba(255,235,235,0.6)', color: '#2D1B1B', border: '1.5px solid #FFE5E5' }}
                />
                <button
                  onClick={addDream}
                  disabled={dreamPending || !newDream.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FF6B6B' }}
                >
                  <Plus size={16} color="white" />
                </button>
              </div>
            </div>
          )}
        </FrostCard>

        {/* ── This Week's Moment ───────────────────────────────── */}
        {weekMoment && (
          <Link href="/this-week">
            <FrostCard className="flex items-center gap-3">
              <Sparkles size={20} style={{ color: weekMoment.confirmed ? '#4ECDC4' : '#FFD93D', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#2D1B1B' }}>{weekMoment.idea_text}</p>
                <p className="text-xs" style={{ color: '#B08585' }}>{weekMoment.confirmed ? 'Confirmed ✓' : 'Tap to confirm'}</p>
              </div>
              <span style={{ color: '#B08585' }}>→</span>
            </FrostCard>
          </Link>
        )}

        {/* ── Daily Quote ──────────────────────────────────────── */}
        {quote && (
          <div className="pb-2">
            <p className="text-sm leading-relaxed text-center font-medium px-2" style={{ color: '#7A5C5C', textShadow: '0 1px 6px rgba(255,255,255,0.7)' }}>
              &ldquo;{quote.text}&rdquo;
            </p>
            {quote.author && (
              <p className="text-xs text-center mt-1" style={{ color: '#B08585', textShadow: '0 1px 4px rgba(255,255,255,0.7)' }}>
                — {quote.author}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
