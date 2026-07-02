'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nickname, partnerNick } from '@/lib/nicknames'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Check, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab = 'all' | 'tasks' | 'visits' | 'milestones' | 'dreams'
type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

interface Task {
  id: string; title: string; description: string | null; status: TaskStatus
  assignee: string | null; due_date: string | null; tags: string[]
  depends_on: string[]; created_by: string; created_at: string; updated_at: string
}
interface Visit {
  id: string; status: string; traveler: string
  start_date: string; end_date: string | null; notes: string | null; proposed_by: string
}
interface Milestone {
  id: string; track: string; title: string; definition_of_done: string
  target_date: string | null; status: string
}
interface Dream {
  id: string; text: string; done: boolean; done_at: string | null
  author: string; created_at: string
}
interface Profile { id: string; name: string; avatar_color: string; email: string | null }
interface Moment {
  id: string; week_start_date: string; idea_text: string
  proposed_by: string; confirmed: boolean; date_time: string | null
}
interface RecurringEvent {
  id: string; title: string; recurrence: string; days_of_week: number[]
  time: string | null; color: string; active: boolean
}
interface OneOffEvent {
  id: string; title: string; date: string; time: string | null; color: string
}

interface Props {
  userId: string; userEmail: string; userName: string; userColor: string
  profiles: Profile[]; tasks: Task[]; visits: Visit[]
  milestones: Milestone[]; dreams: Dream[]; moments: Moment[]
  recurringEvents: RecurringEvent[]; oneOffEvents: OneOffEvent[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  relationship:  { label: 'Relationship',  color: '#FF6B6B', bg: '#FFE5E5', emoji: '🩷' },
  wellbeing:     { label: 'Wellbeing',     color: '#4ECDC4', bg: '#E0F7F5', emoji: '🌿' },
  germany_prep:  { label: 'Germany Prep',  color: '#5B8DEF', bg: '#E8EDFF', emoji: '🇩🇪' },
  career_israel: { label: 'Career',        color: '#E5A800', bg: '#FFF8D6', emoji: '💼' },
  contingency:   { label: 'Contingency',   color: '#7A5C5C', bg: '#EEEAEA', emoji: '🛡️' },
}

const KANBAN_COLS: { status: TaskStatus; label: string; color: string; bg: string }[] = [
  { status: 'backlog',     label: 'Backlog',      color: '#B08585', bg: '#F5EDE8' },
  { status: 'todo',        label: 'To do',        color: '#7A5C5C', bg: '#EDE0DB' },
  { status: 'in_progress', label: 'In progress',  color: '#FF6B6B', bg: '#FFE5E5' },
  { status: 'done',        label: 'Done',         color: '#4ECDC4', bg: '#E0F7F5' },
]

const TAG_PALETTES = [
  { bg: '#FFE5E5', text: '#C94040' }, { bg: '#E0F7F5', text: '#2BA99C' },
  { bg: '#FFF8D6', text: '#B59100' }, { bg: '#F5EDE8', text: '#7A5C5C' },
  { bg: '#E8EDFF', text: '#4A5FA5' },
]
function tagColor(tag: string) {
  const h = [...tag].reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_PALETTES[h % TAG_PALETTES.length]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(year, month, 1 - offset + w * 7 + d))
  )
}
function fmtDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function daysUntil(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const diff = Math.round((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'Today!'
  if (diff > 0) return `in ${diff} day${diff === 1 ? '' : 's'} 🛫`
  return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`
}
function isOverdue(s: string | null) {
  if (!s) return false
  return new Date(s).getTime() < Date.now() - 86400000
}

// ─── Day popup ────────────────────────────────────────────────────────────────

function DayPopup({ dateStr, tasks, visits, milestones, moments, recurringEvents, oneOffEvents, onClose, onSwitchTab }: {
  dateStr: string; tasks: Task[]; visits: Visit[]; milestones: Milestone[]
  moments: Moment[]; recurringEvents: RecurringEvent[]; oneOffEvents: OneOffEvent[]
  onClose: () => void; onSwitchTab: (t: SubTab) => void
}) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(y, mo - 1, d)
  const headerLabel = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const dow = dateObj.getDay()

  const dayTasks      = tasks.filter(t => t.due_date === dateStr && t.status !== 'done')
  const dayVisits     = visits.filter(v => v.start_date <= dateStr && (v.end_date ?? v.start_date) >= dateStr)
  const dayMilestones = milestones.filter(m => m.target_date === dateStr)
  const dayMoments    = moments.filter(m => m.date_time?.startsWith(dateStr))
  const dayOneOff     = oneOffEvents.filter(e => e.date === dateStr)
  const dayRecurring  = recurringEvents.filter(re =>
    re.recurrence === 'daily' || ((re.recurrence === 'weekly' || re.recurrence === 'custom') && re.days_of_week.includes(dow))
  )
  const totalItems = dayTasks.length + dayVisits.length + dayMilestones.length + dayMoments.length + dayOneOff.length + dayRecurring.length

  return (
    <>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(45,27,27,0.45)' }}
        onClick={onClose}>
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: '#FFFAF7', animation: 'popIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: '1px solid #F5EDE8' }}>
            <h2 className="text-base font-bold" style={{ color: '#2D1B1B' }}>{headerLabel}</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#F5EDE8' }}>
              <X size={15} style={{ color: '#7A5C5C' }} />
            </button>
          </div>

          {/* Items */}
          <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '55vh' }}>
            {totalItems === 0 && (
              <div className="text-center py-10 px-6">
                <p className="text-sm font-medium mb-1" style={{ color: '#2D1B1B' }}>Nothing planned for this day ✨</p>
                <p className="text-xs" style={{ color: '#B08585' }}>Add something to make it count.</p>
              </div>
            )}

            {dayTasks.length > 0 && (
              <div className="px-5 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#FF6B6B' }}>Tasks due</p>
                {dayTasks.map(t => (
                  <button key={t.id} onClick={() => onSwitchTab('tasks')}
                    className="flex items-center gap-3 w-full text-left py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#FF6B6B' }} />
                    <p className="flex-1 text-sm truncate" style={{ color: '#2D1B1B' }}>{t.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-xl flex-shrink-0"
                      style={{ background: '#FFE5E5', color: '#FF6B6B' }}>{t.status.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}

            {dayVisits.length > 0 && (
              <div className="px-5 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#5B8DEF' }}>Visits</p>
                {dayVisits.map(v => (
                  <button key={v.id} onClick={() => onSwitchTab('visits')}
                    className="flex items-center gap-3 w-full text-left py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#5B8DEF' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: '#2D1B1B' }}>✈️ {v.traveler}</p>
                      <p className="text-[10px]" style={{ color: '#B08585' }}>
                        {fmtDate(v.start_date)}{v.end_date && v.end_date !== v.start_date ? ` – ${fmtDate(v.end_date)}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-xl flex-shrink-0"
                      style={{ background: v.status === 'confirmed' ? '#E0F7F5' : '#FFF8D6', color: v.status === 'confirmed' ? '#2BA99C' : '#B59100' }}>
                      {v.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {dayMilestones.length > 0 && (
              <div className="px-5 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#A078C8' }}>Milestones</p>
                {dayMilestones.map(m => (
                  <button key={m.id} onClick={() => onSwitchTab('milestones')}
                    className="flex items-center gap-3 w-full text-left py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#A078C8' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: '#2D1B1B' }}>{m.title}</p>
                      <p className="text-[10px]" style={{ color: '#B08585' }}>
                        {TRACK_META[m.track]?.emoji} {TRACK_META[m.track]?.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {dayMoments.length > 0 && (
              <div className="px-5 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#E5A800' }}>Date night</p>
                {dayMoments.map(m => (
                  <div key={m.id} className="flex items-center gap-3 py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E5A800' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: '#2D1B1B' }}>🌙 {m.idea_text || 'Date night'}</p>
                      {m.date_time && (
                        <p className="text-[10px]" style={{ color: '#B08585' }}>
                          {new Date(m.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dayOneOff.length > 0 && (
              <div className="px-5 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#7A5C5C' }}>Events</p>
                {dayOneOff.map(e => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: '#2D1B1B' }}>{e.title}</p>
                      {e.time && <p className="text-[10px]" style={{ color: '#B08585' }}>{e.time}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dayRecurring.length > 0 && (
              <div className="px-5 pt-3 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#7A5C5C' }}>Recurring</p>
                {dayRecurring.map(re => (
                  <div key={re.id} className="flex items-center gap-3 py-2.5"
                    style={{ borderBottom: '1px solid #F5EDE8' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: re.color }} />
                    <p className="flex-1 text-sm truncate" style={{ color: '#2D1B1B' }}>{re.title}</p>
                    {re.time && <p className="text-[10px] flex-shrink-0" style={{ color: '#B08585' }}>{re.time}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3" style={{ borderTop: '1px solid #F5EDE8' }}>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: '#FF6B6B' }}>
              + Add something to this day
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({ anchor, tasks, visits, milestones, recurringEvents, oneOffEvents, moments, onClose, onSwitchTab }: {
  anchor: Date; tasks: Task[]; visits: Visit[]; milestones: Milestone[]
  recurringEvents: RecurringEvent[]; oneOffEvents: OneOffEvent[]; moments: Moment[]
  onClose: () => void; onSwitchTab: (t: SubTab) => void
}) {
  const [month, setMonth] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const today = localStr(new Date())
  const grid = useMemo(() => getMonthGrid(month.getFullYear(), month.getMonth()), [month])
  const monthPfx = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  type Pill = { color: string; bg: string; label: string }

  function pillsForDay(d: string): Pill[] {
    const pills: Pill[] = []
    const parts = d.split('-').map(Number)
    const dow = new Date(parts[0], parts[1] - 1, parts[2]).getDay()

    tasks.filter(t => t.due_date === d && t.status !== 'done').forEach(t =>
      pills.push({ color: '#C94040', bg: '#FFE5E5', label: t.title }))
    visits.filter(v => v.start_date <= d && (v.end_date ?? v.start_date) >= d).forEach(v =>
      pills.push({ color: '#4A5FA5', bg: '#E8EDFF', label: `✈️ ${v.traveler}` }))
    milestones.filter(m => m.target_date === d).forEach(m =>
      pills.push({ color: '#7B55A5', bg: '#F0E8FF', label: m.title }))
    recurringEvents.filter(re =>
      re.recurrence === 'daily' || ((re.recurrence === 'weekly' || re.recurrence === 'custom') && re.days_of_week.includes(dow))
    ).forEach(re => pills.push({ color: re.color, bg: re.color + '28', label: re.title }))
    oneOffEvents.filter(e => e.date === d).forEach(e =>
      pills.push({ color: e.color, bg: e.color + '28', label: e.title }))
    moments.filter(m => m.date_time?.startsWith(d)).forEach(() =>
      pills.push({ color: '#B59100', bg: '#FFF8D6', label: '🌙 Date night' }))
    return pills
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#FFFAF7' }}>
      {/* Nav bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #F5EDE8' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F5EDE8' }}>
            <ChevronLeft size={16} style={{ color: '#7A5C5C' }} />
          </button>
          <span className="font-bold text-sm" style={{ color: '#2D1B1B', minWidth: 156, textAlign: 'center', display: 'inline-block' }}>
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F5EDE8' }}>
            <ChevronRight size={16} style={{ color: '#7A5C5C' }} />
          </button>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Board view</button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 pt-1">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="text-center py-1.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: '#B08585' }}>{wd}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex flex-col gap-0.5">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5">
              {week.map((day, di) => {
                const d = localStr(day)
                const inMonth = d.startsWith(monthPfx)
                const isToday = d === today
                const pills = pillsForDay(d)
                const VISIBLE = 2
                return (
                  <button key={di}
                    onClick={() => setSelectedDay(d)}
                    className="flex flex-col rounded-xl p-1 text-left transition-colors"
                    style={{
                      minHeight: 80,
                      opacity: inMonth ? 1 : 0.28,
                      background: 'transparent',
                    }}
                    onMouseEnter={e => { if (inMonth) (e.currentTarget as HTMLElement).style.background = '#F5EDE8' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    {/* Day number */}
                    <div className="flex mb-1">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#FF6B6B' }}>
                          {day.getDate()}
                        </span>
                      ) : (
                        <span className="w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0"
                          style={{ color: '#2D1B1B' }}>
                          {day.getDate()}
                        </span>
                      )}
                    </div>
                    {/* Pills */}
                    <div className="flex flex-col gap-0.5 w-full flex-1">
                      {pills.slice(0, VISIBLE).map((p, i) => (
                        <div key={i} className="w-full rounded-md px-1 py-0.5 overflow-hidden"
                          style={{ background: p.bg }}>
                          <p className="text-[9px] font-semibold leading-tight truncate"
                            style={{ color: p.color }}>{p.label}</p>
                        </div>
                      ))}
                      {pills.length > VISIBLE && (
                        <p className="text-[9px] font-medium pl-0.5" style={{ color: '#B08585' }}>
                          +{pills.length - VISIBLE} more
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day popup */}
      {selectedDay && (
        <DayPopup
          dateStr={selectedDay}
          tasks={tasks} visits={visits} milestones={milestones}
          moments={moments} recurringEvents={recurringEvents} oneOffEvents={oneOffEvents}
          onClose={() => setSelectedDay(null)}
          onSwitchTab={(t) => { setSelectedDay(null); onSwitchTab(t) }}
        />
      )}
    </div>
  )
}

// ─── Tasks (Kanban) ───────────────────────────────────────────────────────────

function TasksView({ tasks: initial, userId, userName, profiles }: {
  tasks: Task[]; userId: string; userName: string; profiles: Profile[]
}) {
  const supabase = createClient()
  const myNick = nickname(userName)
  const [tasks, setTasks] = useState(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo')
  const today = localStr(new Date())

  function profileName(email: string) {
    const p = profiles.find(pr => pr.email === email)
    return p ? nickname(p.name) : email.split('@')[0]
  }

  async function addTask() {
    if (!newTitle.trim()) return
    const { data, error } = await supabase.from('tasks').insert({
      title: newTitle.trim(), status: newStatus,
      created_by: userName, tags: [], depends_on: [],
    }).select().single()
    if (!error && data) { setTasks(p => [data as Task, ...p]); setNewTitle(''); setAddOpen(false) }
  }

  async function moveTask(id: string, status: TaskStatus) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    setTasks(p => p.map(t => t.id === id ? { ...t, status } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(p => p.filter(t => t.id !== id))
  }

  const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done']

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Tasks</span>
        <button onClick={() => setAddOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: '#FF6B6B' }}>
          <Plus size={13} /> Add task
        </button>
      </div>
      {addOpen && (
        <div className="mx-4 mb-3 p-4 rounded-2xl" style={{ background: '#FFF5F5', border: '1px solid #FFE5E5' }}>
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add something to work on…"
            className="w-full text-sm outline-none mb-3"
            style={{ background: 'transparent', color: '#2D1B1B' }} />
          <div className="flex gap-2 flex-wrap mb-3">
            {statuses.map(s => {
              const col = KANBAN_COLS.find(c => c.status === s)!
              return (
                <button key={s} onClick={() => setNewStatus(s)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: newStatus === s ? col.color : col.bg, color: newStatus === s ? '#FFFFFF' : col.color }}>
                  {col.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} disabled={!newTitle.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: '#FF6B6B', opacity: newTitle.trim() ? 1 : 0.4 }}>Add</button>
            <button onClick={() => setAddOpen(false)}
              className="px-3 py-2 rounded-xl text-xs" style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3 h-full" style={{ minWidth: 640 }}>
          {KANBAN_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.status)
            return (
              <div key={col.status} className="flex flex-col flex-1 min-w-40 rounded-2xl overflow-hidden"
                style={{ background: col.bg }}>
                <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                    style={{ background: col.color + '30', color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2 flex-1 overflow-y-auto">
                  {colTasks.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: col.color + '80' }}>empty</p>
                  )}
                  {colTasks.map(task => (
                    <div key={task.id} className="rounded-xl p-3" style={{ background: '#FFFFFF' }}>
                      <p className="text-xs font-semibold mb-1 leading-snug" style={{ color: '#2D1B1B' }}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-[10px] mb-1.5" style={{ color: isOverdue(task.due_date) ? '#E85555' : '#B08585' }}>
                          {isOverdue(task.due_date) ? '⚠️ ' : '📅 '}{fmtDate(task.due_date)}
                        </p>
                      )}
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-1.5">
                          {task.tags.map(tag => {
                            const tc = tagColor(tag)
                            return <span key={tag} className="px-1.5 py-0.5 rounded-lg text-[9px] font-semibold"
                              style={{ background: tc.bg, color: tc.text }}>{tag}</span>
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px]" style={{ color: '#B08585' }}>
                          {profileName(task.created_by)}
                        </span>
                        <div className="flex gap-1">
                          {col.status !== 'done' && (
                            <button onClick={() => moveTask(task.id, statuses[statuses.indexOf(col.status) + 1] as TaskStatus)}
                              className="w-5 h-5 rounded-lg flex items-center justify-center"
                              style={{ background: col.color + '20' }}>
                              <ChevronRight size={10} style={{ color: col.color }} />
                            </button>
                          )}
                          <button onClick={() => deleteTask(task.id)}
                            className="w-5 h-5 rounded-lg flex items-center justify-center"
                            style={{ background: '#FFF0F0' }}>
                            <X size={10} style={{ color: '#E85555' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Visits ───────────────────────────────────────────────────────────────────

function VisitsView({ visits: initial, userName }: { visits: Visit[]; userName: string }) {
  const supabase = createClient()
  const [visits, setVisits] = useState(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ traveler: '', start_date: '', end_date: '', notes: '' })
  const today = localStr(new Date())

  const upcoming = visits.filter(v => (v.end_date ?? v.start_date) >= today)
  const past     = visits.filter(v => (v.end_date ?? v.start_date) < today)

  async function promote(id: string) {
    await supabase.from('visits').update({ status: 'confirmed' }).eq('id', id)
    setVisits(p => p.map(v => v.id === id ? { ...v, status: 'confirmed' } : v))
  }
  async function addVisit() {
    if (!form.traveler || !form.start_date) return
    const { data, error } = await supabase.from('visits').insert({
      ...form, status: 'proposed', proposed_by: userName,
    }).select().single()
    if (!error && data) { setVisits(p => [data as Visit, ...p]); setForm({ traveler: '', start_date: '', end_date: '', notes: '' }); setAddOpen(false) }
  }

  function VisitCard({ v }: { v: Visit }) {
    return (
      <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F5EDE8' }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <span className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>✈️ {v.traveler}</span>
            <p className="text-xs mt-0.5" style={{ color: '#7A5C5C' }}>
              {fmtDate(v.start_date)}{v.end_date && v.end_date !== v.start_date ? ` – ${fmtDate(v.end_date)}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="px-2 py-0.5 rounded-xl text-[10px] font-bold"
              style={{ background: v.status === 'confirmed' ? '#E0F7F5' : '#FFF8D6', color: v.status === 'confirmed' ? '#2BA99C' : '#B59100' }}>
              {v.status === 'confirmed' ? 'Confirmed' : 'Proposed'}
            </span>
            {v.status === 'confirmed' && v.start_date >= today && (
              <span className="text-[10px]" style={{ color: '#B08585' }}>{daysUntil(v.start_date)}</span>
            )}
          </div>
        </div>
        {v.notes && <p className="text-xs mt-1" style={{ color: '#B08585' }}>{v.notes}</p>}
        {v.status === 'proposed' && (
          <button onClick={() => promote(v.id)}
            className="mt-2 text-xs font-semibold px-3 py-1 rounded-xl"
            style={{ background: '#E0F7F5', color: '#2BA99C' }}>
            Mark confirmed ✓
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col px-4 py-3 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Visits</span>
        <button onClick={() => setAddOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: '#5B8DEF' }}>
          <Plus size={13} /> Plan visit
        </button>
      </div>
      {addOpen && (
        <div className="p-4 rounded-2xl" style={{ background: '#E8EDFF', border: '1px solid #C3D0F5' }}>
          <div className="flex flex-col gap-2 mb-3">
            <input value={form.traveler} onChange={e => setForm(f => ({ ...f, traveler: e.target.value }))}
              placeholder="Who's traveling?"
              className="w-full text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: '#FFFFFF', color: '#2D1B1B' }} />
            <div className="flex gap-2">
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="flex-1 text-sm rounded-xl px-3 py-2 outline-none"
                style={{ background: '#FFFFFF', color: '#2D1B1B' }} />
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="flex-1 text-sm rounded-xl px-3 py-2 outline-none"
                style={{ background: '#FFFFFF', color: '#2D1B1B' }} />
            </div>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="w-full text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: '#FFFFFF', color: '#2D1B1B' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={addVisit} disabled={!form.traveler || !form.start_date}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: '#5B8DEF', opacity: form.traveler && form.start_date ? 1 : 0.4 }}>Add</button>
            <button onClick={() => setAddOpen(false)}
              className="px-3 py-2 rounded-xl text-xs" style={{ background: '#FFFFFF', color: '#7A5C5C' }}>Cancel</button>
          </div>
        </div>
      )}
      {upcoming.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: '#B08585' }}>No visits planned yet — add one above 🛫</p>
      )}
      {upcoming.map(v => <VisitCard key={v.id} v={v} />)}
      {past.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B08585' }}>Past</p>
          {past.map(v => <VisitCard key={v.id} v={v} />)}
        </>
      )}
    </div>
  )
}

// ─── Milestones ───────────────────────────────────────────────────────────────

function MilestonesView({ milestones: initial, userName }: { milestones: Milestone[]; userName: string }) {
  const supabase = createClient()
  const [milestones, setMilestones] = useState(initial)
  const tracks = Object.keys(TRACK_META)

  async function cycleStatus(id: string, current: string) {
    const next = current === 'not_started' ? 'in_progress' : current === 'in_progress' ? 'done' : 'not_started'
    await supabase.from('milestones').update({ status: next, completed_at: next === 'done' ? new Date().toISOString() : null }).eq('id', id)
    setMilestones(p => p.map(m => m.id === id ? { ...m, status: next } : m))
  }

  return (
    <div className="flex flex-col px-4 py-3 gap-5 overflow-y-auto">
      {tracks.map(track => {
        const meta = TRACK_META[track]
        const items = milestones.filter(m => m.track === track)
        if (items.length === 0) return null
        return (
          <div key={track}>
            <div className="flex items-center gap-2 mb-3">
              <span>{meta.emoji}</span>
              <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: meta.bg, color: meta.color }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map(m => (
                <div key={m.id} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: `1px solid ${meta.color}28` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: '#2D1B1B', textDecoration: m.status === 'done' ? 'line-through' : 'none' }}>
                        {m.title}
                      </p>
                      <p className="text-xs" style={{ color: '#B08585' }}>{m.definition_of_done}</p>
                      {m.target_date && (
                        <p className="text-xs mt-1" style={{ color: '#7A5C5C' }}>📅 {fmtDate(m.target_date)}</p>
                      )}
                    </div>
                    <button onClick={() => cycleStatus(m.id, m.status)}
                      className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: m.status === 'done' ? meta.color : m.status === 'in_progress' ? meta.color : '#E0D5D5',
                        background: m.status === 'done' ? meta.color : m.status === 'in_progress' ? meta.bg : 'transparent',
                      }}>
                      {m.status === 'done' && <Check size={12} color="white" strokeWidth={3} />}
                      {m.status === 'in_progress' && <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {milestones.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: '#B08585' }}>No milestones yet 🎯</p>
      )}
    </div>
  )
}

// ─── Dreams ───────────────────────────────────────────────────────────────────

function DreamsView({ dreams: initial, userId, userName }: { dreams: Dream[]; userId: string; userName: string }) {
  const supabase = createClient()
  const [dreams, setDreams] = useState(initial)
  const [newDream, setNewDream] = useState('')
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)

  const active = dreams.filter(d => !d.done)
  const done   = dreams.filter(d => d.done)

  async function addDream() {
    if (!newDream.trim()) return
    const { data, error } = await supabase.from('dreams').insert({ text: newDream.trim(), author: userId, done: false }).select().single()
    if (!error && data) { setDreams(p => [data as Dream, ...p]); setNewDream('') }
  }
  async function toggleDone(id: string, current: boolean) {
    await supabase.from('dreams').update({ done: !current, done_at: !current ? new Date().toISOString() : null }).eq('id', id)
    setDreams(p => p.map(d => d.id === id ? { ...d, done: !current } : d))
  }

  return (
    <div className="flex flex-col px-4 py-3 gap-3 overflow-y-auto">
      <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Things you can&apos;t wait to do together</p>
      <div className="flex gap-2">
        <input value={newDream} onChange={e => setNewDream(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addDream()}
          placeholder="Add a dream…"
          className="flex-1 text-sm rounded-2xl px-4 py-2.5 outline-none"
          style={{ background: '#FFFFFF', border: '1px solid #F5EDE8', color: '#2D1B1B' }} />
        <button onClick={addDream} disabled={!newDream.trim()}
          className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: '#4ECDC4', opacity: newDream.trim() ? 1 : 0.4 }}>Add</button>
      </div>
      {active.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: '#B08585' }}>
          Add your first shared dream, {myNick} 🌍
        </p>
      )}
      {active.map(d => (
        <div key={d.id} className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #F5EDE8' }}>
          <button onClick={() => toggleDone(d.id, d.done)}
            className="flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 transition-all"
            style={{ borderColor: '#4ECDC4' }} />
          <div className="flex-1">
            <p className="text-sm" style={{ color: '#2D1B1B' }}>{d.text}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#B08585' }}>
              added by {d.author === userId ? myNick : pNick}
            </p>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide mt-2" style={{ color: '#B08585' }}>Done together ✓</p>
          {done.map(d => (
            <div key={d.id} className="flex items-start gap-3 p-3 rounded-2xl opacity-60" style={{ background: '#F5EDE8' }}>
              <button onClick={() => toggleDone(d.id, d.done)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: '#4ECDC4' }}>
                <Check size={11} color="white" strokeWidth={3} />
              </button>
              <p className="text-sm line-through flex-1" style={{ color: '#7A5C5C' }}>{d.text}</p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── All items (unified list) ──────────────────────────────────────────────────

function AllView({ tasks, visits, milestones, dreams, userId, userName, onTabChange }: {
  tasks: Task[]; visits: Visit[]; milestones: Milestone[]; dreams: Dream[]
  userId: string; userName: string; onTabChange: (t: SubTab) => void
}) {
  const today = localStr(new Date())

  type Item = { label: string; date: string | null; type: string; color: string; bg: string; status?: string }
  const items: Item[] = [
    ...tasks.filter(t => t.status !== 'done').map(t => ({
      label: t.title, date: t.due_date, type: 'Task', color: '#FF6B6B', bg: '#FFE5E5', status: t.status,
    })),
    ...visits.filter(v => (v.end_date ?? v.start_date) >= today).map(v => ({
      label: `✈️ ${v.traveler}`, date: v.start_date, type: 'Visit', color: '#5B8DEF', bg: '#E8EDFF', status: v.status,
    })),
    ...milestones.filter(m => m.status !== 'done' && m.target_date).map(m => ({
      label: m.title, date: m.target_date, type: 'Milestone', color: '#A078C8', bg: '#F0E8FF', status: m.status,
    })),
    ...dreams.filter(d => !d.done).map(d => ({
      label: d.text, date: null, type: 'Dream', color: '#4ECDC4', bg: '#E0F7F5',
    })),
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-5xl mb-4">📅</div>
      <p className="text-base font-semibold mb-1" style={{ color: '#2D1B1B' }}>Nothing planned yet</p>
      <p className="text-sm" style={{ color: '#B08585' }}>Add a task, plan a visit, or dream big — this is your shared board.</p>
    </div>
  )

  return (
    <div className="flex flex-col px-4 py-3 gap-2 overflow-y-auto">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #F5EDE8' }}>
          <span className="px-2 py-0.5 rounded-xl text-[10px] font-bold flex-shrink-0"
            style={{ background: item.bg, color: item.color }}>{item.type}</span>
          <p className="flex-1 text-sm" style={{ color: '#2D1B1B' }}>{item.label}</p>
          {item.date && (
            <span className="text-xs flex-shrink-0" style={{ color: isOverdue(item.date) ? '#E85555' : '#B08585' }}>
              {isOverdue(item.date) ? '⚠️ ' : ''}{fmtDate(item.date)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TogetherClient({
  userId, userEmail, userName, userColor,
  profiles, tasks, visits, milestones, dreams, moments,
  recurringEvents, oneOffEvents,
}: Props) {
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)
  const supabase = createClient()

  const [tab, setTab] = useState<SubTab>('all')
  const [calOpen, setCalOpen] = useState(false)

  // Date night banner: show on Monday if no confirmed moment this week
  const today = new Date()
  const isMonday = today.getDay() === 1
  const weekStart = (() => {
    const d = new Date(today); d.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return localStr(d)
  })()
  const weekEnd = (() => {
    const d = new Date(today); d.setDate(today.getDate() + (7 - (today.getDay() + 6) % 7 - 1)); return localStr(d)
  })()
  const hasDateNightThisWeek = moments.some(m =>
    m.confirmed && m.date_time && m.date_time.slice(0, 10) >= weekStart && m.date_time.slice(0, 10) <= weekEnd
  )
  const [dateBannerDismissed, setDateBannerDismissed] = useState(false)
  const showDateBanner = !dateBannerDismissed && !hasDateNightThisWeek && today.getDay() >= 1

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'all',        label: 'All'        },
    { id: 'tasks',      label: 'Tasks'      },
    { id: 'visits',     label: 'Visits'     },
    { id: 'milestones', label: 'Milestones' },
    { id: 'dreams',     label: 'Dreams'     },
  ]

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FFFAF7' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-0.5" style={{ color: '#2D1B1B' }}>Together</h1>
            <p className="text-sm" style={{ color: '#B08585' }}>Plans, tasks, and things you&apos;re building</p>
          </div>
          <button
            onClick={() => setCalOpen(o => !o)}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
            style={{ background: calOpen ? '#FF6B6B' : '#F5EDE8' }}
            title="Toggle calendar"
          >
            <CalendarDays size={18} style={{ color: calOpen ? '#FFFFFF' : '#7A5C5C' }} />
          </button>
        </div>

        {/* Date night banner */}
        {showDateBanner && (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-4"
            style={{ background: '#FFF8D6', border: '1px solid #FFD93D40' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                🌙 No date night planned this week yet
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7A5C5C' }}>When are you two getting together?</p>
            </div>
            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <button className="text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: '#E5A800', color: '#FFFFFF' }}>
                Plan it
              </button>
              <button onClick={() => setDateBannerDismissed(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#F5EDE8' }}>
                <X size={12} style={{ color: '#7A5C5C' }} />
              </button>
            </div>
          </div>
        )}

        {/* Subtab pills */}
        {!calOpen && (
          <div className="flex gap-1.5 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
            {SUBTABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: tab === t.id ? '#FF6B6B' : '#F5EDE8',
                  color: tab === t.id ? '#FFFFFF' : '#7A5C5C',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {calOpen ? (
          <CalendarView
            anchor={new Date()} tasks={tasks} visits={visits} milestones={milestones}
            recurringEvents={recurringEvents} oneOffEvents={oneOffEvents} moments={moments}
            onClose={() => setCalOpen(false)}
            onSwitchTab={(t) => { setTab(t); setCalOpen(false) }}
          />
        ) : tab === 'tasks' ? (
          <TasksView tasks={tasks} userId={userId} userName={userName} profiles={profiles} />
        ) : tab === 'visits' ? (
          <VisitsView visits={visits} userName={userName} />
        ) : tab === 'milestones' ? (
          <MilestonesView milestones={milestones} userName={userName} />
        ) : tab === 'dreams' ? (
          <DreamsView dreams={dreams} userId={userId} userName={userName} />
        ) : (
          <AllView tasks={tasks} visits={visits} milestones={milestones} dreams={dreams}
            userId={userId} userName={userName} onTabChange={setTab} />
        )}
      </div>
    </div>
  )
}
