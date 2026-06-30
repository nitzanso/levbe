'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, Star, Heart } from 'lucide-react'

interface Achievement {
  id: string
  author: string
  text: string
  created_at: string
  partner_reacted: boolean
}

interface Props {
  userEmail: string
  userName: string
  achievements: Achievement[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export default function ProudClient({ userEmail, achievements }: Props) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function addAchievement() {
    if (!text.trim()) return
    startTransition(async () => {
      await supabase.from('achievements').insert({
        author: userEmail,
        text: text.trim(),
        partner_reacted: false,
      })
      setText('')
      setAdding(false)
      router.refresh()
    })
  }

  async function react(achievement: Achievement) {
    if (achievement.author === userEmail) return
    startTransition(async () => {
      await supabase.from('achievements').update({ partner_reacted: true }).eq('id', achievement.id)
      router.refresh()
    })
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Proud of us"
        subtitle="Everything you've celebrated"
        action={
          <button
            onClick={() => setAdding(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#FFD93D' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* Add form */}
      {adding && (
        <div className="mx-4 mb-4 rounded-2xl p-4 shadow-sm" style={{ background: 'white' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#2D1B1B' }}>What are you proud of?</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="We figured out how to cook together over video call. We showed up for each other last Tuesday. We had a hard conversation and came out closer."
            rows={3}
            className="w-full text-sm resize-none outline-none rounded-xl p-3"
            style={{ background: '#FFFAF7', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setAdding(false); setText('') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#F5EDE8', color: '#7A5C5C' }}
            >
              Cancel
            </button>
            <button
              onClick={addAchievement}
              disabled={isPending || !text.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#FFD93D' }}
            >
              {isPending ? 'Adding…' : 'Add ⭐'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {achievements.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-base font-medium" style={{ color: '#7A5C5C' }}>Nothing here yet</p>
            <p className="text-sm mt-1" style={{ color: '#B08585' }}>Add the first thing you&apos;re proud of ♡</p>
          </div>
        )}

        {achievements.map(a => {
          const isPartner = a.author !== userEmail
          return (
            <div
              key={a.id}
              className="rounded-2xl p-4 shadow-sm"
              style={{ background: 'white', borderLeft: `4px solid #FFD93D` }}
            >
              <div className="flex items-start gap-3">
                <Star size={16} className="mt-0.5 flex-shrink-0" fill="#FFD93D" style={{ color: '#FFD93D' }} />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed" style={{ color: '#2D1B1B' }}>{a.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px]" style={{ color: '#B08585' }}>
                      {isPartner ? 'Love' : 'You'} · {timeAgo(a.created_at)}
                    </span>
                    {isPartner && !a.partner_reacted && (
                      <button
                        onClick={() => react(a)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                        style={{ background: '#FFE5E5', color: '#FF6B6B' }}
                      >
                        <Heart size={10} /> Heart
                      </button>
                    )}
                    {a.partner_reacted && isPartner && (
                      <span className="text-xs" style={{ color: '#FF6B6B' }}>♡ hearted</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
