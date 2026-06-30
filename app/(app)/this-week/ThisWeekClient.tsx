'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { createClient } from '@/lib/supabase/client'
import { Shuffle, Plus, Check } from 'lucide-react'
import { partnerNick } from '@/lib/nicknames'

interface Moment {
  id: string
  week_start_date: string
  idea_text: string
  proposed_by: string
  confirmed: boolean
  date_time: string | null
}

interface IdeaItem {
  id: string
  idea_text: string
  category: string
  added_by: string
}

interface Props {
  userEmail: string
  userName: string
  currentMoment: Moment | null
  ideaBank: IdeaItem[]
  pastMoments: Moment[]
  weekStartStr: string
}

const categoryEmoji: Record<string, string> = {
  activity: '🎯',
  question: '💬',
  ritual: '✨',
}

export default function ThisWeekClient({ userEmail, userName, currentMoment, ideaBank, pastMoments, weekStartStr }: Props) {
  const pNick = partnerNick(userName)
  const [tab, setTab] = useState<'this-week' | 'bank'>('this-week')
  const [proposedIdea, setProposedIdea] = useState('')
  const [freeform, setFreeform] = useState('')
  const [addingIdea, setAddingIdea] = useState(false)
  const [newIdea, setNewIdea] = useState({ text: '', category: 'activity' })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  function pickRandom() {
    if (ideaBank.length === 0) return
    const random = ideaBank[Math.floor(Math.random() * ideaBank.length)]
    setProposedIdea(random.id)
    setFreeform(random.idea_text)
  }

  async function propose(ideaText: string, ideaBankId: string | null) {
    if (!ideaText.trim()) return
    startTransition(async () => {
      await supabase.from('weekly_moments').insert({
        week_start_date: weekStartStr,
        idea_text: ideaText.trim(),
        proposed_by: userEmail,
        source: ideaBankId ? 'idea_bank' : 'freeform',
        idea_bank_id: ideaBankId,
        confirmed: false,
      })
      setFreeform('')
      setProposedIdea('')
      router.refresh()
    })
  }

  async function confirm(momentId: string) {
    startTransition(async () => {
      await supabase.from('weekly_moments').update({ confirmed: true }).eq('id', momentId)
      router.refresh()
    })
  }

  async function addToBank() {
    if (!newIdea.text.trim()) return
    startTransition(async () => {
      await supabase.from('idea_bank').insert({
        idea_text: newIdea.text.trim(),
        category: newIdea.category,
        added_by: userEmail,
      })
      setNewIdea({ text: '', category: 'activity' })
      setAddingIdea(false)
      router.refresh()
    })
  }

  const myProposal = currentMoment?.proposed_by === userEmail
  const theirProposal = currentMoment && !myProposal

  return (
    <div className="pb-6">
      <PageHeader title="This week" subtitle="One shared moment together" />

      {/* Tabs */}
      <div className="px-4 mb-4 flex gap-2">
        {(['this-week', 'bank'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-full text-sm font-medium transition-colors"
            style={{
              background: tab === t ? '#FF6B6B' : '#F5EDE8',
              color: tab === t ? 'white' : '#7A5C5C',
            }}
          >
            {t === 'this-week' ? 'This week' : 'Idea bank'}
          </button>
        ))}
      </div>

      {tab === 'this-week' && (
        <div className="px-4 space-y-4">
          {/* Current moment */}
          {currentMoment ? (
            <div className="rounded-3xl p-5" style={{ background: currentMoment.confirmed ? 'linear-gradient(135deg, #E0F7F5, #FFF8D6)' : 'linear-gradient(135deg, #FFE5E5, #FFF8D6)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B08585' }}>
                {currentMoment.confirmed ? '✓ Confirmed this week' : 'Proposed this week'}
              </div>
              <p className="text-lg font-semibold leading-snug mb-3" style={{ color: '#2D1B1B' }}>
                {currentMoment.idea_text}
              </p>

              {theirProposal && !currentMoment.confirmed && (
                <button
                  onClick={() => confirm(currentMoment.id)}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                  style={{ background: '#4ECDC4' }}
                >
                  <Check size={14} /> Yes, I&apos;m in!
                </button>
              )}
              {myProposal && !currentMoment.confirmed && (
                <p className="text-sm" style={{ color: '#B08585' }}>Waiting for {pNick}&apos;s answer…</p>
              )}
            </div>
          ) : (
            <div className="rounded-3xl p-5" style={{ background: '#F5EDE8' }}>
              <p className="text-base font-medium mb-1" style={{ color: '#7A5C5C' }}>No plan yet for this week</p>
              <p className="text-sm" style={{ color: '#B08585' }}>Propose something fun for you and {pNick} ✨</p>
            </div>
          )}

          {/* Propose something */}
          {!currentMoment && (
            <Card>
              <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Propose this week&apos;s moment</p>

              <button
                onClick={pickRandom}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 mb-3"
                style={{ background: '#FFF8D6', color: '#7A5C5C' }}
              >
                <Shuffle size={14} /> Pick a random idea
              </button>

              <textarea
                value={freeform}
                onChange={e => { setFreeform(e.target.value); setProposedIdea('') }}
                placeholder="Or write your own…"
                rows={2}
                className="w-full text-sm resize-none outline-none rounded-xl p-3"
                style={{ background: '#FFFAF7', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
              />

              <button
                onClick={() => propose(freeform, proposedIdea || null)}
                disabled={isPending || !freeform.trim()}
                className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#FF6B6B' }}
              >
                {isPending ? 'Proposing…' : 'Propose it ♡'}
              </button>
            </Card>
          )}

          {/* Past moments */}
          {pastMoments.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Past weeks</p>
              <div className="space-y-2">
                {pastMoments.map(m => (
                  <div key={m.id} className="flex items-start gap-2 py-2.5 px-3 rounded-xl" style={{ background: 'white' }}>
                    <span style={{ color: m.confirmed ? '#4ECDC4' : '#B08585' }}>{m.confirmed ? '✓' : '○'}</span>
                    <div>
                      <p className="text-sm" style={{ color: '#2D1B1B' }}>{m.idea_text}</p>
                      <p className="text-[10px]" style={{ color: '#B08585' }}>
                        Week of {new Date(m.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'bank' && (
        <div className="px-4 space-y-3">
          <button
            onClick={() => setAddingIdea(v => !v)}
            className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
            style={{ background: '#FFE5E5', color: '#FF6B6B' }}
          >
            <Plus size={14} /> Add an idea
          </button>

          {addingIdea && (
            <Card>
              <select
                value={newIdea.category}
                onChange={e => setNewIdea(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-2"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B', background: 'white' }}
              >
                <option value="activity">🎯 Activity</option>
                <option value="question">💬 Question</option>
                <option value="ritual">✨ Ritual</option>
              </select>
              <textarea
                value={newIdea.text}
                onChange={e => setNewIdea(f => ({ ...f, text: e.target.value }))}
                placeholder="Describe the idea…"
                rows={2}
                className="w-full text-sm resize-none outline-none rounded-xl p-3"
                style={{ background: '#FFFAF7', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setAddingIdea(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Cancel</button>
                <button onClick={addToBank} disabled={isPending || !newIdea.text.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B6B' }}>Add</button>
              </div>
            </Card>
          )}

          {ideaBank.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">💡</p>
              <p className="text-sm" style={{ color: '#B08585' }}>No ideas yet — add some above</p>
            </div>
          )}

          {ideaBank.map(idea => (
            <div key={idea.id} className="rounded-2xl p-3.5 shadow-sm" style={{ background: 'white' }}>
              <div className="flex items-start gap-2">
                <span>{categoryEmoji[idea.category] ?? '•'}</span>
                <div>
                  <p className="text-sm" style={{ color: '#2D1B1B' }}>{idea.idea_text}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#B08585' }}>{idea.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
