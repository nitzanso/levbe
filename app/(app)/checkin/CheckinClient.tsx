'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { createClient } from '@/lib/supabase/client'

interface CheckIn {
  author: string
  date: string
  mood: number
  note: string | null
}

interface Props {
  userEmail: string
  userName: string
  myCheckin: CheckIn | null
  partnerCheckin: CheckIn | null
  recentCheckins: CheckIn[]
  today: string
}

const moods = [
  { value: 1, emoji: '😔', label: 'Struggling' },
  { value: 2, emoji: '😕', label: 'A bit low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]

export default function CheckinClient({ userEmail, myCheckin, partnerCheckin, recentCheckins, today }: Props) {
  const [selectedMood, setSelectedMood] = useState<number | null>(myCheckin?.mood ?? null)
  const [note, setNote] = useState(myCheckin?.note ?? '')
  const [saved, setSaved] = useState(!!myCheckin)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function handleSave() {
    if (!selectedMood) return
    startTransition(async () => {
      if (myCheckin) {
        await supabase.from('checkins')
          .update({ mood: selectedMood, note: note || null })
          .eq('author', userEmail)
          .eq('date', today)
      } else {
        await supabase.from('checkins')
          .insert({ author: userEmail, date: today, mood: selectedMood, note: note || null })
      }
      setSaved(true)
      router.refresh()
    })
  }

  function formatDateLabel(dateStr: string) {
    if (dateStr === today) return 'Today'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Group recent check-ins by date
  const byDate: Record<string, CheckIn[]> = {}
  for (const c of recentCheckins) {
    if (!byDate[c.date]) byDate[c.date] = []
    byDate[c.date].push(c)
  }

  return (
    <div className="pb-6">
      <PageHeader title="Check in" subtitle="How are you today?" />

      <div className="px-4 space-y-4">
        {/* My mood selector */}
        <Card accent="coral">
          <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Your mood right now</p>
          <div className="flex justify-between">
            {moods.map(m => (
              <button
                key={m.value}
                onClick={() => { setSelectedMood(m.value); setSaved(false) }}
                className="flex flex-col items-center gap-1 transition-transform"
                style={{ transform: selectedMood === m.value ? 'scale(1.2)' : 'scale(1)' }}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="text-[10px]" style={{ color: selectedMood === m.value ? '#FF6B6B' : '#B08585' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Optional note */}
        <Card>
          <p className="text-sm font-medium mb-2" style={{ color: '#7A5C5C' }}>Add a note (optional)</p>
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); setSaved(false) }}
            placeholder="Anything on your mind today…"
            rows={3}
            className="w-full text-sm resize-none outline-none rounded-xl p-3"
            style={{ background: '#FFFAF7', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
          />
        </Card>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!selectedMood || isPending}
          className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all"
          style={{ background: saved ? '#4ECDC4' : (!selectedMood ? '#E0E0E0' : '#FF6B6B'), color: !selectedMood ? '#B08585' : 'white' }}
        >
          {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save check-in'}
        </button>

        {/* Partner's check-in */}
        {partnerCheckin && (
          <Card accent="teal">
            <p className="text-xs mb-2 font-medium" style={{ color: '#B08585' }}>Your love today</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{moods.find(m => m.value === partnerCheckin.mood)?.emoji}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>{moods.find(m => m.value === partnerCheckin.mood)?.label}</p>
                {partnerCheckin.note && <p className="text-sm mt-1" style={{ color: '#7A5C5C' }}>{partnerCheckin.note}</p>}
              </div>
            </div>
          </Card>
        )}

        {/* Last 7 days */}
        {Object.keys(byDate).length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Last 7 days</p>
            <div className="space-y-2">
              {Object.entries(byDate).map(([date, checkins]) => (
                <div key={date} className="rounded-2xl p-3" style={{ background: 'white' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#B08585' }}>{formatDateLabel(date)}</p>
                  <div className="flex gap-4">
                    {checkins.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-xl">{moods.find(m => m.value === c.mood)?.emoji}</span>
                        <span className="text-xs" style={{ color: '#7A5C5C' }}>
                          {c.author === userEmail ? 'You' : 'Love'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
