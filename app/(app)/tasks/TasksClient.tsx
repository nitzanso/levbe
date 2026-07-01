'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, ChevronLeft, ChevronRight, MessageSquare,
  Calendar, AlertTriangle, Check, Trash2, Edit3, Save, ArrowLeft
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'backlog' | 'todo' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  description: string | null
  status: Status
  assignee: string | null
  due_date: string | null
  tags: string[]
  depends_on: string[]
  created_by: string
  created_at: string
  updated_at: string
}

interface TaskComment {
  id: string
  task_id: string
  author: string
  text: string
  created_at: string
}

interface Profile {
  id: string
  name: string
  avatar_color: string
  email: string | null
}

interface Props {
  userEmail: string
  userName: string
  userColor: string
  tasks: Task[]
  allProfiles: Profile[]
}

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { status: Status; label: string; color: string; bg: string; dot: string }[] = [
  { status: 'backlog',     label: 'Backlog',      color: '#B08585', bg: '#F5EDE8', dot: '#D4B5B5' },
  { status: 'todo',        label: 'To do',         color: '#7A5C5C', bg: '#EDE0DB', dot: '#B08585' },
  { status: 'in_progress', label: 'In progress',   color: '#FF6B6B', bg: '#FFE5E5', dot: '#FF6B6B' },
  { status: 'done',        label: 'Done',          color: '#4ECDC4', bg: '#E0F7F5', dot: '#4ECDC4' },
]

const STATUS_ORDER: Status[] = ['backlog', 'todo', 'in_progress', 'done']

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TAG_PALETTES = [
  { bg: '#FFE5E5', text: '#C94040' },
  { bg: '#E0F7F5', text: '#2BA99C' },
  { bg: '#FFF8D6', text: '#B59100' },
  { bg: '#F5EDE8', text: '#7A5C5C' },
  { bg: '#E8EDFF', text: '#4A5FA5' },
  { bg: '#F0E8FF', text: '#7B4FA5' },
  { bg: '#E8FFE8', text: '#2A8A2A' },
]

function tagPalette(tag: string) {
  const hash = [...tag].reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_PALETTES[hash % TAG_PALETTES.length]
}

function avatarColor(email: string) {
  const COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#B08585', '#7A5C5C']
  const hash = [...email].reduce((a, c) => a + c.charCodeAt(0), 0)
  return COLORS[hash % COLORS.length]
}

function initial(email: string) { return email.charAt(0).toUpperCase() }

function isOverdue(due: string | null) {
  if (!due) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(due) < today
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ email, size = 22 }: { email: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, background: avatarColor(email), fontSize: size * 0.45 }}
    >
      {initial(email)}
    </div>
  )
}

