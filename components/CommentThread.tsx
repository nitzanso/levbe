'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle } from 'lucide-react'
import type { EntityType } from './ReactionsBar'

interface Comment {
  id: string
  author: string
  text: string
  created_at: string
}

interface Props {
  entityType: EntityType
  entityId: string
  userId: string
  myNick: string
  partnerNick: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CommentThread({ entityType, entityId, userId, myNick, partnerNick }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('comments')
      .select('id, author, text, created_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setComments(data) })
  }, [entityId, entityType]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleOpen() {
    setOpen(v => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 80)
      return !v
    })
  }

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const optimistic: Comment = { id: `temp-${Date.now()}`, author: userId, text: trimmed, created_at: new Date().toISOString() }
    setComments(prev => [...prev, optimistic])
    setText('')

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, text: trimmed }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.comment) {
        setComments(prev => prev.map(c => c.id === optimistic.id ? data.comment : c))
      }
    }
    setSubmitting(false)
  }

  return (
    <div>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-1 text-[11px] font-medium mt-1"
        style={{ color: '#B08585' }}
      >
        <MessageCircle size={11} />
        {comments.length > 0
          ? `${comments.length} comment${comments.length === 1 ? '' : 's'}`
          : '💬 Add a comment'}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {comments.map(c => (
            <div key={c.id} className="rounded-xl px-3 py-1.5" style={{ background: '#F5EDE8' }}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold" style={{ color: '#7A5C5C' }}>
                  {c.author === userId ? myNick : partnerNick}
                </span>
                <span className="text-[10px]" style={{ color: '#B08585' }}>{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-sm" style={{ color: '#2D1B1B' }}>{c.text}</p>
            </div>
          ))}
          <div className="flex gap-2 items-center pt-0.5">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Say something…"
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none"
              style={{ background: '#FFFAF7', border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />
            <button
              onClick={submit}
              disabled={!text.trim() || submitting}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
              style={{ background: text.trim() ? '#FF6B6B' : '#E0E0E0' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
