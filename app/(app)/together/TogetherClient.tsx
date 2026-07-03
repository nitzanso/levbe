'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nickname, partnerNick } from '@/lib/nicknames'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Shuffle, Pencil } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab = 'all' | 'tasks' | 'visits' | 'milestones' | 'dreams'
type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

interface Task {
  id: string; title: string; description: string | null; status: TaskStatus
  assignee: string | null; due_date: string | null; tags: string[]
  depends_on: string[]; created_by: string; created_at: string; updated_at: string
  priority: string | null
}
interface ActivityItem {
  id: string; task_id: string; author: string; action_type: string
  old_value: string | null; new_value: string | null; created_at: string
}
interface TaskComment {
  id: string; author: string; text: string; created_at: string
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
interface IdeaItem { id: string; idea_text: string; category: string }

interface Props {
  userId: string; userEmail: string; userName: string; userColor: string
  profiles: Profile[]; tasks: Task[]; visits: Visit[]
  milestones: Milestone[]; dreams: Dream[]; moments: Moment[]
  recurringEvents: RecurringEvent[]; oneOffEvents: OneOffEvent[]
  ideaBank: IdeaItem[]
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

const PRIORITY_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low:    { label: 'Low',    color: '#7A9E7E', bg: '#EDF5EE', dot: '#7A9E7E' },
  medium: { label: 'Medium', color: '#B59100', bg: '#FFF8D6', dot: '#E5A800' },
  high:   { label: 'High',   color: '#D4752A', bg: '#FFF0E5', dot: '#FF8C42' },
  urgent: { label: 'Urgent', color: '#C94040', bg: '#FFE5E5', dot: '#FF4444' },
}

const TAG_PALETTES = [
  { bg: '#FFE5E5', text: '#C94040' }, { bg: '#E0F7F5', text: '#2BA99C' },
  { bg: '#FFF8D6', text: '#B59100' }, { bg: '#F5EDE8', text: '#7A5C5C' },
  { bg: '#E8EDFF', text: '#4A5FA5' }, { bg: '#F0E8FF', text: '#7B55A5' },
  { bg: '#E8F5FF', text: '#2A7AAD' }, { bg: '#FFF0E5', text: '#C96A28' },
]
function tagColor(tag: string) {
  const h = [...tag].reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_PALETTES[h % TAG_PALETTES.length]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: '1px solid #F5EDE8' }}>
            <h2 className="text-base font-bold" style={{ color: '#2D1B1B' }}>{headerLabel}</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#F5EDE8' }}>
              <X size={15} style={{ color: '#7A5C5C' }} />
            </button>
          </div>

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

      <div className="flex-1 overflow-y-auto px-2 pb-4 pt-1">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="text-center py-1.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: '#B08585' }}>{wd}</div>
          ))}
        </div>

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
                    style={{ minHeight: 80, opacity: inMonth ? 1 : 0.28, background: 'transparent' }}
                    onMouseEnter={e => { if (inMonth) (e.currentTarget as HTMLElement).style.background = '#F5EDE8' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div className="flex mb-1">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#FF6B6B' }}>{day.getDate()}</span>
                      ) : (
                        <span className="w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0"
                          style={{ color: '#2D1B1B' }}>{day.getDate()}</span>
                      )}
                    </div>
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

      {selectedDay && (
        <DayPopup
          dateStr={selectedDay} tasks={tasks} visits={visits} milestones={milestones}
          moments={moments} recurringEvents={recurringEvents} oneOffEvents={oneOffEvents}
          onClose={() => setSelectedDay(null)}
          onSwitchTab={(t) => { setSelectedDay(null); onSwitchTab(t) }}
        />
      )}
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task: initialTask, userId, userName, profiles, allTasks, onClose, onChange, onDelete }: {
  task: Task; userId: string; userName: string; profiles: Profile[]
  allTasks: Task[]; onClose: () => void; onChange: (t: Task) => void; onDelete: (id: string) => void
}) {
  const supabase = createClient()
  const myNick = nickname(userName)

  const [task, setTask] = useState<Task>({ ...initialTask, priority: initialTask.priority ?? 'medium' })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [depSearch, setDepSearch] = useState('')
  const [showDepDrop, setShowDepDrop] = useState(false)
  const [showStatusDrop, setShowStatusDrop] = useState(false)
  const [showAssigneeDrop, setShowAssigneeDrop] = useState(false)
  const [showPriorityDrop, setShowPriorityDrop] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showStatusDrop && !showAssigneeDrop && !showPriorityDrop && !showDepDrop) return
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowStatusDrop(false); setShowAssigneeDrop(false)
        setShowPriorityDrop(false); setShowDepDrop(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showStatusDrop, showAssigneeDrop, showPriorityDrop, showDepDrop])

  // Load activity + comments
  useEffect(() => {
    const id = initialTask.id
    Promise.all([
      supabase.from('task_activity').select('*').eq('task_id', id).order('created_at'),
      supabase.from('comments').select('id, author, text, created_at')
        .eq('entity_type', 'task').eq('entity_id', id).order('created_at'),
    ]).then(([{ data: acts }, { data: cmts }]) => {
      if (acts) setActivities(acts as ActivityItem[])
      if (cmts) setComments(cmts as TaskComment[])
    })
  }, [initialTask.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveField(field: keyof Task, newVal: unknown, oldVal: unknown, actType: string) {
    const updated = { ...task, [field]: newVal }
    setTask(updated)
    onChange(updated)
    const { error } = await supabase.from('tasks').update({ [field]: newVal }).eq('id', task.id)
    if (error) { setTask(task); onChange(task); return }
    const { data: newActs } = await supabase.from('task_activity').insert({
      task_id: task.id, author: userId, action_type: actType,
      old_value: String(oldVal ?? ''), new_value: String(newVal ?? ''),
    }).select()
    if (newActs) setActivities(prev => [...prev, newActs[0] as ActivityItem])
  }

  async function sendComment() {
    const text = commentText.trim()
    if (!text || sendingComment) return
    setSendingComment(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'task', entityId: task.id, text }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      if (comment) {
        setComments(prev => [...prev, comment as TaskComment])
        setCommentText('')
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    }
    setSendingComment(false)
  }

  function nickForId(id: string | null): string {
    if (!id) return 'Someone'
    if (id === userId) return myNick
    const p = profiles.find(pr => pr.id === id)
    return p ? nickname(p.name) : 'Someone'
  }

  function activityLabel(a: ActivityItem): string {
    const who = nickForId(a.author)
    switch (a.action_type) {
      case 'status_change': return `${who} moved this to ${KANBAN_COLS.find(c => c.status === a.new_value)?.label ?? a.new_value}`
      case 'assignee_change': return `${who} assigned this to ${a.new_value ? nickForId(a.new_value) : 'Unassigned'}`
      case 'due_date_change': return a.new_value ? `${who} set due date to ${fmtDate(a.new_value)}` : `${who} removed due date`
      case 'priority_change': return `${who} set priority to ${PRIORITY_META[a.new_value ?? 'medium']?.label ?? a.new_value}`
      case 'tag_change': return `${who} updated tags`
      default: return `${who} made a change`
    }
  }

  type FeedItem =
    | { kind: 'activity' } & ActivityItem
    | { kind: 'comment' } & TaskComment

  const feed: FeedItem[] = [
    ...activities.map(a => ({ kind: 'activity' as const, ...a })),
    ...comments.map(c => ({ kind: 'comment' as const, ...c })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const col = KANBAN_COLS.find(c => c.status === task.status) ?? KANBAN_COLS[0]
  const pri = PRIORITY_META[task.priority ?? 'medium']
  const assigneeProfile = task.assignee ? profiles.find(p => p.id === task.assignee) : null
  const depResults = allTasks.filter(t =>
    t.id !== task.id &&
    !(task.depends_on ?? []).includes(t.id) &&
    t.title.toLowerCase().includes(depSearch.toLowerCase())
  ).slice(0, 6)

  const myProfile = profiles.find(p => p.id === userId)

  return (
    <>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(45,27,27,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          className="w-full flex flex-col overflow-hidden rounded-3xl shadow-2xl"
          style={{ maxWidth: 600, maxHeight: '90vh', background: '#FFFAF7', animation: 'modalIn 0.15s cubic-bezier(0.16,1,0.3,1) both' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Title */}
          <div className="flex items-start gap-3 px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid #F5EDE8' }}>
            <input
              key={task.id}
              className="flex-1 text-lg font-bold outline-none bg-transparent"
              style={{ color: '#2D1B1B' }}
              defaultValue={task.title}
              onBlur={e => {
                const v = e.target.value.trim()
                if (v && v !== task.title) saveField('title', v, task.title, 'title_change')
              }}
            />
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
              style={{ background: '#F5EDE8' }}>
              <X size={15} style={{ color: '#7A5C5C' }} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* Metadata — status / priority / assignee / due */}
            <div ref={dropRef} className="px-6 py-4 flex flex-wrap gap-3 items-center" style={{ borderBottom: '1px solid #F5EDE8' }}>

              {/* Status */}
              <div className="relative">
                <button
                  onClick={() => { setShowStatusDrop(v => !v); setShowAssigneeDrop(false); setShowPriorityDrop(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: col.bg, color: col.color }}>
                  {col.label}
                  <ChevronRight size={10} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
                </button>
                {showStatusDrop && (
                  <div className="absolute top-full left-0 mt-1 z-10 rounded-2xl overflow-hidden shadow-xl border"
                    style={{ background: '#FFFAF7', borderColor: '#F5EDE8', minWidth: 150 }}>
                    {KANBAN_COLS.map(c => (
                      <button key={c.status}
                        onClick={() => { saveField('status', c.status, task.status, 'status_change'); setShowStatusDrop(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold transition-colors"
                        style={{ background: task.status === c.status ? c.bg : 'transparent', color: c.color }}>
                        {task.status === c.status && <Check size={10} />}
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <button
                  onClick={() => { setShowPriorityDrop(v => !v); setShowStatusDrop(false); setShowAssigneeDrop(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: pri.bg, color: pri.color }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pri.dot }} />
                  {pri.label}
                  <ChevronRight size={10} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
                </button>
                {showPriorityDrop && (
                  <div className="absolute top-full left-0 mt-1 z-10 rounded-2xl overflow-hidden shadow-xl border"
                    style={{ background: '#FFFAF7', borderColor: '#F5EDE8', minWidth: 130 }}>
                    {Object.entries(PRIORITY_META).map(([p, meta]) => (
                      <button key={p}
                        onClick={() => { saveField('priority', p, task.priority, 'priority_change'); setShowPriorityDrop(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold transition-colors"
                        style={{ background: (task.priority ?? 'medium') === p ? meta.bg : 'transparent', color: meta.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
                        {(task.priority ?? 'medium') === p && <Check size={10} />}
                        {meta.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div className="relative">
                <button
                  onClick={() => { setShowAssigneeDrop(v => !v); setShowStatusDrop(false); setShowPriorityDrop(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
                  {assigneeProfile ? (
                    <>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: assigneeProfile.avatar_color }}>
                        {nickname(assigneeProfile.name).charAt(0).toUpperCase()}
                      </span>
                      {nickname(assigneeProfile.name)}
                    </>
                  ) : (
                    <span>👤 Unassigned</span>
                  )}
                  <ChevronRight size={10} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
                </button>
                {showAssigneeDrop && (
                  <div className="absolute top-full left-0 mt-1 z-10 rounded-2xl overflow-hidden shadow-xl border"
                    style={{ background: '#FFFAF7', borderColor: '#F5EDE8', minWidth: 170 }}>
                    <button
                      onClick={() => { saveField('assignee', null, task.assignee, 'assignee_change'); setShowAssigneeDrop(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: !task.assignee ? '#FF6B6B' : '#7A5C5C' }}>
                      {!task.assignee && <Check size={10} color="#FF6B6B" />}
                      👤 Unassigned
                    </button>
                    {profiles.map(p => (
                      <button key={p.id}
                        onClick={() => {
                          saveField('assignee', p.id, task.assignee, 'assignee_change')
                          setShowAssigneeDrop(false)
                          if (p.id !== userId) {
                            fetch('/api/tasks/assign-notify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ taskId: task.id, taskTitle: task.title, assigneeId: p.id }),
                            }).catch(() => {})
                          }
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold"
                        style={{ color: task.assignee === p.id ? '#FF6B6B' : '#7A5C5C' }}>
                        {task.assignee === p.id && <Check size={10} color="#FF6B6B" />}
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: p.avatar_color }}>
                          {nickname(p.name).charAt(0).toUpperCase()}
                        </span>
                        {nickname(p.name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Due date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: '#B08585' }}>Due</span>
                <input
                  type="date"
                  value={task.due_date ?? ''}
                  onChange={e => saveField('due_date', e.target.value || null, task.due_date, 'due_date_change')}
                  className="text-xs rounded-xl px-2.5 py-1.5 outline-none"
                  style={{ background: '#F5EDE8', color: isOverdue(task.due_date) ? '#E85555' : '#7A5C5C' }}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="px-6 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid #F5EDE8' }}>
              <span className="text-[11px] font-semibold" style={{ color: '#B08585' }}>Tags</span>
              {(task.tags ?? []).map(tag => {
                const tc = tagColor(tag)
                return (
                  <button key={tag}
                    onClick={() => saveField('tags', task.tags.filter(t => t !== tag), task.tags, 'tag_change')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: tc.bg, color: tc.text }}>
                    {tag} <X size={9} />
                  </button>
                )
              })}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const tag = tagInput.trim().replace(',', '')
                    if (!task.tags.includes(tag)) saveField('tags', [...task.tags, tag], task.tags, 'tag_change')
                    setTagInput('')
                  }
                }}
                placeholder="+ add tag"
                className="text-[11px] outline-none px-2 py-0.5 rounded-lg"
                style={{ background: '#F5EDE8', color: '#7A5C5C', minWidth: 64 }}
              />
            </div>

            {/* Dependencies */}
            <div className="px-6 py-3" style={{ borderBottom: '1px solid #F5EDE8' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold" style={{ color: '#B08585' }}>Blocked by</span>
                {(task.depends_on ?? []).map(depId => {
                  const dep = allTasks.find(t => t.id === depId)
                  if (!dep) return null
                  const done = dep.status === 'done'
                  return (
                    <span key={depId}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: done ? '#E0F7F5' : '#FFE5E5', color: done ? '#2BA99C' : '#C94040' }}>
                      {done ? '✓' : '🔴'} {dep.title}
                      <button onClick={() => saveField('depends_on', (task.depends_on ?? []).filter(d => d !== depId), task.depends_on, 'dependency_change')}>
                        <X size={9} />
                      </button>
                    </span>
                  )
                })}
                <div className="relative">
                  <input
                    value={depSearch}
                    onChange={e => { setDepSearch(e.target.value); setShowDepDrop(true) }}
                    onFocus={() => setShowDepDrop(true)}
                    onBlur={() => setTimeout(() => setShowDepDrop(false), 150)}
                    placeholder="+ add dependency"
                    className="text-[11px] outline-none px-2 py-0.5 rounded-lg"
                    style={{ background: '#F5EDE8', color: '#7A5C5C', width: 130 }}
                  />
                  {showDepDrop && depResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 z-10 rounded-xl overflow-hidden shadow-lg border w-56"
                      style={{ background: '#FFFAF7', borderColor: '#F5EDE8' }}>
                      {depResults.map(dep => (
                        <button key={dep.id}
                          onClick={() => {
                            saveField('depends_on', [...(task.depends_on ?? []), dep.id], task.depends_on, 'dependency_change')
                            setDepSearch(''); setShowDepDrop(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5EDE8] truncate"
                          style={{ color: '#2D1B1B' }}>
                          {dep.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid #F5EDE8' }}>
              <p className="text-[11px] font-semibold mb-2" style={{ color: '#B08585' }}>Description</p>
              <textarea
                key={task.id}
                defaultValue={task.description ?? ''}
                onBlur={e => {
                  const v = e.target.value.trim() || null
                  if (v !== (task.description ?? null)) saveField('description', v, task.description, 'description_change')
                }}
                placeholder="Add more details…"
                rows={3}
                className="w-full text-sm outline-none resize-none rounded-xl px-3 py-2.5"
                style={{ background: '#F5EDE8', color: '#2D1B1B' }}
              />
            </div>

            {/* Activity + Comments */}
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold mb-3" style={{ color: '#B08585' }}>Activity</p>

              {feed.length === 0 && (
                <p className="text-xs mb-4" style={{ color: '#B08585' }}>No activity yet — start by adding a comment.</p>
              )}

              <div className="flex flex-col gap-3 mb-4">
                {feed.map(item => (
                  <div key={item.id}>
                    {item.kind === 'activity' ? (
                      <p className="text-[11px] italic" style={{ color: '#B08585' }}>
                        {activityLabel(item)} · {timeAgo(item.created_at)}
                      </p>
                    ) : (
                      <div className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: profiles.find(p => p.id === item.author)?.avatar_color ?? '#B08585' }}>
                          {nickForId(item.author).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 rounded-2xl px-3 py-2" style={{ background: '#F5EDE8' }}>
                          <div className="flex items-baseline gap-1.5 mb-0.5">
                            <span className="text-[11px] font-semibold" style={{ color: '#7A5C5C' }}>{nickForId(item.author)}</span>
                            <span className="text-[10px]" style={{ color: '#B08585' }}>{timeAgo(item.created_at)}</span>
                          </div>
                          <p className="text-sm" style={{ color: '#2D1B1B' }}>{(item as { text: string }).text}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>

              {/* Comment input */}
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold mt-1"
                  style={{ background: myProfile?.avatar_color ?? '#FF6B6B' }}>
                  {myNick.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment() }}
                    placeholder="Write a comment… (Ctrl+Enter to send)"
                    rows={2}
                    className="w-full text-sm outline-none resize-none rounded-xl px-3 py-2.5"
                    style={{ background: '#F5EDE8', color: '#2D1B1B' }}
                  />
                  <div className="flex justify-end">
                    <button onClick={sendComment} disabled={!commentText.trim() || sendingComment}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity"
                      style={{ background: '#FF6B6B', opacity: commentText.trim() && !sendingComment ? 1 : 0.4 }}>
                      {sendingComment ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-end flex-shrink-0" style={{ borderTop: '1px solid #F5EDE8' }}>
            <button onClick={() => { onDelete(task.id); onClose() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: '#FFF0F0', color: '#E85555' }}>
              <Trash2 size={12} /> Delete task
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Tasks (Kanban) ───────────────────────────────────────────────────────────

function TasksView({ tasks: initial, userId, userName, profiles }: {
  tasks: Task[]; userId: string; userName: string; profiles: Profile[]
}) {
  const supabase = createClient()
  const [tasks, setTasks] = useState(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterDue, setFilterDue] = useState<string>('')

  const today = localStr(new Date())
  const thisWeekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - (d.getDay() + 6) % 7)); return localStr(d)
  })()

  const allTags = [...new Set(tasks.flatMap(t => t.tags ?? []))]
  const hasFilters = filterAssignee || filterTag || filterPriority || filterDue

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee === 'unassigned' && t.assignee !== null) return false
    if (filterAssignee && filterAssignee !== 'unassigned' && t.assignee !== filterAssignee) return false
    if (filterTag && !(t.tags ?? []).includes(filterTag)) return false
    if (filterPriority && (t.priority ?? 'medium') !== filterPriority) return false
    if (filterDue === 'overdue' && !isOverdue(t.due_date)) return false
    if (filterDue === 'this_week' && (!t.due_date || t.due_date > thisWeekEnd || isOverdue(t.due_date))) return false
    return true
  })

  const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done']

  function profileById(id: string | null): Profile | undefined {
    return id ? profiles.find(p => p.id === id) : undefined
  }

  async function addTask() {
    if (!newTitle.trim()) return
    const { data, error } = await supabase.from('tasks').insert({
      title: newTitle.trim(), status: newStatus,
      created_by: userName, tags: [], depends_on: [],
    }).select().single()
    if (error) { console.error('[Levbe] addTask failed:', error.message); return }
    if (data) { setTasks(p => [data as Task, ...p]); setNewTitle(''); setAddOpen(false) }
  }

  async function moveTask(id: string, toStatus: TaskStatus) {
    const orig = tasks.find(t => t.id === id)
    if (!orig) return
    setTasks(p => p.map(t => t.id === id ? { ...t, status: toStatus } : t))
    const { error } = await supabase.from('tasks').update({ status: toStatus }).eq('id', id)
    if (error) {
      setTasks(p => p.map(t => t.id === id ? { ...t, status: orig.status } : t))
    } else {
      supabase.from('task_activity').insert({
        task_id: id, author: userId, action_type: 'status_change',
        old_value: orig.status, new_value: toStatus,
      }).then(() => {})
    }
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(p => p.filter(t => t.id !== id))
  }

  function handleTaskChange(updated: Task) {
    setTasks(p => p.map(t => t.id === updated.id ? updated : t))
  }

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 gap-2 flex-shrink-0 flex-wrap">
        <span className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Tasks</span>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className="text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
            style={{ background: filterAssignee ? '#FFE5E5' : '#F5EDE8', color: filterAssignee ? '#C94040' : '#7A5C5C' }}>
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{nickname(p.name)}</option>)}
          </select>

          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
            style={{ background: filterPriority ? '#FFE5E5' : '#F5EDE8', color: filterPriority ? '#C94040' : '#7A5C5C' }}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_META).map(([p, m]) => <option key={p} value={p}>{m.label}</option>)}
          </select>

          <select value={filterDue} onChange={e => setFilterDue(e.target.value)}
            className="text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
            style={{ background: filterDue ? '#FFE5E5' : '#F5EDE8', color: filterDue ? '#C94040' : '#7A5C5C' }}>
            <option value="">All dates</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">This week</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => { setFilterAssignee(''); setFilterTag(''); setFilterPriority(''); setFilterDue('') }}
              className="text-xs px-2 py-1.5 rounded-xl"
              style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
              ✕ Clear
            </button>
          )}

          <button onClick={() => setAddOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: '#FF6B6B' }}>
            <Plus size={13} /> Add task
          </button>
        </div>
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
          {allTags.map(tag => {
            const tc = tagColor(tag)
            const active = filterTag === tag
            return (
              <button key={tag}
                onClick={() => setFilterTag(active ? '' : tag)}
                className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{ background: active ? tc.text : tc.bg, color: active ? '#FFFFFF' : tc.text }}>
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* Add task form */}
      {addOpen && (
        <div className="mx-4 mb-3 p-4 rounded-2xl flex-shrink-0" style={{ background: '#FFF5F5', border: '1px solid #FFE5E5' }}>
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add something to work on…"
            className="w-full text-sm outline-none mb-3"
            style={{ background: 'transparent', color: '#2D1B1B' }} />
          <div className="flex gap-2 flex-wrap mb-3">
            {statuses.map(s => {
              const c = KANBAN_COLS.find(k => k.status === s)!
              return (
                <button key={s} onClick={() => setNewStatus(s)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold"
                  style={{ background: newStatus === s ? c.color : c.bg, color: newStatus === s ? '#FFFFFF' : c.color }}>
                  {c.label}
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

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3 h-full" style={{ minWidth: 680 }}>
          {KANBAN_COLS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.status)
            const colIdx = statuses.indexOf(col.status)

            return (
              <div key={col.status} className="flex flex-col flex-1 min-w-44 rounded-2xl overflow-hidden"
                style={{ background: col.bg }}>

                {/* Column header */}
                <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                    style={{ background: col.color + '30', color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 px-2 pb-2 flex-1 overflow-y-auto">
                  {colTasks.length === 0 && (
                    <p className="text-[11px] text-center py-6 px-2 leading-relaxed"
                      style={{ color: col.color + '80' }}>
                      Nothing here yet —<br />drag a card over<br />or add a new task +
                    </p>
                  )}
                  {colTasks.map(task => {
                    const pri = PRIORITY_META[task.priority ?? 'medium']
                    const assigneeP = profileById(task.assignee)
                    const blockedBy = (task.depends_on ?? [])
                      .map(depId => tasks.find(t => t.id === depId))
                      .filter((t): t is Task => !!t && t.status !== 'done')
                    const isBlocked = blockedBy.length > 0
                    const overdue = isOverdue(task.due_date)

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="rounded-xl p-3 cursor-pointer transition-shadow relative"
                        style={{
                          background: '#FFFFFF',
                          borderLeft: `3px solid ${overdue ? '#E85555' : isBlocked ? '#FFB347' : 'transparent'}`,
                          boxShadow: '0 1px 3px rgba(45,27,27,0.06)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(45,27,27,0.12)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(45,27,27,0.06)' }}
                      >
                        {/* Priority dot */}
                        <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
                          style={{ background: pri.dot }} />

                        {/* Title */}
                        <p className="text-xs font-semibold mb-1.5 leading-snug pr-4"
                          style={{
                            color: '#2D1B1B',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                          {task.title}
                        </p>

                        {/* Tags */}
                        {(task.tags ?? []).length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-1.5">
                            {task.tags.slice(0, 2).map(tag => {
                              const tc = tagColor(tag)
                              return <span key={tag} className="px-1.5 py-0.5 rounded-lg text-[9px] font-semibold"
                                style={{ background: tc.bg, color: tc.text }}>{tag}</span>
                            })}
                            {task.tags.length > 2 && (
                              <span className="text-[9px] font-medium" style={{ color: '#B08585' }}>+{task.tags.length - 2}</span>
                            )}
                          </div>
                        )}

                        {/* Bottom row */}
                        <div className="flex items-center justify-between mt-1 gap-1">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            {isBlocked && (
                              <span className="text-[9px] font-bold flex-shrink-0">🔴</span>
                            )}
                            {task.due_date && (
                              <span className="text-[9px] truncate" style={{ color: overdue ? '#E85555' : '#B08585', fontWeight: overdue ? 700 : 400 }}>
                                {overdue ? '⚠️ ' : ''}{fmtDate(task.due_date)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {/* Assignee avatar */}
                            {assigneeP ? (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                                style={{ background: assigneeP.avatar_color }}>
                                {nickname(assigneeP.name).charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ border: '1.5px dashed #D0C0C0' }} />
                            )}

                            {/* ← → arrows */}
                            {colIdx > 0 && (
                              <button onClick={() => moveTask(task.id, statuses[colIdx - 1] as TaskStatus)}
                                className="w-5 h-5 rounded-lg flex items-center justify-center"
                                style={{ background: col.color + '20' }}>
                                <ChevronLeft size={10} style={{ color: col.color }} />
                              </button>
                            )}
                            {colIdx < statuses.length - 1 && (
                              <button onClick={() => moveTask(task.id, statuses[colIdx + 1] as TaskStatus)}
                                className="w-5 h-5 rounded-lg flex items-center justify-center"
                                style={{ background: col.color + '20' }}>
                                <ChevronRight size={10} style={{ color: col.color }} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          key={selectedTask.id}
          task={selectedTask}
          userId={userId}
          userName={userName}
          profiles={profiles}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onChange={handleTaskChange}
          onDelete={deleteTask}
        />
      )}
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

// ─── Date Night Modal ─────────────────────────────────────────────────────────

function DateNightModal({ weekStart, userEmail, ideaBank, onClose, onSaved }: {
  weekStart: string; userEmail: string; ideaBank: IdeaItem[]
  onClose: () => void; onSaved: (moment: Moment) => void
}) {
  const supabase = createClient()
  const today = localStr(new Date())

  const weekDays = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(y, m - 1, d + i)
      return {
        dateStr: localStr(day),
        short: day.toLocaleDateString('en-GB', { weekday: 'short' }),
        num: day.getDate(),
        past: localStr(day) < today,
      }
    })
  }, [weekStart, today])

  const defaultDay = weekDays.find(d => !d.past)?.dateStr ?? weekDays[6].dateStr
  const [selectedDay, setSelectedDay] = useState(defaultDay)
  const [time, setTime] = useState('20:00')
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)

  function surpriseMe() {
    if (ideaBank.length === 0) return
    const r = ideaBank[Math.floor(Math.random() * ideaBank.length)]
    setIdea(r.idea_text)
  }

  async function submit() {
    setLoading(true)
    const dateTime = `${selectedDay}T${time}:00`
    const { data, error } = await supabase.from('weekly_moments').insert({
      week_start_date: weekStart, idea_text: idea.trim() || null,
      proposed_by: userEmail, source: 'freeform', confirmed: true, date_time: dateTime,
    }).select().single()
    if (!error && data) {
      onSaved(data as Moment)
      fetch('/api/date-night/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: data.id }),
      }).catch(() => {})
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: 'rgba(45,27,27,0.45)' }}
        onClick={onClose}>
        <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: '#FFFAF7', animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
          onClick={e => e.stopPropagation()}>

          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: '1px solid #F5EDE8' }}>
            <h2 className="text-base font-bold" style={{ color: '#2D1B1B' }}>Plan this week&apos;s date night 🌙</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#F5EDE8' }}>
              <X size={15} style={{ color: '#7A5C5C' }} />
            </button>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#7A5C5C' }}>Which day?</p>
              <div className="flex gap-1">
                {weekDays.map(wd => (
                  <button key={wd.dateStr}
                    onClick={() => !wd.past && setSelectedDay(wd.dateStr)}
                    disabled={wd.past}
                    className="flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all"
                    style={{
                      background: selectedDay === wd.dateStr ? '#E5A800' : '#F5EDE8',
                      color: selectedDay === wd.dateStr ? '#FFFFFF' : wd.past ? '#C4A8A8' : '#7A5C5C',
                      opacity: wd.past ? 0.4 : 1,
                    }}>
                    <span className="text-[9px] font-bold uppercase">{wd.short}</span>
                    <span className="text-sm font-bold leading-tight mt-0.5">{wd.num}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#7A5C5C' }}>What time?</p>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full text-sm rounded-2xl px-4 py-2.5 outline-none"
                style={{ background: '#F5EDE8', color: '#2D1B1B' }} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold" style={{ color: '#7A5C5C' }}>Idea (optional)</p>
                {ideaBank.length > 0 && (
                  <button onClick={surpriseMe}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl"
                    style={{ background: '#FFF8D6', color: '#B59100' }}>
                    <Shuffle size={11} /> Surprise me 🎲
                  </button>
                )}
              </div>
              <input value={idea} onChange={e => setIdea(e.target.value)}
                placeholder="What are you thinking?"
                className="w-full text-sm rounded-2xl px-4 py-2.5 outline-none"
                style={{ background: '#F5EDE8', color: '#2D1B1B' }} />
            </div>
          </div>

          <div className="px-5 pb-6 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid #F5EDE8' }}>
            <button onClick={submit} disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: '#E5A800', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Adding…' : 'Add to our calendar 🌙'}
            </button>
            <button onClick={onClose}
              className="w-full py-2 rounded-2xl text-sm"
              style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
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
  profiles, tasks, visits, milestones, dreams, moments: initialMoments,
  recurringEvents, oneOffEvents, ideaBank,
}: Props) {
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)
  const supabase = createClient()

  const [tab, setTab] = useState<SubTab>('all')
  const [calOpen, setCalOpen] = useState(false)
  const [moments, setMoments] = useState(initialMoments)
  const [planModalOpen, setPlanModalOpen] = useState(false)

  const today = new Date()
  const weekStart = (() => {
    const d = new Date(today); d.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return localStr(d)
  })()
  const weekEnd = (() => {
    const d = new Date(today); d.setDate(today.getDate() + (7 - (today.getDay() + 6) % 7 - 1)); return localStr(d)
  })()
  const thisWeekMoment = moments.find(m =>
    m.confirmed && m.date_time && m.date_time.slice(0, 10) >= weekStart && m.date_time.slice(0, 10) <= weekEnd
  ) ?? null
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const showPlanBanner = !bannerDismissed && !thisWeekMoment

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
            title="Toggle calendar">
            <CalendarDays size={18} style={{ color: calOpen ? '#FFFFFF' : '#7A5C5C' }} />
          </button>
        </div>

        {showPlanBanner && (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-4"
            style={{ background: '#FFF8D6', border: '1px solid #FFD93D40' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>🌙 No date night this week yet</p>
              <p className="text-xs mt-0.5" style={{ color: '#7A5C5C' }}>When are you two getting together?</p>
            </div>
            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <button onClick={() => setPlanModalOpen(true)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: '#E5A800', color: '#FFFFFF' }}>Plan it</button>
              <button onClick={() => setBannerDismissed(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#F5EDE8' }}>
                <X size={12} style={{ color: '#7A5C5C' }} />
              </button>
            </div>
          </div>
        )}
        {thisWeekMoment && (() => {
          const dt = thisWeekMoment.date_time ? new Date(thisWeekMoment.date_time) : null
          const dayLabel = dt ? dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : ''
          const timeLabel = dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-4"
              style={{ background: '#FFF8D6', border: '1px solid #FFD93D40' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>
                  🌙 Date night: {dayLabel}{timeLabel ? ` at ${timeLabel}` : ''}
                </p>
                {thisWeekMoment.idea_text && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#7A5C5C' }}>{thisWeekMoment.idea_text}</p>
                )}
              </div>
              <button onClick={() => setPlanModalOpen(true)}
                className="ml-3 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#F5EDE8' }} title="Edit">
                <Pencil size={12} style={{ color: '#7A5C5C' }} />
              </button>
            </div>
          )
        })()}

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

      {planModalOpen && (
        <DateNightModal
          weekStart={weekStart} userEmail={userEmail} ideaBank={ideaBank}
          onClose={() => setPlanModalOpen(false)}
          onSaved={(newMoment) => { setMoments(prev => [newMoment, ...prev]); setPlanModalOpen(false) }}
        />
      )}
    </div>
  )
}
