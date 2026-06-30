'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, MapPin, Check } from 'lucide-react'

interface Visit {
  id: string
  status: string
  traveler: string
  start_date: string
  end_date: string | null
  notes: string | null
  proposed_by: string
}

interface Props {
  userEmail: string
  userName: string
  visits: Visit[]
}

function formatDateRange(start: string, end: string | null) {
  const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  if (!end) return s
  const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return `${s} – ${e}`
}

function daysUntil(dateStr: string) {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const d = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (d < 0) return `${Math.abs(d)} days ago`
  if (d === 0) return 'Today!'
  return `${d} days away`
}

export default function VisitsClient({ userEmail, visits }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ traveler: '', start_date: '', end_date: '', notes: '', status: 'proposed' as 'proposed' | 'confirmed' })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]
  const upcoming = visits.filter(v => v.start_date >= today)
  const past = visits.filter(v => v.start_date < today)

  async function addVisit() {
    if (!form.traveler.trim() || !form.start_date) return
    startTransition(async () => {
      await supabase.from('visits').insert({
        traveler: form.traveler.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes || null,
        status: form.status,
        proposed_by: userEmail,
      })
      setForm({ traveler: '', start_date: '', end_date: '', notes: '', status: 'proposed' })
      setAdding(false)
      router.refresh()
    })
  }

  async function confirmVisit(id: string) {
    startTransition(async () => {
      await supabase.from('visits').update({ status: 'confirmed' }).eq('id', id)
      router.refresh()
    })
  }

  function VisitCard({ visit }: { visit: Visit }) {
    const isUpcoming = visit.start_date >= today
    const isConfirmed = visit.status === 'confirmed'
    const isMyProposal = visit.proposed_by === userEmail

    return (
      <div
        className="rounded-2xl p-4 shadow-sm"
        style={{
          background: 'white',
          borderLeft: `4px solid ${isConfirmed ? '#4ECDC4' : '#FFD93D'}`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} style={{ color: isConfirmed ? '#4ECDC4' : '#FFD93D' }} />
              <span className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>{visit.traveler}</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: isConfirmed ? '#E0F7F5' : '#FFF8D6',
                  color: isConfirmed ? '#4ECDC4' : '#B08585',
                }}
              >
                {isConfirmed ? '✓ Confirmed' : 'Proposed'}
              </span>
            </div>
            <p className="text-sm" style={{ color: '#7A5C5C' }}>{formatDateRange(visit.start_date, visit.end_date)}</p>
            {isUpcoming && (
              <p className="text-xs mt-1" style={{ color: '#B08585' }}>{daysUntil(visit.start_date)}</p>
            )}
            {visit.notes && (
              <p className="text-xs mt-2 italic" style={{ color: '#B08585' }}>{visit.notes}</p>
            )}
          </div>

          {!isConfirmed && !isMyProposal && isUpcoming && (
            <button
              onClick={() => confirmVisit(visit.id)}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white ml-3"
              style={{ background: '#4ECDC4' }}
            >
              <Check size={12} /> Confirm
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Visits"
        subtitle="When we&apos;re in the same place"
        action={
          <button
            onClick={() => setAdding(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#4ECDC4' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* Add form */}
      {adding && (
        <div className="mx-4 mb-4 rounded-2xl p-4 shadow-sm" style={{ background: 'white' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Propose a visit</p>
          <div className="space-y-3">
            <input
              value={form.traveler}
              onChange={e => setForm(f => ({ ...f, traveler: e.target.value }))}
              placeholder="Who's travelling? (e.g. Nitzan, Jens)"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#B08585' }}>From</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#B08585' }}>To (optional)</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                />
              </div>
            </div>

            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, status: 'proposed' }))}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: form.status === 'proposed' ? '#FFD93D' : '#F5EDE8', color: form.status === 'proposed' ? '#2D1B1B' : '#7A5C5C' }}
              >
                Proposed
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, status: 'confirmed' }))}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: form.status === 'confirmed' ? '#4ECDC4' : '#F5EDE8', color: form.status === 'confirmed' ? 'white' : '#7A5C5C' }}
              >
                Confirmed
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Cancel</button>
              <button onClick={addVisit} disabled={isPending || !form.traveler.trim() || !form.start_date} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#4ECDC4' }}>
                {isPending ? 'Adding…' : 'Add visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 space-y-4">
        {upcoming.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: '#2D1B1B' }}>Upcoming</p>
            <div className="space-y-3">
              {upcoming.map(v => <VisitCard key={v.id} visit={v} />)}
            </div>
          </div>
        )}

        {upcoming.length === 0 && (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">✈️</p>
            <p className="text-base font-medium" style={{ color: '#7A5C5C' }}>No visits planned yet</p>
            <p className="text-sm mt-1" style={{ color: '#B08585' }}>Tap + to add one ♡</p>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3 mt-4" style={{ color: '#B08585' }}>Past visits</p>
            <div className="space-y-3">
              {past.map(v => <VisitCard key={v.id} visit={v} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
