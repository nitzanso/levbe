'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type EntityType = 'photo' | 'note' | 'achievement' | 'checkin' | 'day_entry'

export const EMOJIS = ['🤍', '😍', '🥹', '🔥', '👏', '😂']

interface Reaction {
  id: string
  author: string
  emoji: string
}

interface Props {
  entityType: EntityType
  entityId: string
  userId: string
}

export default function ReactionsBar({ entityType, entityId, userId }: Props) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('reactions')
      .select('id, author, emoji')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .then(({ data }) => { if (data) setReactions(data) })
  }, [entityId, entityType]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(emoji: string) {
    const mine = reactions.find(r => r.author === userId && r.emoji === emoji)

    if (mine) {
      setReactions(prev => prev.filter(r => r.id !== mine.id))
    } else {
      const temp: Reaction = { id: `temp-${Date.now()}`, author: userId, emoji }
      setReactions(prev => [...prev, temp])
    }

    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, emoji }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.action === 'added' && data.reaction) {
        setReactions(prev =>
          prev.map(r => r.id.startsWith('temp-') && r.emoji === emoji ? data.reaction : r)
        )
      } else if (data.action === 'removed') {
        // already removed optimistically, nothing to do
      }
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[Levbe] reaction failed:', err.error ?? res.status, '— Have you run supabase-reactions.sql?')
      // Revert optimistic update
      const { data } = await supabase
        .from('reactions')
        .select('id, author, emoji')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      if (data) setReactions(data)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EMOJIS.map(emoji => {
        const count = reactions.filter(r => r.emoji === emoji).length
        const mine = reactions.some(r => r.author === userId && r.emoji === emoji)
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className="flex items-center gap-0.5 px-2 py-1 rounded-full text-sm transition-all"
            style={{
              background: mine ? '#FFE5E5' : '#F5EDE8',
              border: `1.5px solid ${mine ? '#FF6B6B40' : 'transparent'}`,
            }}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: mine ? '#FF6B6B' : '#B08585' }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
