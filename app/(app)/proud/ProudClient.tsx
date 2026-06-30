'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, Star } from 'lucide-react'
import { nickname, partnerNick } from '@/lib/nicknames'
import ReactionsBar from '@/components/ReactionsBar'
import CommentThread from '@/components/CommentThread'

interface Achievement {
  id: string
  author: string
  text: string
  created_at: string
  partner_reacted: boolean
}

interface Props {
  userId: string
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

export default function ProudClient({ userId, userEmail, userName, achievements }: Props) {
  const pNick = partnerNick(userName)
  const myNick = nickname(userName)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function addAchievement() {
    if (!text.trim()) return
    startTransition(async () => {
      const { data } = await supabase.from('achievements').insert({
        author: userEmail,
        text: text.trim(),
        partner_reacted: false,
      }).select().single()
      setText('')
      setAdding(false)
      router.refresh()
      setSuccessMsg(`${pNick} is going to be so proud of you 🌟`)
      setTimeout(() => setSuccessMsg(''), 3000)
      if (data) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'activity', activityType: 'achievement', relatedEntity: `achievement:${data.id}` }),
        }).catch(() => {})
      }
    })
  }

  return (
    <div className="pb-6">
      {successMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white"
          style={{ background: '#FFD93D', color: '#2D1B1B' }}>
          {successMsg}
        </div>
      )}

      <PageHeader
        title="Proud of us"
        subtitle="Everything worth celebrating"
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
          <p className="text-sm font-semibold mb-2" style={{ color: '#2D1B1B' }}>Tell {pNick} 🌟</p>
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
              {isPending ? 'Sharing…' : 'Share it ⭐'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {achievements.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-base font-medium" style={{ color: '#7A5C5C' }}>Nothing here yet</p>
            <p className="text-sm mt-1" style={{ color: '#B08585' }}>
              What&apos;s something small you did today that made you proud? Tell {pNick} 🌟
            </p>
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
                  <p className="text-[10px] mt-1" style={{ color: '#B08585' }}>
                    {isPartner ? pNick : myNick} · {timeAgo(a.created_at)}
                  </p>
                  <div className="mt-2 space-y-1">
                    <ReactionsBar entityType="achievement" entityId={a.id} userId={userId} />
                    <CommentThread entityType="achievement" entityId={a.id} userId={userId} myNick={myNick} partnerNick={pNick} />
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
