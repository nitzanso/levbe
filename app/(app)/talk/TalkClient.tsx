'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronRight, Check } from 'lucide-react'

interface DiscussionEntry {
  id: string
  author: string
  text: string
  created_at: string
}

interface Discussion {
  id: string
  title: string
  created_by: string
  status: string
  entries: DiscussionEntry[]
  created_at: string
  resolved_at: string | null
}

interface Props {
  userEmail: string
  discussions: Discussion[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function TalkClient({ userEmail, discussions }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function createDiscussion() {
    if (!newTitle.trim()) return
    startTransition(async () => {
      await supabase.from('discussions').insert({
        title: newTitle.trim(),
        created_by: userEmail,
        status: 'open',
        entries: [],
      })
      setNewTitle('')
      setAdding(false)
      router.refresh()
    })
  }

  async function addEntry(discussion: Discussion) {
    const text = replyText[discussion.id]?.trim()
    if (!text) return
    const newEntry: DiscussionEntry = {
      id: crypto.randomUUID(),
      author: userEmail,
      text,
      created_at: new Date().toISOString(),
    }
    const updatedEntries = [...(discussion.entries ?? []), newEntry]
    startTransition(async () => {
      await supabase.from('discussions').update({ entries: updatedEntries }).eq('id', discussion.id)
      setReplyText(r => ({ ...r, [discussion.id]: '' }))
      router.refresh()
    })
  }

  async function resolve(id: string) {
    startTransition(async () => {
      await supabase.from('discussions').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
      router.refresh()
    })
  }

  const open = discussions.filter(d => d.status === 'open')
  const resolved = discussions.filter(d => d.status === 'resolved')

  return (
    <div className="pb-6">
      <PageHeader
        title="Talk it out"
        subtitle="A space for things that matter"
        action={
          <button
            onClick={() => setAdding(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#FF6B6B' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* New discussion form */}
      {adding && (
        <div className="mx-4 mb-4 rounded-2xl p-4 shadow-sm" style={{ background: 'white' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#2D1B1B' }}>Start a conversation</p>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') createDiscussion() }}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Cancel</button>
            <button onClick={createDiscussion} disabled={isPending || !newTitle.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B6B' }}>Start</button>
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {discussions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-base font-medium" style={{ color: '#7A5C5C' }}>Nothing here yet</p>
            <p className="text-sm mt-1" style={{ color: '#B08585' }}>Start a conversation when something needs addressing ♡</p>
          </div>
        )}

        {open.length > 0 && (
          <>
            <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Open</p>
            {open.map(d => (
              <DiscussionCard
                key={d.id}
                discussion={d}
                userEmail={userEmail}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                replyText={replyText[d.id] ?? ''}
                onReplyChange={t => setReplyText(r => ({ ...r, [d.id]: t }))}
                onReply={() => addEntry(d)}
                onResolve={() => resolve(d.id)}
                isPending={isPending}
              />
            ))}
          </>
        )}

        {resolved.length > 0 && (
          <>
            <p className="text-sm font-semibold mt-2" style={{ color: '#B08585' }}>Resolved</p>
            {resolved.map(d => (
              <DiscussionCard
                key={d.id}
                discussion={d}
                userEmail={userEmail}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                replyText={replyText[d.id] ?? ''}
                onReplyChange={t => setReplyText(r => ({ ...r, [d.id]: t }))}
                onReply={() => addEntry(d)}
                onResolve={() => resolve(d.id)}
                isPending={isPending}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  discussion: Discussion
  userEmail: string
  expanded: boolean
  onToggle: () => void
  replyText: string
  onReplyChange: (t: string) => void
  onReply: () => void
  onResolve: () => void
  isPending: boolean
}

function DiscussionCard({ discussion: d, userEmail, expanded, onToggle, replyText, onReplyChange, onReply, onResolve, isPending }: CardProps) {
  const isResolved = d.status === 'resolved'
  return (
    <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'white' }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="text-left flex-1">
          <p className="text-sm font-semibold" style={{ color: isResolved ? '#B08585' : '#2D1B1B', textDecoration: isResolved ? 'line-through' : 'none' }}>
            {d.title}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#B08585' }}>
            {(d.entries ?? []).length} {(d.entries ?? []).length === 1 ? 'reply' : 'replies'} · {timeAgo(d.created_at)}
          </p>
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: '#B08585' }} /> : <ChevronRight size={16} style={{ color: '#B08585' }} />}
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: '#F5EDE8' }}>
          {/* Entries thread */}
          <div className="px-4 py-3 space-y-3">
            {(d.entries ?? []).length === 0 && (
              <p className="text-sm" style={{ color: '#B08585' }}>No replies yet — add the first one below</p>
            )}
            {(d.entries ?? []).map(entry => {
              const isMe = entry.author === userEmail
              return (
                <div key={entry.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2"
                    style={{
                      background: isMe ? '#FFE5E5' : '#F5EDE8',
                      borderBottomRightRadius: isMe ? '4px' : undefined,
                      borderBottomLeftRadius: !isMe ? '4px' : undefined,
                    }}
                  >
                    <p className="text-sm" style={{ color: '#2D1B1B' }}>{entry.text}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#B08585' }}>
                      {isMe ? 'You' : 'Love'} · {timeAgo(entry.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reply box */}
          {!isResolved && (
            <div className="px-4 pb-4 space-y-2">
              <textarea
                value={replyText}
                onChange={e => onReplyChange(e.target.value)}
                placeholder="Add your thoughts…"
                rows={2}
                className="w-full text-sm resize-none outline-none rounded-xl p-3"
                style={{ background: '#FFFAF7', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={onResolve}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: '#E0F7F5', color: '#4ECDC4' }}
                >
                  <Check size={12} /> Resolved
                </button>
                <button
                  onClick={onReply}
                  disabled={isPending || !replyText.trim()}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#FF6B6B' }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
