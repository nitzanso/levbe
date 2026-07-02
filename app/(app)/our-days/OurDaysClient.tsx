'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nickname, partnerNick } from '@/lib/nicknames'
import { Plus, X, Image, Pen, Star, Smile, AlignLeft, ChevronDown, ChevronUp } from 'lucide-react'
import ReactionsBar from '@/components/ReactionsBar'
import CommentThread from '@/components/CommentThread'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayEntry {
  id: string
  date: string
  author: string
  type: 'highlight' | 'photo' | 'doodle' | 'proud' | 'mood'
  text: string | null
  image_url: string | null
  drawing_data: string | null
  mood_emoji: string | null
  created_at: string
}

interface Props {
  userId: string
  userEmail: string
  userName: string
  entries: DayEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_EMOJIS = ['😔', '😕', '😐', '🙂', '😊', '🥰']
const DRAW_COLORS = ['#FF6B6B', '#FF9F7F', '#FFD93D', '#4ECDC4', '#6C5CE7', '#2D3436', '#FFFFFF']
const BRUSH_SIZES = [2, 5, 11]
const PHOTO_URL = (path: string) =>
  path.startsWith('data:') || path.startsWith('http')
    ? path
    : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`

type AddMode = 'highlight' | 'photo' | 'doodle' | 'proud' | 'mood' | null

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = localDateStr(new Date())
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function typeLabel(type: string) {
  const MAP: Record<string, string> = {
    highlight: '✨ Highlight', photo: '📷 Photo', doodle: '🎨 Doodle',
    proud: '🌟 Proud moment', mood: '😊 Mood',
  }
  return MAP[type] ?? type
}

// ─── Drawing canvas helpers ───────────────────────────────────────────────────

function CanvasBoard({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [color, setColor] = useState(DRAW_COLORS[0])
  const [size, setSize] = useState(BRUSH_SIZES[1])
  const [erasing, setErasing] = useState(false)

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) }
    }
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getPos(e)
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'
    ctx.strokeStyle = erasing ? 'rgba(0,0,0,1)' : color
    ctx.lineWidth = erasing ? size * 3 : size
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPos.current = pos
    setHasDrawing(true)
  }
  function endDraw() { setIsDrawing(false); lastPos.current = null }

  function handleSave() {
    const c = canvasRef.current!
    const off = document.createElement('canvas')
    off.width = c.width; off.height = c.height
    const octx = off.getContext('2d')!
    octx.fillStyle = '#FFFAF7'; octx.fillRect(0, 0, off.width, off.height)
    octx.drawImage(c, 0, 0)
    onSave(off.toDataURL('image/png'))
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef} width={640} height={320}
        className="w-full rounded-2xl border touch-none"
        style={{ background: '#FFFAF7', borderColor: '#F5EDE8', cursor: erasing ? 'cell' : 'crosshair' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {DRAW_COLORS.map(c => (
          <button key={c} onClick={() => { setColor(c); setErasing(false) }}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{ background: c === '#FFFFFF' ? '#f0f0f0' : c, borderColor: color === c && !erasing ? '#FF6B6B' : 'transparent' }} />
        ))}
        <div className="w-px h-5 mx-1" style={{ background: '#F5EDE8' }} />
        {BRUSH_SIZES.map(s => (
          <button key={s} onClick={() => { setSize(s); setErasing(false) }}
            className="rounded-full transition-transform hover:scale-110 flex items-center justify-center"
            style={{ width: 28, height: 28, background: size === s && !erasing ? '#FFE5E5' : '#F5EDE8' }}>
            <div className="rounded-full bg-gray-700" style={{ width: s + 4, height: s + 4 }} />
          </button>
        ))}
        <button onClick={() => setErasing(e => !e)}
          className="px-3 py-1 rounded-xl text-xs font-semibold"
          style={{ background: erasing ? '#FFE5E5' : '#F5EDE8', color: erasing ? '#FF6B6B' : '#7A5C5C' }}>
          Erase
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!hasDrawing}
          className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white transition-opacity"
          style={{ background: '#FF6B6B', opacity: hasDrawing ? 1 : 0.4 }}>
          Save doodle
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-2xl text-sm font-semibold"
          style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, userId, userName }: { entry: DayEntry; userId: string; userName: string }) {
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)
  const isMe = entry.author === userId
  const authorLabel = isMe ? myNick : pNick

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #F5EDE8' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#FF6B6B' }}>{typeLabel(entry.type)}</span>
        <span className="text-xs" style={{ color: '#B08585' }}>
          {authorLabel} · {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="px-4 pb-3">
        {entry.type === 'mood' && (
          <div className="flex items-center gap-2">
            <span className="text-3xl">{entry.mood_emoji}</span>
            {entry.text && <span className="text-sm" style={{ color: '#7A5C5C' }}>{entry.text}</span>}
          </div>
        )}
        {entry.type === 'photo' && entry.image_url && (
          <img src={PHOTO_URL(entry.image_url)} alt="" className="w-full rounded-xl max-h-80 object-cover" />
        )}
        {entry.type === 'doodle' && entry.drawing_data && (
          <img src={entry.drawing_data} alt="doodle" className="w-full rounded-xl max-h-64 object-contain" style={{ background: '#FFFAF7' }} />
        )}
        {(entry.type === 'highlight' || entry.type === 'proud') && entry.text && (
          <p className="text-sm leading-relaxed" style={{ color: '#2D1B1B' }}>{entry.text}</p>
        )}
        {entry.text && (entry.type === 'photo' || entry.type === 'doodle') && (
          <p className="text-sm mt-2" style={{ color: '#7A5C5C' }}>{entry.text}</p>
        )}
      </div>
      <div className="px-4 pb-3 border-t" style={{ borderColor: '#F5EDE8' }}>
        <ReactionsBar entityType="day_entry" entityId={entry.id} userId={userId} />
        <CommentThread entityType="day_entry" entityId={entry.id} userId={userId} myNick={myNick} partnerNick={pNick} />
      </div>
    </div>
  )
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  dateStr, entries, isToday, userId, userName, onAddEntry
}: {
  dateStr: string; entries: DayEntry[]; isToday: boolean
  userId: string; userName: string
  onAddEntry?: () => void
}) {
  const [expanded, setExpanded] = useState(isToday)
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)

  const preview = entries[0]
  const hasPhoto = entries.some(e => e.type === 'photo')
  const moods = entries.filter(e => e.type === 'mood')

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: isToday ? '#FFFAF7' : '#FFFFFF', border: `1px solid ${isToday ? '#FFE5E5' : '#F5EDE8'}` }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => !isToday && setExpanded(e => !e)}
        style={{ cursor: isToday ? 'default' : 'pointer' }}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-base font-bold" style={{ color: isToday ? '#FF6B6B' : '#2D1B1B' }}>
            {fmtDay(dateStr)}
          </span>
          {!expanded && entries.length > 0 && (
            <span className="text-xs" style={{ color: '#B08585' }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {moods.length > 0 && ' · ' + moods.map(m => m.mood_emoji).join('')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isToday && onAddEntry && (
            <button
              onClick={onAddEntry}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ background: '#FF6B6B' }}
            >
              <Plus size={16} />
            </button>
          )}
          {!isToday && (
            expanded ? <ChevronUp size={18} style={{ color: '#B08585' }} /> : <ChevronDown size={18} style={{ color: '#B08585' }} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {entries.length === 0 && isToday && (
            <p className="text-sm text-center py-4" style={{ color: '#B08585' }}>
              Nothing added yet — tap the buttons below to share your day ✨
            </p>
          )}
          {entries.map(e => (
            <EntryCard key={e.id} entry={e} userId={userId} userName={userName} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add entry panel ──────────────────────────────────────────────────────────

function AddPanel({
  mode, userId, userName, todayStr,
  onClose, onSaved,
}: {
  mode: AddMode; userId: string; userName: string; todayStr: string
  onClose: () => void; onSaved: (entry: DayEntry) => void
}) {
  const supabase = createClient()
  const myNick = nickname(userName)
  const [text, setText] = useState('')
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  async function save(drawingData?: string) {
    setSaving(true); setErr('')
    try {
      let image_url: string | null = null

      if (mode === 'photo' && photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `days/${userId}/${Date.now()}.${ext}`
        const { error: storErr } = await supabase.storage.from('photos').upload(path, photoFile, { cacheControl: '31536000' })
        if (storErr) throw storErr
        image_url = path
      }

      const row: Record<string, unknown> = {
        date: todayStr,
        author: userId,
        type: mode,
        text: text.trim() || null,
        image_url,
        drawing_data: drawingData ?? null,
        mood_emoji: moodEmoji,
      }

      const { data, error } = await supabase.from('day_entries').insert(row).select().single()
      if (error) throw error

      // Fire-and-forget notification
      fetch('/api/day-entry/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: data.id, type: mode }),
      }).catch(() => {})

      onSaved(data as DayEntry)
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    }
    setSaving(false)
  }

  if (mode === 'doodle') {
    return (
      <div className="rounded-3xl p-5" style={{ background: '#FFFAF7', border: '1px solid #FFE5E5' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#2D1B1B' }}>Draw something for Jensi</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#B08585' }} /></button>
        </div>
        <CanvasBoard onSave={save} onCancel={onClose} />
      </div>
    )
  }

  if (mode === 'mood') {
    return (
      <div className="rounded-3xl p-5" style={{ background: '#FFFAF7', border: '1px solid #FFE5E5' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#2D1B1B' }}>How are you feeling, {myNick}?</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#B08585' }} /></button>
        </div>
        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          {MOOD_EMOJIS.map(e => (
            <button key={e} onClick={() => setMoodEmoji(e)}
              className="text-3xl rounded-2xl p-2 transition-all"
              style={{ background: moodEmoji === e ? '#FFE5E5' : 'transparent', transform: moodEmoji === e ? 'scale(1.2)' : 'scale(1)' }}>
              {e}
            </button>
          ))}
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Anything you want to say about it? (optional)"
          rows={2}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none mb-3"
          style={{ background: '#FFFFFF', border: '1px solid #F5EDE8', color: '#2D1B1B' }}
        />
        {err && <p className="text-xs mb-2" style={{ color: '#E85555' }}>{err}</p>}
        <button onClick={() => save()} disabled={!moodEmoji || saving}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-opacity"
          style={{ background: '#FF6B6B', opacity: moodEmoji && !saving ? 1 : 0.4 }}>
          {saving ? 'Sharing…' : 'Share mood'}
        </button>
      </div>
    )
  }

  if (mode === 'photo') {
    return (
      <div className="rounded-3xl p-5" style={{ background: '#FFFAF7', border: '1px solid #FFE5E5' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#2D1B1B' }}>Add a photo from today</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#B08585' }} /></button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            setPhotoFile(f)
            const reader = new FileReader()
            reader.onload = r => setPhotoPreview(r.target?.result as string)
            reader.readAsDataURL(f)
          }}
        />
        {photoPreview ? (
          <img src={photoPreview} className="w-full rounded-2xl max-h-64 object-cover mb-3" />
        ) : (
          <button onClick={() => photoRef.current?.click()}
            className="w-full h-40 rounded-2xl flex flex-col items-center justify-center gap-2 mb-3"
            style={{ background: '#FFF5F5', border: '2px dashed #FFB3B3' }}>
            <Image size={28} style={{ color: '#FF6B6B' }} />
            <span className="text-sm" style={{ color: '#B08585' }}>Tap to choose a photo</span>
          </button>
        )}
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a caption… (optional)"
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none mb-3"
          style={{ background: '#FFFFFF', border: '1px solid #F5EDE8', color: '#2D1B1B' }} />
        {err && <p className="text-xs mb-2" style={{ color: '#E85555' }}>{err}</p>}
        <div className="flex gap-2">
          {photoPreview && (
            <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
              className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: '#F5EDE8', color: '#7A5C5C' }}>
              Change
            </button>
          )}
          <button onClick={() => save()} disabled={!photoFile || saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-opacity"
            style={{ background: '#FF6B6B', opacity: photoFile && !saving ? 1 : 0.4 }}>
            {saving ? 'Uploading…' : 'Add photo'}
          </button>
        </div>
      </div>
    )
  }

  // highlight + proud — simple text input
  const placeholder = mode === 'highlight'
    ? `What happened today, ${myNick}? A moment, a feeling, anything…`
    : `What are you proud of today, ${myNick}?`

  return (
    <div className="rounded-3xl p-5" style={{ background: '#FFFAF7', border: '1px solid #FFE5E5' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: '#2D1B1B' }}>
          {mode === 'highlight' ? '✨ Share a highlight' : '🌟 Proud moment'}
        </h3>
        <button onClick={onClose}><X size={18} style={{ color: '#B08585' }} /></button>
      </div>
      <textarea
        autoFocus value={text} onChange={e => setText(e.target.value)}
        placeholder={placeholder} rows={4}
        className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none mb-3"
        style={{ background: '#FFFFFF', border: '1px solid #F5EDE8', color: '#2D1B1B' }} />
      {err && <p className="text-xs mb-2" style={{ color: '#E85555' }}>{err}</p>}
      <button onClick={() => save()} disabled={!text.trim() || saving}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-opacity"
        style={{ background: '#FF6B6B', opacity: text.trim() && !saving ? 1 : 0.4 }}>
        {saving ? 'Sharing…' : 'Share with Jensi'}
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OurDaysClient({ userId, userEmail, userName, entries: initial }: Props) {
  const myNick = nickname(userName)
  const pNick = partnerNick(userName)
  const todayStr = localDateStr(new Date())

  const [entries, setEntries] = useState<DayEntry[]>(initial)
  const [addMode, setAddMode] = useState<AddMode>(null)

  // Group entries by date, sorted newest first
  const grouped = entries.reduce<Record<string, DayEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  // Ensure today always appears even if empty
  if (!grouped[todayStr]) grouped[todayStr] = []

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function handleSaved(entry: DayEntry) {
    setEntries(prev => {
      const without = prev.filter(e => e.id !== entry.id)
      return [...without, entry].sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date)
        return a.created_at.localeCompare(b.created_at)
      })
    })
  }

  const ADD_BUTTONS = [
    { mode: 'highlight' as AddMode, icon: AlignLeft, label: 'Highlight' },
    { mode: 'photo' as AddMode,     icon: Image,     label: 'Photo'     },
    { mode: 'doodle' as AddMode,    icon: Pen,       label: 'Doodle'    },
    { mode: 'proud' as AddMode,     icon: Star,      label: 'Proud'     },
    { mode: 'mood' as AddMode,      icon: Smile,     label: 'Mood'      },
  ]

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FFFAF7' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: '#2D1B1B' }}>Our Days</h1>
        <p className="text-sm" style={{ color: '#B08585' }}>
          A shared scrapbook, one day at a time
        </p>
      </div>

      <div className="flex-1 px-4 pb-8 flex flex-col gap-4 max-w-2xl w-full mx-auto">

        {/* Today prompt + add buttons */}
        <div className="rounded-3xl p-5" style={{ background: '#FFF5F5', border: '2px solid #FFE5E5' }}>
          <p className="text-sm font-medium mb-4" style={{ color: '#7A5C5C' }}>
            What was today like, {myNick}? Add something to share with {pNick} 💛
          </p>
          <div className="flex gap-2 flex-wrap">
            {ADD_BUTTONS.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setAddMode(m => m === mode ? null : mode)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-medium transition-all"
                style={{
                  background: addMode === mode ? '#FF6B6B' : '#FFFFFF',
                  color: addMode === mode ? '#FFFFFF' : '#7A5C5C',
                  border: `1px solid ${addMode === mode ? '#FF6B6B' : '#F5EDE8'}`,
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Add panel */}
        {addMode && (
          <AddPanel
            mode={addMode}
            userId={userId}
            userName={userName}
            todayStr={todayStr}
            onClose={() => setAddMode(null)}
            onSaved={handleSaved}
          />
        )}

        {/* Day cards — today first, then past */}
        {sortedDates.map(date => (
          <DayCard
            key={date}
            dateStr={date}
            entries={grouped[date] ?? []}
            isToday={date === todayStr}
            userId={userId}
            userName={userName}
            onAddEntry={date === todayStr ? () => setAddMode('highlight') : undefined}
          />
        ))}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">📖</div>
            <p className="text-base font-semibold mb-1" style={{ color: '#2D1B1B' }}>
              Your shared journal starts today, {myNick}
            </p>
            <p className="text-sm" style={{ color: '#B08585' }}>
              Add a highlight, a photo, or just how you&apos;re feeling —<br />
              {pNick} will see it the moment you do.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
