'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { nickname } from '@/lib/nicknames'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'month' | 'week' | 'agenda'
type EventType = 'visit' | 'moment' | 'milestone' | 'task' | 'recurring' | 'oneoff'

interface CalEvent {
  id: string
  type: EventType
  title: string
  date: string
  endDate?: string
  time?: string
  color: string
  bg: string
  faded?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any
}

interface Visit {
  id: string; status: string; traveler: string
  start_date: string; end_date: string | null; notes: string | null; proposed_by: string
}
interface Milestone {
  id: string; track: string; title: string; definition_of_done: string
  target_date: string | null; status: string
}
interface Task {
  id: string; title: string; status: string
  due_date: string | null; tags: string[]; created_by: string
}
interface Moment {
  id: string; week_start_date: string; idea_text: string
  proposed_by: string; confirmed: boolean; date_time: string | null
}
interface RecurringEvent {
  id: string; title: string; description: string | null
  recurrence: string; days_of_week: number[]
  time: string | null; color: string; active: boolean; created_by: string
}
interface OneOffEvent {
  id: string; title: string; date: string; time: string | null
  color: string; notes: string | null; created_by: string
}

interface Props {
  userEmail: string; userName: string
  visits: Visit[]; milestones: Milestone[]; tasks: Task[]
  moments: Moment[]; recurringEvents: RecurringEvent[]; oneOffEvents: OneOffEvent[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_COLORS: Record<string, { color: string; bg: string }> = {
  relationship:  { color: '#FF6B6B', bg: '#FFE5E5' },
  wellbeing:     { color: '#4ECDC4', bg: '#E0F7F5' },
  germany_prep:  { color: '#E5A800', bg: '#FFF8D6' },
  career_israel: { color: '#B08585', bg: '#F5EDE8' },
  contingency:   { color: '#7A5C5C', bg: '#EEEAEA' },
}

const EVENT_PALETTE = [
  { color: '#FF6B6B', label: 'Coral' },
  { color: '#4ECDC4', label: 'Teal' },
  { color: '#FFD93D', label: 'Gold' },
  { color: '#B08585', label: 'Mauve' },
  { color: '#7A9CF5', label: 'Blue' },
  { color: '#A078C8', label: 'Purple' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  // Use local date components — toISOString() returns UTC which shifts the date
  // by one day in UTC+2/+3 (Germany/Israel) timezones.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function fmtShort(s: string) {
  // Parse date string as LOCAL midnight — new Date("YYYY-MM-DD") parses as UTC
  // which shifts the displayed date in UTC+2/+3 timezones.
  const [y, mo, d] = s.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isToday(dateStr: string, today: string) { return dateStr === today }

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  // Monday=0 … Sunday=6: convert JS getDay() (Sun=0) to Mon-first offset
  const offset = (firstDay.getDay() + 6) % 7
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) =>
      new Date(year, month, 1 - offset + w * 7 + d)
    )
  )
}

function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay()
  const daysBack = dow === 0 ? 6 : dow - 1
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - daysBack)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start)
  const endDate = new Date(end)
  while (d <= endDate) { dates.push(toDateStr(d)); d.setDate(d.getDate() + 1) }
  return dates
}

// ─── Event building ────────────────────────────────────────────────────────────

function buildStaticEvents(
  visits: Visit[], milestones: Milestone[], tasks: Task[],
  moments: Moment[], oneOffEvents: OneOffEvent[]
): CalEvent[] {
  const events: CalEvent[] = []
  const today = toDateStr(new Date())

  for (const v of visits) {
    const confirmed = v.status === 'confirmed'
    events.push({
      id: `visit-${v.id}`, type: 'visit',
      title: `✈️ Visit${confirmed ? '' : ' (proposed)'}`,
      date: v.start_date, endDate: v.end_date ?? v.start_date,
      color: confirmed ? '#FF6B6B' : '#FFB3B3',
      bg: confirmed ? '#FFE5E5' : '#FFF0F0',
      faded: !confirmed, meta: v,
    })
  }

  for (const m of milestones) {
    if (!m.target_date) continue
    const tc = TRACK_COLORS[m.track] ?? TRACK_COLORS.contingency
    events.push({
      id: `milestone-${m.id}`, type: 'milestone',
      title: `🎯 ${m.title}`,
      date: m.target_date, color: tc.color, bg: tc.bg, meta: m,
    })
  }

  for (const t of tasks) {
    if (!t.due_date || t.status === 'done') continue
    const overdue = t.due_date < today
    events.push({
      id: `task-${t.id}`, type: 'task',
      title: `📋 ${t.title}`,
      date: t.due_date,
      color: overdue ? '#E85555' : '#4ECDC4',
      bg: overdue ? '#FFE5E5' : '#E0F7F5',
      meta: t,
    })
  }

  for (const mo of moments) {
    if (!mo.date_time) continue
    const d = new Date(mo.date_time)
    const short = mo.idea_text.length < 32 ? mo.idea_text : 'Date night'
    events.push({
      id: `moment-${mo.id}`, type: 'moment',
      title: `🌙 ${short}`,
      date: toDateStr(d),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      color: '#E5A800', bg: '#FFF8D6', meta: mo,
    })
  }

  for (const e of oneOffEvents) {
    events.push({
      id: `oneoff-${e.id}`, type: 'oneoff',
      title: e.title, date: e.date, time: e.time ?? undefined,
      color: e.color, bg: e.color + '28', meta: e,
    })
  }

  return events
}

