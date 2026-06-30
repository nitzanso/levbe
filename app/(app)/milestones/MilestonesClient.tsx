'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronRight, Check } from 'lucide-react'
import type { MilestoneTrack, MilestoneStatus } from '@/lib/types'
import { nickname, partnerNick } from '@/lib/nicknames'

interface Milestone {
  id: string
  track: MilestoneTrack
  title: string
  definition_of_done: string
  target_date: string | null
  status: MilestoneStatus
  visibility: string
  completed_at: string | null
}

interface Props {
  userEmail: string
  userName: string
  milestones: Milestone[]
}

const tracks: { key: MilestoneTrack; label: string; emoji: string; color: string; bg: string }[] = [
  { key: 'relationship', label: 'Us', emoji: '♡', color: '#FF6B6B', bg: '#FFE5E5' },
  { key: 'wellbeing', label: 'Wellbeing', emoji: '🌿', color: '#4ECDC4', bg: '#E0F7F5' },
  { key: 'germany_prep', label: 'Germany prep', emoji: '🇩🇪', color: '#FFD93D', bg: '#FFF8D6' },
  { key: 'career_israel', label: 'Career (Israel)', emoji: '💼', color: '#B08585', bg: '#F5EDE8' },
  { key: 'contingency', label: 'Contingency', emoji: '🛡️', color: '#7A5C5C', bg: '#F5EDE8' },
]

const statusLabel: Record<MilestoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

export default function MilestonesClient({ userEmail, userName, milestones }: Props) {
  const myNick = nickname(userName)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({ track: 'relationship' as MilestoneTrack, title: '', definition_of_done: '', target_date: '' })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  function toggleTrack(track: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track)
      else next.add(track)
      return next
    })
  }

  async function addMilestone() {
    if (!form.title.trim() || !form.definition_of_done.trim()) return
    startTransition(async () => {
      await supabase.from('milestones').insert({
        track: form.track,
        title: form.title.trim(),
        definition_of_done: form.definition_of_done.trim(),
        target_date: form.target_date || null,
        status: 'not_started',
        visibility: 'default',
      })
      setForm({ track: 'relationship', title: '', definition_of_done: '', target_date: '' })
      setAdding(false)
      router.refresh()
    })
  }

  async function cycleStatus(milestone: Milestone) {
    const next: MilestoneStatus = milestone.status === 'not_started' ? 'in_progress' : milestone.status === 'in_progress' ? 'done' : 'not_started'
    startTransition(async () => {
      await supabase.from('milestones').update({
        status: next,
        completed_at: next === 'done' ? new Date().toISOString() : null,
      }).eq('id', milestone.id)
      if (next === 'done') {
        setSuccessMsg(`Look at you go, ${myNick} 🎉`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
      router.refresh()
    })
  }

  const byTrack = (track: MilestoneTrack) => milestones.filter(m => m.track === track)

  return (
    <div className="pb-6">
      {successMsg && (
        <div
          className="fixed top-4 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
          style={{ transform: 'translateX(-50%)', background: '#FFD93D', color: '#2D1B1B' }}
        >
          {successMsg}
        </div>
      )}
      <PageHeader
        title="Milestones"
        subtitle="The road ahead, together"
        action={
          <button
            onClick={() => setAdding(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#FF6B6B' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* Add form */}
      {adding && (
        <div className="mx-4 mb-4 rounded-2xl p-4 shadow-sm" style={{ background: 'white' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>New milestone</p>

          <div className="space-y-3">
            <select
              value={form.track}
              onChange={e => setForm(f => ({ ...f, track: e.target.value as MilestoneTrack }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B', background: 'white' }}
            >
              {tracks.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
            </select>

            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Milestone title"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            <textarea
              value={form.definition_of_done}
              onChange={e => setForm(f => ({ ...f, definition_of_done: e.target.value }))}
              placeholder="How will we know it's done? (be specific)"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            <input
              type="date"
              value={form.target_date}
              onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#F5EDE8', color: '#7A5C5C' }}
              >
                Cancel
              </button>
              <button
                onClick={addMilestone}
                disabled={isPending || !form.title.trim() || !form.definition_of_done.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#FF6B6B' }}
              >
                {isPending ? 'Adding…' : 'Add milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracks */}
      <div className="px-4 space-y-4">
        {tracks.map(track => {
          const items = byTrack(track.key)
          const done = items.filter(m => m.status === 'done').length
          const isCollapsed = collapsed.has(track.key)

          return (
            <div key={track.key} className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'white' }}>
              <button
                onClick={() => toggleTrack(track.key)}
                className="w-full flex items-center justify-between px-4 py-3.5"
                style={{ background: track.bg }}
              >
                <div className="flex items-center gap-2">
                  <span>{track.emoji}</span>
                  <span className="font-semibold text-sm" style={{ color: track.color }}>{track.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'white', color: track.color }}>
                    {done}/{items.length}
                  </span>
                </div>
                {isCollapsed ? <ChevronRight size={16} style={{ color: track.color }} /> : <ChevronDown size={16} style={{ color: track.color }} />}
              </button>

              {!isCollapsed && (
                <div className="divide-y" style={{ borderColor: '#F5EDE8' }}>
                  {items.length === 0 && (
                    <p className="px-4 py-3 text-sm" style={{ color: '#B08585' }}>Nothing here yet — add your first milestone ✨</p>
                  )}
                  {items.map(m => (
                    <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                      <button
                        onClick={() => cycleStatus(m)}
                        className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                        style={{
                          borderColor: m.status === 'done' ? track.color : m.status === 'in_progress' ? track.color : '#E0E0E0',
                          background: m.status === 'done' ? track.color : 'transparent',
                        }}
                      >
                        {m.status === 'done' && <Check size={11} color="white" strokeWidth={3} />}
                        {m.status === 'in_progress' && <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium leading-snug"
                          style={{ color: m.status === 'done' ? '#B08585' : '#2D1B1B', textDecoration: m.status === 'done' ? 'line-through' : 'none' }}
                        >
                          {m.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>{m.definition_of_done}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: track.bg, color: track.color }}>
                            {statusLabel[m.status]}
                          </span>
                          {m.target_date && (
                            <span className="text-[10px]" style={{ color: '#B08585' }}>
                              by {new Date(m.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
