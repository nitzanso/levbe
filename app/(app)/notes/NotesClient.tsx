'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pen, Type } from 'lucide-react'
import { nickname, partnerNick } from '@/lib/nicknames'
import ReactionsBar from '@/components/ReactionsBar'
import CommentThread from '@/components/CommentThread'

interface Note {
  id: string
  author: string
  type: string
  content: string
  created_at: string
}

interface Props {
  userId: string
  userEmail: string
  userName: string
  notes: Note[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotesClient({ userId, userEmail, userName, notes }: Props) {
  const pNick = partnerNick(userName)
  const myNick = nickname(userName)
  const [composing, setComposing] = useState<'note' | 'drawing' | null>(null)
  const [noteText, setNoteText] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) }
    }
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    setIsDrawing(true)
    lastPos.current = getPos(e)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getPos(e)
    ctx.strokeStyle = '#FF6B6B'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasDrawing(true)
  }

  function endDraw() {
    setIsDrawing(false)
    lastPos.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  async function saveNote() {
    if (!noteText.trim()) return
    startTransition(async () => {
      const { data } = await supabase.from('notes_and_doodles').insert({
        author: userEmail,
        type: 'note',
        content: noteText.trim(),
      }).select().single()
      setNoteText('')
      setComposing(null)
      router.refresh()
      setSuccessMsg(`On its way to ${pNick} ✏️`)
      setTimeout(() => setSuccessMsg(''), 3000)
      if (data) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'activity', activityType: 'note', noteType: 'note', relatedEntity: `note:${data.id}` }),
        }).catch(() => {})
      }
    })
  }

  async function saveDrawing() {
    const canvas = canvasRef.current!
    const content = canvas.toDataURL('image/png')
    startTransition(async () => {
      const { data } = await supabase.from('notes_and_doodles').insert({
        author: userEmail,
        type: 'drawing',
        content,
      }).select().single()
      clearCanvas()
      setComposing(null)
      router.refresh()
      setSuccessMsg(`On its way to ${pNick} ✏️`)
      setTimeout(() => setSuccessMsg(''), 3000)
      if (data) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'activity', activityType: 'note', noteType: 'drawing', relatedEntity: `note:${data.id}` }),
        }).catch(() => {})
      }
    })
  }

  return (
    <div className="pb-6">
      {successMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white"
          style={{ background: '#FF6B6B' }}>
          {successMsg}
        </div>
      )}

      <PageHeader
        title="Notes & doodles"
        subtitle={`Leave ${pNick} a little something`}
        action={
          <button
            onClick={() => setComposing('note')}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#FF6B6B' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* Compose panel */}
      {composing && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFAF7' }}>
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setComposing('note')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ background: composing === 'note' ? '#FF6B6B' : '#F5EDE8', color: composing === 'note' ? 'white' : '#7A5C5C' }}
              >
                <Type size={14} /> Note
              </button>
              <button
                onClick={() => setComposing('drawing')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ background: composing === 'drawing' ? '#4ECDC4' : '#F5EDE8', color: composing === 'drawing' ? 'white' : '#7A5C5C' }}
              >
                <Pen size={14} /> Doodle
              </button>
            </div>
            <button onClick={() => { setComposing(null); clearCanvas(); setNoteText('') }}>
              <X size={22} style={{ color: '#B08585' }} />
            </button>
          </div>

          <div className="flex-1 px-5">
            {composing === 'note' ? (
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={`Write something for ${pNick}…`}
                className="w-full h-48 text-lg resize-none outline-none rounded-2xl p-4 font-handwriting"
                style={{ background: 'white', color: '#2D1B1B', border: '2px solid #FFE5E5' }}
                autoFocus
              />
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '2px solid #E0F7F5' }}>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={500}
                  className="w-full touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                  style={{ cursor: 'crosshair' }}
                />
              </div>
            )}
          </div>

          <div className="px-5 pb-8 pt-4 flex gap-3">
            {composing === 'drawing' && (
              <button
                onClick={clearCanvas}
                className="flex-1 py-3.5 rounded-2xl font-medium"
                style={{ background: '#F5EDE8', color: '#7A5C5C' }}
              >
                Clear
              </button>
            )}
            <button
              onClick={composing === 'note' ? saveNote : saveDrawing}
              disabled={isPending || (composing === 'note' ? !noteText.trim() : !hasDrawing)}
              className="flex-1 py-3.5 rounded-2xl font-semibold text-white"
              style={{ background: isPending ? '#B08585' : '#FF6B6B' }}
            >
              {isPending ? 'Sending…' : 'Send ♡'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="px-4 space-y-4">
        {notes.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✏️</p>
            <p className="text-base font-medium" style={{ color: '#7A5C5C' }}>Nothing here yet</p>
            <p className="text-sm mt-1" style={{ color: '#B08585' }}>
              Send {pNick} a little drawing — even a wonky heart counts 🎨
            </p>
          </div>
        )}

        {notes.map(note => {
          const isMe = note.author === userEmail
          return (
            <div key={note.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl overflow-hidden shadow-sm"
                style={{
                  background: isMe ? '#FFE5E5' : '#E0F7F5',
                  borderBottomRightRadius: isMe ? '4px' : undefined,
                  borderBottomLeftRadius: !isMe ? '4px' : undefined,
                }}
              >
                {note.type === 'note' ? (
                  <div className="p-4">
                    <p className="text-sm font-handwriting leading-relaxed" style={{ color: '#2D1B1B' }}>{note.content}</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={note.content} alt="doodle" className="w-full" />
                )}
                <div className="px-3 pb-2 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#B08585' }}>
                    {isMe ? myNick : pNick}
                  </span>
                  <span className="text-[10px]" style={{ color: '#B08585' }}>{timeAgo(note.created_at)}</span>
                </div>
              </div>
              <div className="max-w-[80%] mt-1 px-1">
                <ReactionsBar entityType="note" entityId={note.id} userId={userId} />
                <CommentThread entityType="note" entityId={note.id} userId={userId} myNick={myNick} partnerNick={pNick} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