function expandRecurring(recurring: RecurringEvent[], start: Date, end: Date): CalEvent[] {
  const result: CalEvent[] = []
  for (const re of recurring) {
    if (!re.active) continue
    const d = new Date(start)
    while (d <= end) {
      const dow = d.getDay()
      const matches =
        re.recurrence === 'daily' ||
        ((re.recurrence === 'weekly' || re.recurrence === 'custom') && re.days_of_week.includes(dow))
      if (matches) {
        const dateStr = toDateStr(d)
        result.push({
          id: `recurring-${re.id}-${dateStr}`, type: 'recurring',
          title: re.title, date: dateStr, time: re.time ?? undefined,
          color: re.color, bg: re.color + '28', faded: true, meta: re,
        })
      }
      d.setDate(d.getDate() + 1)
    }
  }
  return result
}

function getEventsForDay(dateStr: string, events: CalEvent[]): CalEvent[] {
  return events.filter(e =>
    e.endDate ? dateStr >= e.date && dateStr <= e.endDate : e.date === dateStr
  ).sort((a, b) => {
    const ORDER: EventType[] = ['visit', 'moment', 'milestone', 'task', 'oneoff', 'recurring']
    return ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.time ?? '').localeCompare(b.time ?? '')
  })
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CalendarClient({
  userEmail, userName, visits, milestones, tasks, moments, recurringEvents, oneOffEvents
}: Props) {
  const supabase = createClient()
  const myNick = nickname(userName)

  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', date: '', time: '', color: '#FF6B6B', notes: '' })
  const [saving, setSaving] = useState(false)
  const [localOneOff, setLocalOneOff] = useState<OneOffEvent[]>(oneOffEvents)

  const today = toDateStr(new Date())

  const { viewStart, viewEnd } = useMemo(() => {
    if (view === 'month') {
      const grid = getMonthGrid(anchor.getFullYear(), anchor.getMonth())
      return { viewStart: grid[0][0], viewEnd: grid[5][6] }
    }
    if (view === 'week') {
      const days = getWeekDays(anchor)
      return { viewStart: days[0], viewEnd: days[6] }
    }
    // agenda: today → +90 days
    const start = new Date()
    const end = new Date(start); end.setDate(start.getDate() + 90)
    return { viewStart: start, viewEnd: end }
  }, [view, anchor])

  const staticEvents = useMemo(
    () => buildStaticEvents(visits, milestones, tasks, moments, localOneOff),
    [visits, milestones, tasks, moments, localOneOff]
  )

  const allEvents = useMemo(() => {
    const rec = expandRecurring(recurringEvents, viewStart, viewEnd)
    return [...staticEvents, ...rec]
  }, [staticEvents, recurringEvents, viewStart, viewEnd])

  function prev() {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    setAnchor(d)
  }
  function next() {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    setAnchor(d)
  }

  async function saveOneOff() {
    if (!addForm.title.trim() || !addForm.date) return
    setSaving(true)
    const { data, error } = await supabase.from('one_off_events').insert({
      title: addForm.title.trim(), date: addForm.date,
      time: addForm.time || null, color: addForm.color,
      notes: addForm.notes.trim() || null, created_by: userEmail,
    }).select().single()
    if (!error && data) setLocalOneOff(p => [...p, data])
    setAddForm({ title: '', date: '', time: '', color: '#FF6B6B', notes: '' })
    setAddOpen(false)
    setSaving(false)
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay, allEvents) : []

  const headerTitle = view === 'week'
    ? `Week of ${fmtShort(toDateStr(getWeekDays(anchor)[0]))}`
    : fmtMonth(anchor)

  return (
    <div className="flex flex-col" style={{ height: '100svh', background: '#FFFAF7' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: '#F5EDE8' }}>
              <ChevronLeft size={16} style={{ color: '#7A5C5C' }} />
            </button>
            <span className="text-base font-bold" style={{ color: '#2D1B1B', minWidth: 160, textAlign: 'center', display: 'inline-block' }}>
              {headerTitle}
            </span>
            <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: '#F5EDE8' }}>
              <ChevronRight size={16} style={{ color: '#7A5C5C' }} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnchor(new Date())}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: '#FFE5E5', color: '#FF6B6B' }}
            >
              Today
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#FF6B6B' }}
            >
              <Plus size={16} color="white" />
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#F5EDE8' }}>
          {(['month', 'week', 'agenda'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize"
              style={{
                background: view === v ? 'white' : 'transparent',
                color: view === v ? '#FF6B6B' : '#7A5C5C',
                boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.15s',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── View ── */}
      <div className="flex-1 overflow-hidden">
        {view === 'month' && (
          <MonthView
            anchor={anchor} today={today} allEvents={allEvents}
            onDayClick={setSelectedDay}
          />
        )}
        {view === 'week' && (
          <WeekView
            anchor={anchor} today={today} allEvents={allEvents}
            onDayClick={setSelectedDay}
          />
        )}
        {view === 'agenda' && (
          <AgendaView
            allEvents={allEvents} today={today} userName={myNick}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* ── Day panel ── */}
      {selectedDay && !selectedEvent && (
        <DayPanel
          dateStr={selectedDay} events={selectedDayEvents}
          onClose={() => setSelectedDay(null)}
          onEventClick={e => setSelectedEvent(e)}
        />
      )}

      {/* ── Event detail ── */}
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* ── Add event overlay ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFAF7' }}>
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold" style={{ color: '#2D1B1B' }}>Add event</h2>
            <button onClick={() => setAddOpen(false)}><X size={22} style={{ color: '#B08585' }} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            <input
              autoFocus value={addForm.title}
              onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Event title *"
              className="w-full px-4 py-3 rounded-xl text-base font-medium outline-none"
              style={{ border: '2px solid #FFE5E5', color: '#2D1B1B' }}
            />
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>DATE *</p>
              <input type="date" value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>TIME (optional)</p>
              <input type="time" value={addForm.time}
                onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>COLOR</p>
              <div className="flex gap-3 flex-wrap">
                {EVENT_PALETTE.map(p => (
                  <button
                    key={p.color} onClick={() => setAddForm(f => ({ ...f, color: p.color }))}
                    className="w-9 h-9 rounded-full"
                    style={{
                      background: p.color,
                      transform: addForm.color === p.color ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: addForm.color === p.color ? `0 0 0 3px white, 0 0 0 5px ${p.color}` : 'none',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    title={p.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>NOTES (optional)</p>
              <textarea value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes…" rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }} />
            </div>
          </div>
          <div className="px-5 pb-8">
            <button
              onClick={saveOneOff}
              disabled={!addForm.title.trim() || !addForm.date || saving}
              className="w-full py-4 rounded-2xl font-semibold text-white"
              style={{ background: addForm.title.trim() && addForm.date ? '#FF6B6B' : '#E0E0E0' }}
            >
              Add to calendar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Month View ────────────────────────────────────────────────────────────────

function MonthView({ anchor, today, allEvents, onDayClick }: {
  anchor: Date; today: string; allEvents: CalEvent[]; onDayClick: (d: string) => void
}) {
  const grid = getMonthGrid(anchor.getFullYear(), anchor.getMonth())
  const currentMonthPfx = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="flex flex-col h-full px-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1 flex-shrink-0">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B08585' }}>
            {d.charAt(0)}
          </div>
        ))}
      </div>

      {/* 6-row grid */}
      <div className="flex-1 grid grid-rows-6 gap-px">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((day, di) => {
              const dateStr = toDateStr(day)
              const inMonth = dateStr.startsWith(currentMonthPfx)
              const isTodayDate = isToday(dateStr, today)
              const dayEvents = getEventsForDay(dateStr, allEvents)
              // For multi-day events show dot only on start day or first cell of row
              const dotEvents = dayEvents.filter(e => !e.endDate || e.date === dateStr || di === 0)
              const visible = dotEvents.slice(0, 3)
              const overflow = dotEvents.length - 3

              return (
                <button
                  key={di}
                  onClick={() => onDayClick(dateStr)}
                  className="flex flex-col items-center pt-1 pb-0.5 rounded-xl"
                  style={{
                    opacity: inMonth ? 1 : 0.3,
                    background: isTodayDate ? '#FFE5E5' : 'transparent',
                  }}
                >
                  <span className="text-xs leading-none mb-1" style={{
                    color: isTodayDate ? '#FF6B6B' : '#2D1B1B',
                    fontWeight: isTodayDate ? 700 : 500,
                  }}>
                    {day.getDate()}
                  </span>
                  <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                    {visible.map(e => (
                      <div
                        key={e.id}
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: e.faded ? e.color + '88' : e.color }}
                      />
                    ))}
                    {overflow > 0 && (
                      <span className="text-[8px] font-bold leading-none" style={{ color: '#B08585' }}>+{overflow}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ anchor, today, allEvents, onDayClick }: {
  anchor: Date; today: string; allEvents: CalEvent[]; onDayClick: (d: string) => void
}) {
  const days = getWeekDays(anchor)
  return (
    <div className="flex gap-1.5 h-full px-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {days.map(day => {
        const dateStr = toDateStr(day)
        const isTodayDate = isToday(dateStr, today)
        const dayEvents = getEventsForDay(dateStr, allEvents)
        return (
          <div
            key={dateStr}
            onClick={() => onDayClick(dateStr)}
            className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden cursor-pointer"
            style={{ minWidth: 72, background: isTodayDate ? '#FFE5E5' : '#F5EDE8' }}
          >
            <div className="text-center py-2.5 flex-shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isTodayDate ? '#FF6B6B' : '#B08585' }}>
                {day.toLocaleDateString('en-GB', { weekday: 'short' })}
              </p>
              <p className="text-lg font-bold leading-tight" style={{ color: isTodayDate ? '#FF6B6B' : '#2D1B1B' }}>
                {day.getDate()}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-1 pb-2 space-y-1" style={{ scrollbarWidth: 'none' }}>
              {dayEvents.map(e => (
                <div
                  key={e.id}
                  className="px-1.5 py-1 rounded-lg text-[9px] font-semibold leading-tight"
                  style={{ background: e.bg, color: e.color, opacity: e.faded ? 0.65 : 1 }}
                >
                  {e.time && <span className="block opacity-70 mb-0.5">{e.time}</span>}
                  <span className="line-clamp-2">{e.title}</span>
                </div>
              ))}
              {dayEvents.length === 0 && (
                <p className="text-center text-[9px] mt-3" style={{ color: '#D4B5B5' }}>—</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Agenda View ───────────────────────────────────────────────────────────────

function AgendaView({ allEvents, today, userName, onEventClick }: {
  allEvents: CalEvent[]; today: string; userName: string
  onEventClick: (e: CalEvent) => void
}) {
  const endStr = (() => { const d = new Date(); d.setDate(d.getDate() + 90); return toDateStr(d) })()

  const grouped: Record<string, CalEvent[]> = {}
  for (const e of allEvents) {
    const dates = e.endDate ? expandDateRange(e.date, e.endDate) : [e.date]
    for (const d of dates) {
      if (d < today || d > endStr) continue
      if (!grouped[d]) grouped[d] = []
      // Avoid duplicate multi-day entries with same event id
      if (!grouped[d].find(x => x.id === e.id)) grouped[d].push(e)
    }
  }

  const sortedDates = Object.keys(grouped).sort()

  if (sortedDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full pb-16 px-8 text-center">
        <div className="text-5xl mb-4">🗓️</div>
        <p className="text-base font-semibold mb-1" style={{ color: '#2D1B1B' }}>
          Nothing planned yet this month, {userName} —
        </p>
        <p className="text-sm" style={{ color: '#B08585' }}>add your first date night or mark a visit</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full px-4 pb-6">
      {sortedDates.map(dateStr => {
        const d = new Date(dateStr)
        const isTodayDate = dateStr === today
        return (
          <div key={dateStr} className="mb-5">
            <p
              className="text-xs font-bold mb-2 py-1 sticky top-0"
              style={{ color: isTodayDate ? '#FF6B6B' : '#B08585', background: '#FFFAF7' }}
            >
              {isTodayDate ? 'Today · ' : ''}
              {d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="space-y-2">
              {grouped[dateStr]
                .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
                .map(e => (
                  <button
                    key={e.id} onClick={() => onEventClick(e)}
                    className="w-full flex items-start gap-3 p-3 rounded-2xl text-left"
                    style={{ background: e.bg, opacity: e.faded ? 0.75 : 1 }}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug truncate" style={{ color: e.color }}>
                        {e.title}
                      </p>
                      {e.time && (
                        <p className="text-xs mt-0.5" style={{ color: e.color + 'AA' }}>{e.time}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Day Panel ─────────────────────────────────────────────────────────────────

function DayPanel({ dateStr, events, onClose, onEventClick }: {
  dateStr: string; events: CalEvent[]
  onClose: () => void; onEventClick: (e: CalEvent) => void
}) {
  const d = new Date(dateStr)
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      style={{ background: 'rgba(45,27,27,0.2)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl flex flex-col overflow-hidden"
        style={{ background: '#FFFAF7', maxHeight: '65vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B08585' }}>
              {d.toLocaleDateString('en-GB', { weekday: 'long' })}
            </p>
            <p className="text-xl font-bold" style={{ color: '#2D1B1B' }}>
              {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose}><X size={20} style={{ color: '#B08585' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#B08585' }}>Free day — nothing scheduled 🌿</p>
          ) : (
            events.map(e => (
              <button
                key={e.id} onClick={() => onEventClick(e)}
                className="w-full flex items-start gap-3 p-3 rounded-2xl text-left"
                style={{ background: e.bg, opacity: e.faded ? 0.8 : 1 }}
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.color }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: e.color }}>{e.title}</p>
                  {e.time && <p className="text-xs mt-0.5" style={{ color: e.color + 'AA' }}>{e.time}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Event Detail ──────────────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  function renderMeta() {
    if (event.type === 'visit') {
      const v = event.meta as Visit
      return <>
        <MetaRow label="Status" value={v.status === 'confirmed' ? '✅ Confirmed' : '⏳ Proposed'} />
        <MetaRow label="When" value={fmtShort(v.start_date) + (v.end_date && v.end_date !== v.start_date ? ` – ${fmtShort(v.end_date)}` : '')} />
        {v.notes && <MetaRow label="Notes" value={v.notes} />}
      </>
    }
    if (event.type === 'milestone') {
      const m = event.meta as Milestone
      return <>
        <MetaRow label="Track" value={m.track.replace(/_/g, ' ')} />
        <MetaRow label="Status" value={m.status.replace(/_/g, ' ')} />
        {m.target_date && <MetaRow label="Target" value={fmtShort(m.target_date)} />}
        {m.definition_of_done && <MetaRow label="Done when" value={m.definition_of_done} />}
      </>
    }
    if (event.type === 'task') {
      const t = event.meta as Task
      return <>
        <MetaRow label="Status" value={t.status.replace(/_/g, ' ')} />
        {t.due_date && <MetaRow label="Due" value={fmtShort(t.due_date)} />}
        {t.tags.length > 0 && <MetaRow label="Tags" value={t.tags.join(', ')} />}
      </>
    }
    if (event.type === 'moment') {
      const mo = event.meta as Moment
      return <>
        {mo.date_time && <MetaRow label="When" value={new Date(mo.date_time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} />}
        <MetaRow label="Idea" value={mo.idea_text} />
        <MetaRow label="Confirmed" value={mo.confirmed ? 'Yes' : 'Not yet'} />
      </>
    }
    if (event.type === 'recurring') {
      const re = event.meta as RecurringEvent
      return <>
        <MetaRow label="Repeats" value={re.recurrence} />
        {re.time && <MetaRow label="Time" value={re.time} />}
        {re.description && <MetaRow label="Notes" value={re.description} />}
      </>
    }
    if (event.type === 'oneoff') {
      const e = event.meta as OneOffEvent
      return <>
        <MetaRow label="Date" value={fmtShort(e.date)} />
        {e.time && <MetaRow label="Time" value={e.time} />}
        {e.notes && <MetaRow label="Notes" value={e.notes} />}
      </>
    }
    return null
  }

  const typeLabel: Record<EventType, string> = {
    visit: 'Visit', moment: 'Date night', milestone: 'Milestone',
    task: 'Task', recurring: 'Recurring', oneoff: 'Event',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(45,27,27,0.2)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl overflow-hidden"
        style={{ background: '#FFFAF7' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4" style={{ background: event.bg }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: event.color }}>
                {typeLabel[event.type]} · {fmtShort(event.date)}
              </p>
              <h2 className="text-xl font-bold leading-snug" style={{ color: '#2D1B1B' }}>
                {event.title}
              </h2>
            </div>
            <button onClick={onClose} className="flex-shrink-0 mt-0.5">
              <X size={20} style={{ color: '#B08585' }} />
            </button>
          </div>
        </div>
        <div className="px-5 pt-4 pb-8 space-y-2">
          {renderMeta()}
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs w-16 flex-shrink-0 mt-0.5 font-semibold" style={{ color: '#B08585' }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: '#2D1B1B' }}>{value}</span>
    </div>
  )
}