function TagPill({ tag }: { tag: string }) {
  const { bg, text } = tagPalette(tag)
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: bg, color: text }}>
      {tag}
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TasksClient({ userEmail, userName, allProfiles, tasks: initialTasks }: Props) {
  const supabase = createClient()

  // Board state
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filterAssignee, setFilterAssignee] = useState<'all' | 'me' | 'partner' | 'unassigned'>('all')
  const [filterTag, setFilterTag] = useState('')
  const [filterSort, setFilterSort] = useState<'created' | 'due'>('created')

  // Add-task form
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<{
    title: string; description: string; status: Status
    assignee: string; due_date: string; tagInput: string
  }>({ title: '', description: '', status: 'todo', assignee: '', due_date: '', tagInput: '' })
  const [addTags, setAddTags] = useState<string[]>([])

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<{
    title: string; description: string; status: Status
    assignee: string; due_date: string; tagInput: string
    tags: string[]; depends_on: string[]
  }>({ title: '', description: '', status: 'todo', assignee: '', due_date: '', tagInput: '', tags: [], depends_on: [] })
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null

  // Fetch comments when task opens
  useEffect(() => {
    if (!selectedId) { setComments([]); return }
    supabase.from('task_comments').select('*')
      .eq('task_id', selectedId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments(data ?? []))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync edit form when selected task changes
  useEffect(() => {
    if (!selectedTask) return
    setEditForm({
      title: selectedTask.title,
      description: selectedTask.description ?? '',
      status: selectedTask.status,
      assignee: selectedTask.assignee ?? '',
      due_date: selectedTask.due_date ?? '',
      tagInput: '',
      tags: selectedTask.tags ?? [],
      depends_on: selectedTask.depends_on ?? [],
    })
    setEditMode(false)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const allTags = [...new Set(tasks.flatMap(t => t.tags))].sort()

  function isBlocked(task: Task) {
    if (!task.depends_on?.length) return false
    return task.depends_on.some(depId => {
      const dep = tasks.find(t => t.id === depId)
      return dep && dep.status !== 'done'
    })
  }

  function getColumnTasks(status: Status): Task[] {
    let list = tasks.filter(t => t.status === status)
    if (filterAssignee === 'me') list = list.filter(t => t.assignee === userEmail)
    if (filterAssignee === 'partner') list = list.filter(t => t.assignee && t.assignee !== userEmail)
    if (filterAssignee === 'unassigned') list = list.filter(t => !t.assignee)
    if (filterTag) list = list.filter(t => t.tags.includes(filterTag))
    if (filterSort === 'due') {
      list = [...list].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    }
    return list
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  async function moveTask(taskId: string, direction: 'left' | 'right') {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const idx = STATUS_ORDER.indexOf(task.status)
    const nextStatus = direction === 'right' ? STATUS_ORDER[idx + 1] : STATUS_ORDER[idx - 1]
    if (!nextStatus) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t))
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', taskId)
  }

  async function createTask() {
    if (!addForm.title.trim()) return
    const { data, error } = await supabase.from('tasks').insert({
      title: addForm.title.trim(),
      description: addForm.description.trim() || null,
      status: addForm.status,
      assignee: addForm.assignee || null,
      due_date: addForm.due_date || null,
      tags: addTags,
      depends_on: [],
      created_by: userEmail,
    }).select().single()
    if (!error && data) {
      setTasks(prev => [data, ...prev])
    }
    setAddForm({ title: '', description: '', status: 'todo', assignee: '', due_date: '', tagInput: '' })
    setAddTags([])
    setAddOpen(false)
  }

  async function saveEdit() {
    if (!selectedId || !editForm.title.trim()) return
    setSavingEdit(true)
    const patch = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      status: editForm.status,
      assignee: editForm.assignee || null,
      due_date: editForm.due_date || null,
      tags: editForm.tags,
      depends_on: editForm.depends_on,
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', selectedId)
    if (!error) {
      setTasks(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch } : t))
      setEditMode(false)
    }
    setSavingEdit(false)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedId(null)
  }

  async function addComment() {
    if (!commentText.trim() || !selectedId) return
    setSavingComment(true)
    const text = commentText.trim()
    const { data, error } = await supabase.from('task_comments').insert({
      task_id: selectedId,
      author: userEmail,
      text,
    }).select().single()
    if (!error && data) {
      setComments(prev => [...prev, data])
      // Notify task creator if it's not the commenter
      const task = tasks.find(t => t.id === selectedId)
      if (task && task.created_by !== userEmail) {
        fetch('/api/task-comment-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: selectedId, taskTitle: task.title, commentText: text }),
        }).catch(() => {})
      }
    }
    setCommentText('')
    setSavingComment(false)
  }

  // ─── Tag input helpers ──────────────────────────────────────────────────────

  function commitAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = addForm.tagInput.replace(',', '').trim()
      if (tag && !addTags.includes(tag)) setAddTags(prev => [...prev, tag])
      setAddForm(f => ({ ...f, tagInput: '' }))
    }
  }

  function commitEditTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = editForm.tagInput.replace(',', '').trim()
      if (tag && !editForm.tags.includes(tag)) setEditForm(f => ({ ...f, tags: [...f.tags, tag] }))
      setEditForm(f => ({ ...f, tagInput: '' }))
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ background: '#FFFAF7' }}>

      {/* Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Tasks"
          subtitle="Things to do together"
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: '#FF6B6B' }}
            >
              <Plus size={18} color="white" />
            </button>
          }
        />

        {/* Filter bar */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value as typeof filterAssignee)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium outline-none"
            style={{ background: filterAssignee !== 'all' ? '#FFE5E5' : 'white', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
          >
            <option value="all">All assignees</option>
            <option value="me">Mine</option>
            <option value="partner">Partner's</option>
            <option value="unassigned">Unassigned</option>
          </select>

          {/* Tag filter */}
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium outline-none"
            style={{ background: filterTag ? '#FFE5E5' : 'white', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
          >
            <option value="">All tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>

          {/* Sort */}
          <select
            value={filterSort}
            onChange={e => setFilterSort(e.target.value as typeof filterSort)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium outline-none"
            style={{ background: 'white', color: '#2D1B1B', border: '1.5px solid #F5EDE8' }}
          >
            <option value="created">Newest first</option>
            <option value="due">By due date</option>
          </select>
        </div>
      </div>

      {/* Kanban board — horizontal scroll */}
      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-base font-semibold mb-1" style={{ color: '#2D1B1B' }}>
            Nothing to tackle yet, {userName} —
          </p>
          <p className="text-sm mb-6" style={{ color: '#B08585' }}>add your first shared to-do</p>
          <button
            onClick={() => setAddOpen(true)}
            className="px-6 py-3 rounded-2xl font-semibold text-white text-sm"
            style={{ background: '#FF6B6B' }}
          >
            Add something to work on
          </button>
        </div>
      ) : (
      <div
        className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden px-4 pb-4"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {COLUMNS.map(col => {
          const colTasks = getColumnTasks(col.status)
          return (
            <div
              key={col.status}
              className="flex-none flex flex-col rounded-2xl overflow-hidden"
              style={{ width: '82vw', maxWidth: 320, scrollSnapAlign: 'start', background: col.bg }}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                <span
                  className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'white', color: col.color }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Cards — scrollable */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                {colTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs" style={{ color: col.color + '99' }}>Nothing here yet</p>
                  </div>
                )}
                {colTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    colStatus={col.status}
                    userEmail={userEmail}
                    allTasks={tasks}
                    isBlocked={isBlocked(task)}
                    onOpen={() => setSelectedId(task.id)}
                    onMove={dir => moveTask(task.id, dir)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* ─── Add task overlay ──────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFAF7' }}>
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold" style={{ color: '#2D1B1B' }}>New task</h2>
            <button onClick={() => { setAddOpen(false); setAddTags([]) }}>
              <X size={22} style={{ color: '#B08585' }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            <input
              autoFocus
              value={addForm.title}
              onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Task title *"
              className="w-full px-4 py-3 rounded-xl text-base font-medium outline-none"
              style={{ border: '2px solid #FFE5E5', color: '#2D1B1B' }}
            />

            <textarea
              value={addForm.description}
              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            {/* Status */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>STATUS</p>
              <div className="flex gap-2 flex-wrap">
                {COLUMNS.map(c => (
                  <button
                    key={c.status}
                    onClick={() => setAddForm(f => ({ ...f, status: c.status }))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{
                      background: addForm.status === c.status ? c.dot : '#F5EDE8',
                      color: addForm.status === c.status ? 'white' : '#7A5C5C',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>ASSIGNEE</p>
              <AssigneePicker
                value={addForm.assignee}
                onChange={v => setAddForm(f => ({ ...f, assignee: v }))}
                userEmail={userEmail}
                allProfiles={allProfiles}
              />
            </div>

            {/* Due date */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>DUE DATE</p>
              <input
                type="date"
                value={addForm.due_date}
                onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
              />
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>TAGS</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {addTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: tagPalette(tag).bg, color: tagPalette(tag).text }}>
                    {tag}
                    <button onClick={() => setAddTags(prev => prev.filter(t => t !== tag))}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input
                value={addForm.tagInput}
                onChange={e => setAddForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={commitAddTag}
                placeholder="Type a tag, press Enter"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
              />
            </div>
          </div>

          <div className="px-5 pb-8">
            <button
              onClick={createTask}
              disabled={!addForm.title.trim()}
              className="w-full py-4 rounded-2xl font-semibold text-white"
              style={{ background: addForm.title.trim() ? '#FF6B6B' : '#E0E0E0' }}
            >
              Add something to work on
            </button>
          </div>
        </div>
      )}

      {/* ─── Task detail overlay ───────────────────────────────────────────── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFAF7' }}>
          {/* Detail header */}
          <div className="flex items-center justify-between px-5 pt-14 pb-3 flex-shrink-0">
            <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5" style={{ color: '#B08585' }}>
              <ArrowLeft size={18} />
              <span className="text-sm">Board</span>
            </button>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <button onClick={() => setEditMode(false)} className="px-3 py-1.5 rounded-xl text-sm" style={{ background: '#F5EDE8', color: '#7A5C5C' }}>Cancel</button>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit || !editForm.title.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#FF6B6B' }}
                  >
                    <Save size={13} /> Save
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(true)} className="p-2 rounded-xl" style={{ color: '#B08585' }}>
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => deleteTask(selectedTask.id)} className="p-2 rounded-xl" style={{ color: '#B08585' }}>
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {editMode ? (
              /* ─── Edit mode ─── */
              <div className="space-y-4">
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full text-xl font-bold px-4 py-3 rounded-xl outline-none"
                  style={{ border: '2px solid #FFE5E5', color: '#2D1B1B' }}
                />

                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                  style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                />

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>STATUS</p>
                  <div className="flex gap-2 flex-wrap">
                    {COLUMNS.map(c => (
                      <button
                        key={c.status}
                        onClick={() => setEditForm(f => ({ ...f, status: c.status }))}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{
                          background: editForm.status === c.status ? c.dot : '#F5EDE8',
                          color: editForm.status === c.status ? 'white' : '#7A5C5C',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>ASSIGNEE</p>
                  <AssigneePicker
                    value={editForm.assignee}
                    onChange={v => setEditForm(f => ({ ...f, assignee: v }))}
                    userEmail={userEmail}
                    allProfiles={allProfiles}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>DUE DATE</p>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>TAGS</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editForm.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: tagPalette(tag).bg, color: tagPalette(tag).text }}>
                        {tag}
                        <button onClick={() => setEditForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={editForm.tagInput}
                    onChange={e => setEditForm(f => ({ ...f, tagInput: e.target.value }))}
                    onKeyDown={commitEditTag}
                    placeholder="Type a tag, press Enter"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>BLOCKED BY (depends on)</p>
                  <div className="space-y-1 rounded-xl overflow-hidden" style={{ border: '1.5px solid #F5EDE8' }}>
                    {tasks.filter(t => t.id !== selectedTask.id).length === 0 && (
                      <p className="px-4 py-3 text-sm" style={{ color: '#B08585' }}>No other tasks yet</p>
                    )}
                    {tasks.filter(t => t.id !== selectedTask.id).map(t => (
                      <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FFFAF7] cursor-pointer" style={{ background: 'white' }}>
                        <input
                          type="checkbox"
                          checked={editForm.depends_on.includes(t.id)}
                          onChange={e => setEditForm(f => ({
                            ...f,
                            depends_on: e.target.checked
                              ? [...f.depends_on, t.id]
                              : f.depends_on.filter(d => d !== t.id)
                          }))}
                          className="accent-[#FF6B6B]"
                        />
                        <div>
                          <span className="text-sm" style={{ color: t.status === 'done' ? '#B08585' : '#2D1B1B', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                            {t.title}
                          </span>
                          {t.status === 'done' && <span className="ml-2 text-[10px] text-[#4ECDC4]">✓ done</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ─── View mode ─── */
              <div className="space-y-4">
                {/* Title + status badge */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold leading-snug" style={{ color: '#2D1B1B' }}>{selectedTask.title}</h2>
                  </div>
                  <StatusBadge status={selectedTask.status} />
                </div>

                {/* Description */}
                {selectedTask.description && (
                  <p className="text-sm leading-relaxed" style={{ color: '#7A5C5C' }}>{selectedTask.description}</p>
                )}

                {/* Meta grid */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1.5px solid #F5EDE8' }}>
                  {selectedTask.assignee && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#F5EDE8' }}>
                      <span className="text-xs w-20 flex-shrink-0" style={{ color: '#B08585' }}>Assignee</span>
                      <div className="flex items-center gap-2">
                        <Avatar email={selectedTask.assignee} size={20} />
                        <span className="text-sm" style={{ color: '#2D1B1B' }}>
                          {selectedTask.assignee === userEmail ? 'You' : nameFromEmail(selectedTask.assignee, allProfiles)}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedTask.due_date && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F5EDE8' }}>
                      <span className="text-xs w-20 flex-shrink-0" style={{ color: '#B08585' }}>Due</span>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} style={{ color: isOverdue(selectedTask.due_date) ? '#E85555' : '#B08585' }} />
                        <span className="text-sm" style={{ color: isOverdue(selectedTask.due_date) ? '#E85555' : '#2D1B1B' }}>
                          {fmtDate(selectedTask.due_date)}
                          {isOverdue(selectedTask.due_date) && ' — overdue'}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedTask.tags.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F5EDE8' }}>
                      <span className="text-xs w-20 flex-shrink-0" style={{ color: '#B08585' }}>Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTask.tags.map(tag => <TagPill key={tag} tag={tag} />)}
                      </div>
                    </div>
                  )}
                  {selectedTask.depends_on.length > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: '1px solid #F5EDE8' }}>
                      <span className="text-xs w-20 flex-shrink-0 mt-0.5" style={{ color: '#B08585' }}>Blocked by</span>
                      <div className="space-y-1">
                        {selectedTask.depends_on.map(depId => {
                          const dep = tasks.find(t => t.id === depId)
                          if (!dep) return null
                          return (
                            <div key={depId} className="flex items-center gap-1.5">
                              <span className="text-sm" style={{ color: dep.status === 'done' ? '#4ECDC4' : '#E85555', textDecoration: dep.status === 'done' ? 'line-through' : 'none' }}>
                                {dep.title}
                              </span>
                              {dep.status === 'done' && <Check size={11} style={{ color: '#4ECDC4' }} />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick status movement */}
                <div className="flex gap-2">
                  {STATUS_ORDER.indexOf(selectedTask.status) > 0 && (
                    <button
                      onClick={() => moveTask(selectedTask.id, 'left').then(() => setSelectedId(null))}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: '#F5EDE8', color: '#7A5C5C' }}
                    >
                      <ChevronLeft size={14} />
                      {COLUMNS[STATUS_ORDER.indexOf(selectedTask.status) - 1].label}
                    </button>
                  )}
                  {STATUS_ORDER.indexOf(selectedTask.status) < STATUS_ORDER.length - 1 && (
                    <button
                      onClick={() => moveTask(selectedTask.id, 'right').then(() => setSelectedId(null))}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{ background: COLUMNS[STATUS_ORDER.indexOf(selectedTask.status) + 1].dot }}
                    >
                      Move to {COLUMNS[STATUS_ORDER.indexOf(selectedTask.status) + 1].label}
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>

                {/* Comment thread */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={14} style={{ color: '#B08585' }} />
                    <p className="text-sm font-semibold" style={{ color: '#2D1B1B' }}>Comments</p>
                    {comments.length > 0 && <span className="text-xs" style={{ color: '#B08585' }}>({comments.length})</span>}
                  </div>

                  <div className="space-y-2 mb-3">
                    {comments.length === 0 && (
                      <p className="text-sm" style={{ color: '#B08585' }}>No comments yet</p>
                    )}
                    {comments.map(c => {
                      const isMe = c.author === userEmail
                      return (
                        <div key={c.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className="max-w-[85%] rounded-2xl px-3 py-2"
                            style={{
                              background: isMe ? '#FFE5E5' : '#F5EDE8',
                              borderBottomRightRadius: isMe ? 4 : undefined,
                              borderBottomLeftRadius: !isMe ? 4 : undefined,
                            }}
                          >
                            <p className="text-sm" style={{ color: '#2D1B1B' }}>{c.text}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#B08585' }}>
                              {isMe ? 'You' : nameFromEmail(c.author, allProfiles)} · {timeAgo(c.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                      placeholder="Add a comment…"
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
                    />
                    <button
                      onClick={addComment}
                      disabled={!commentText.trim() || savingComment}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                      style={{ background: commentText.trim() ? '#FF6B6B' : '#E0E0E0' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, colStatus, userEmail, allTasks, isBlocked, onOpen, onMove
}: {
  task: Task
  colStatus: Status
  userEmail: string
  allTasks: Task[]
  isBlocked: boolean
  onOpen: () => void
  onMove: (dir: 'left' | 'right') => void
}) {
  const overdue = isOverdue(task.due_date)
  const idx = STATUS_ORDER.indexOf(colStatus)

  return (
    <div
      className="rounded-xl p-3 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
      style={{ background: 'white' }}
      onClick={onOpen}
    >
      {/* Blocked banner */}
      {isBlocked && (
        <div className="flex items-center gap-1 mb-2 text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#FFF3CD', color: '#B59100' }}>
          <AlertTriangle size={9} />
          Blocked
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-semibold leading-snug mb-2" style={{ color: '#2D1B1B' }}>{task.title}</p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(tag => <TagPill key={tag} tag={tag} />)}
          {task.tags.length > 3 && <span className="text-[10px]" style={{ color: '#B08585' }}>+{task.tags.length - 3}</span>}
        </div>
      )}

      {/* Footer: due date + assignee + move buttons */}
      <div className="flex items-center justify-between mt-1" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.due_date && (
            <div className="flex items-center gap-1">
              <Calendar size={11} style={{ color: overdue ? '#E85555' : '#B08585' }} />
              <span className="text-[10px] font-medium" style={{ color: overdue ? '#E85555' : '#B08585' }}>
                {fmtDate(task.due_date)}
              </span>
            </div>
          )}
          {/* Assignee */}
          {task.assignee && <Avatar email={task.assignee} size={18} />}
        </div>

        {/* Quick move buttons */}
        <div className="flex gap-1">
          {idx > 0 && (
            <button
              className="p-1 rounded-lg transition-colors"
              style={{ background: '#F5EDE8', color: '#B08585' }}
              onClick={() => onMove('left')}
              title="Move left"
            >
              <ChevronLeft size={12} />
            </button>
          )}
          {idx < STATUS_ORDER.length - 1 && (
            <button
              className="p-1 rounded-lg transition-colors"
              style={{ background: '#FFE5E5', color: '#FF6B6B' }}
              onClick={() => onMove('right')}
              title="Move right"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const col = COLUMNS.find(c => c.status === status)!
  return (
    <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: col.bg, color: col.color }}>
      {col.label}
    </span>
  )
}

// ─── AssigneePicker ──────────────────────────────────────────────────────────

function AssigneePicker({ value, onChange, userEmail, allProfiles }: {
  value: string; onChange: (v: string) => void
  userEmail: string; allProfiles: { email: string | null; name: string }[]
}) {
  const others = allProfiles.filter(p => p.email && p.email !== userEmail)

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange('')}
        className="px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors"
        style={{
          borderColor: !value ? '#FF6B6B' : '#F5EDE8',
          background: !value ? '#FFE5E5' : 'white',
          color: !value ? '#FF6B6B' : '#7A5C5C',
        }}
      >
        Unassigned
      </button>
      <button
        onClick={() => onChange(userEmail)}
        className="px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors flex items-center gap-1.5"
        style={{
          borderColor: value === userEmail ? '#FF6B6B' : '#F5EDE8',
          background: value === userEmail ? '#FFE5E5' : 'white',
          color: value === userEmail ? '#FF6B6B' : '#7A5C5C',
        }}
      >
        <Avatar email={userEmail} size={16} /> Me
      </button>
      {others.map(p => (
        <button
          key={p.email}
          onClick={() => onChange(p.email!)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors flex items-center gap-1.5"
          style={{
            borderColor: value === p.email ? '#FF6B6B' : '#F5EDE8',
            background: value === p.email ? '#FFE5E5' : 'white',
            color: value === p.email ? '#FF6B6B' : '#7A5C5C',
          }}
        >
          <Avatar email={p.email!} size={16} /> {p.name}
        </button>
      ))}
    </div>
  )
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function nameFromEmail(email: string, profiles: { email: string | null; name: string }[]) {
  const p = profiles.find(p => p.email === email)
  return p?.name ?? email.split('@')[0]
}
