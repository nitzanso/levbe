'use client'

import { useState, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Camera, ArrowLeft, ImageIcon } from 'lucide-react'
import { nickname, partnerNick } from '@/lib/nicknames'
import ReactionsBar from '@/components/ReactionsBar'
import CommentThread from '@/components/CommentThread'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhotoTag = 'achievement' | 'moment' | 'everyday'
type PhotoStatus = 'pending' | 'revealed'

interface FullPhoto {
  id: string
  author: string
  image_path: string
  caption: string | null
  status: PhotoStatus
  tag: PhotoTag | null
  created_at: string
  revealed_at: string | null
}

// Pending partner photos have no image_path — server withholds it until reveal
interface PendingPhoto {
  id: string
  author: string
  caption: string | null
  status: 'pending'
  tag: PhotoTag | null
  created_at: string
  revealed_at: null
}

interface Props {
  userId: string
  userEmail: string
  userName: string
  partnerName: string
  myPhotos: FullPhoto[]
  partnerRevealed: FullPhoto[]
  partnerPending: PendingPhoto[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function groupByMonth(photos: FullPhoto[]): Record<string, FullPhoto[]> {
  const groups: Record<string, FullPhoto[]> = {}
  for (const p of photos) {
    const key = p.revealed_at ? p.revealed_at.slice(0, 7) : p.created_at.slice(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  return groups
}

const TAG_STYLES: Record<PhotoTag, { bg: string; text: string; label: string }> = {
  achievement: { bg: '#FFF8D6', text: '#B59100', label: '⭐ Achievement' },
  moment:      { bg: '#E0F7F5', text: '#2BA99C', label: '✨ Moment' },
  everyday:    { bg: '#F5EDE8', text: '#7A5C5C', label: '☀️ Everyday' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotosClient({
  userId, userEmail, userName, partnerName,
  myPhotos: initialMyPhotos,
  partnerRevealed: initialPartnerRevealed,
  partnerPending: initialPartnerPending,
}: Props) {
  const supabase   = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const myNick     = nickname(userName)
  const pNick      = partnerNick(userName) || partnerName

  // Local state mirrors
  const [myPhotos, setMyPhotos] = useState<FullPhoto[]>(initialMyPhotos)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [partnerRevealed, setPartnerRevealed] = useState<FullPhoto[]>(initialPartnerRevealed)
  const [partnerPending, setPartnerPending] = useState<PendingPhoto[]>(initialPartnerPending)

  // View
  const [activeTab, setActiveTab] = useState<'feed' | 'recap'>('feed')

  // Upload flow
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadTag, setUploadTag] = useState<PhotoTag | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Reveal flow
  const [revealingPhoto, setRevealingPhoto] = useState<PendingPhoto | null>(null)
  const [revealedData, setRevealedData] = useState<FullPhoto | null>(null)
  const [revealing, setRevealing] = useState(false)

  // Lightbox (tap a feed photo to view full-size)
  const [lightboxPhoto, setLightboxPhoto] = useState<FullPhoto | null>(null)

  // ─── Upload handlers ─────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Photo is over 10 MB — please pick a smaller one.')
      return
    }
    setUploadError('')
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
  }

  function resetUpload() {
    setUploadFile(null)
    setUploadPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setUploadCaption('')
    setUploadTag(null)
    setUploadError('')
    setUploadOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadError('')

    const ext = uploadFile.name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('photos')
      .upload(path, uploadFile, { contentType: uploadFile.type, cacheControl: '31536000' })

    if (storageError) {
      setUploadError('Upload failed — check your connection and try again.')
      setUploading(false)
      return
    }

    const { data, error: dbError } = await supabase.from('photos').insert({
      author: userEmail,
      image_path: path,
      caption: uploadCaption.trim() || null,
      tag: uploadTag,
      status: 'pending',
    }).select().single()

    if (dbError || !data) {
      setUploadError('Something went wrong saving the photo.')
      setUploading(false)
      return
    }

    setMyPhotos(prev => [data, ...prev])
    setUploading(false)
    resetUpload()
    setUploadSuccess(`${pNick} will love opening this 📷`)
    setTimeout(() => setUploadSuccess(''), 3000)

    // Notify partner by email (fire-and-forget — don't block the UI)
    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'activity', activityType: 'photo', relatedEntity: `photo:${data.id}` }),
    }).catch(() => {})
  }

  // ─── Reveal handler ──────────────────────────────────────────────────────

  async function handleReveal() {
    if (!revealingPhoto) return
    setRevealing(true)

    const { data } = await supabase.from('photos')
      .update({ status: 'revealed', revealed_at: new Date().toISOString() })
      .eq('id', revealingPhoto.id)
      .select()
      .single()

    if (data) {
      setRevealedData(data)
      setPartnerPending(prev => prev.filter(p => p.id !== revealingPhoto.id))
      setPartnerRevealed(prev => [data, ...prev])
    }
    setRevealing(false)
  }

  function closeReveal() {
    setRevealingPhoto(null)
    setRevealedData(null)
  }

  // ─── Feed: all revealed + my own pending, sorted by date ─────────────────

  const feedPhotos: FullPhoto[] = [
    ...partnerRevealed,
    ...myPhotos,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // ─── Recap: revealed photos by month ────────────────────────────────────

  const allRevealedForRecap = [...partnerRevealed, ...myPhotos.filter(p => p.status === 'revealed')]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const monthGroups = groupByMonth(allRevealedForRecap)
  const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a))

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">
      {/* Upload success flash */}
      {uploadSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white"
          style={{ background: '#FF6B6B' }}>
          {uploadSuccess}
        </div>
      )}

      <PageHeader
        title="Photos"
        subtitle={`${myNick} & ${pNick}'s collection`}
        action={
          <button
            onClick={() => setUploadOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#FF6B6B' }}
          >
            <Plus size={18} color="white" />
          </button>
        }
      />

      {/* Tab switcher */}
      <div className="px-4 mb-4 flex gap-2">
        {(['feed', 'recap'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-full text-sm font-medium transition-colors"
            style={{
              background: activeTab === tab ? '#FF6B6B' : '#F5EDE8',
              color: activeTab === tab ? 'white' : '#7A5C5C',
            }}
          >
            {tab === 'feed' ? 'Feed' : 'Monthly recap'}
          </button>
        ))}
      </div>

      {/* ─── FEED TAB ─────────────────────────────────────────────── */}
      {activeTab === 'feed' && (
        <div className="px-4 space-y-4">

          {/* Pending photos from partner — mystery reveal cards */}
          {partnerPending.map(photo => (
            <div
              key={photo.id}
              className="rounded-3xl p-5 text-center"
              style={{ background: 'linear-gradient(135deg, #FFE5E5, #FFF8D6)' }}
            >
              <div className="text-4xl mb-2">📸</div>
              <p className="font-semibold text-base mb-0.5" style={{ color: '#2D1B1B' }}>
                {partnerName} sent you a photo
              </p>
              <p className="text-xs mb-1" style={{ color: '#B08585' }}>{timeAgo(photo.created_at)}</p>
              {photo.tag && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
                  style={{ background: TAG_STYLES[photo.tag].bg, color: TAG_STYLES[photo.tag].text }}>
                  {TAG_STYLES[photo.tag].label}
                </span>
              )}
              {!photo.tag && <div className="mb-3" />}
              <button
                onClick={() => setRevealingPhoto(photo)}
                className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                style={{ background: '#FF6B6B' }}
              >
                Open this photo
              </button>
            </div>
          ))}

          {/* Feed grid */}
          {feedPhotos.length === 0 && partnerPending.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📷</div>
              <p className="font-medium" style={{ color: '#7A5C5C' }}>No photos yet</p>
              <p className="text-sm mt-1" style={{ color: '#B08585' }}>
                Snap something from your day and send it to {pNick} 📷
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {feedPhotos.map(photo => (
              <FeedCard
                key={photo.id}
                photo={photo}
                isMe={photo.author === userEmail}
                partnerName={partnerName}
                userId={userId}
                myNick={myNick}
                pNick={pNick}
                onOpen={() => setLightboxPhoto(photo)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── RECAP TAB ─────────────────────────────────────────────── */}
      {activeTab === 'recap' && (
        <div className="px-4 space-y-8">
          {sortedMonths.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🗓</div>
              <p className="font-medium" style={{ color: '#7A5C5C' }}>Nothing here yet</p>
              <p className="text-sm mt-1" style={{ color: '#B08585' }}>
                Revealed photos will collect here month by month
              </p>
            </div>
          )}

          {sortedMonths.map(month => {
            const photos = monthGroups[month]
            return (
              <div key={month}>
                <h2 className="text-sm font-bold mb-3" style={{ color: '#B08585' }}>
                  {monthLabel(month).toUpperCase()}
                </h2>
                <CollageGrid photos={photos} onOpen={setLightboxPhoto} />
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Upload overlay ─────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFAF7' }}>
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold" style={{ color: '#2D1B1B' }}>Send {pNick} a photo</h2>
            <button onClick={resetUpload}><X size={22} style={{ color: '#B08585' }} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            {/* Photo picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {!uploadPreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-3xl flex flex-col items-center justify-center gap-3 py-16"
                style={{ background: '#FFE5E5', border: '2px dashed #FF6B6B' }}
              >
                <Camera size={32} style={{ color: '#FF6B6B' }} />
                <div>
                  <p className="font-semibold" style={{ color: '#FF6B6B' }}>Choose a photo</p>
                  <p className="text-xs mt-0.5" style={{ color: '#B08585' }}>From your camera roll or take one now</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-3xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadPreview}
                  alt="Preview"
                  className="w-full max-h-80 object-cover"
                  style={{ imageOrientation: 'from-image' } as React.CSSProperties}
                />
                <button
                  onClick={() => { setUploadFile(null); setUploadPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null }) }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <X size={14} color="white" />
                </button>
              </div>
            )}

            {/* Caption */}
            <input
              value={uploadCaption}
              onChange={e => setUploadCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #F5EDE8', color: '#2D1B1B' }}
            />

            {/* Tag */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#B08585' }}>TAG (OPTIONAL)</p>
              <div className="flex gap-2">
                {(Object.keys(TAG_STYLES) as PhotoTag[]).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setUploadTag(prev => prev === tag ? null : tag)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
                    style={{
                      background: uploadTag === tag ? TAG_STYLES[tag].bg : '#F5EDE8',
                      color: uploadTag === tag ? TAG_STYLES[tag].text : '#7A5C5C',
                      border: uploadTag === tag ? `1.5px solid ${TAG_STYLES[tag].text}40` : '1.5px solid transparent',
                    }}
                  >
                    {TAG_STYLES[tag].label}
                  </button>
                ))}
              </div>
            </div>

            {uploadError && (
              <p className="text-sm px-3 py-2 rounded-xl" style={{ background: '#FFE5E5', color: '#E85555' }}>
                {uploadError}
              </p>
            )}
          </div>

          <div className="px-5 pb-8">
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="w-full py-4 rounded-2xl font-semibold text-white transition-colors"
              style={{ background: uploadFile && !uploading ? '#FF6B6B' : '#E0E0E0' }}
            >
              {uploading ? 'Sending…' : 'Send ♡'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Reveal overlay ─────────────────────────────────────────── */}
      {revealingPhoto && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(20,10,10,0.97)' }}
        >
          {!revealedData ? (
            /* Step 1: anticipation card */
            <div className="text-center px-8">
              <div className="text-7xl mb-5" style={{ animation: 'heartbeat 2s ease-in-out infinite' }}>📸</div>
              <p className="text-white text-2xl font-bold mb-2">From {partnerName}</p>
              <p className="mb-1" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                {timeAgo(revealingPhoto.created_at)}
              </p>
              {revealingPhoto.tag && (
                <span className="inline-block text-xs px-3 py-1 rounded-full mb-8"
                  style={{ background: TAG_STYLES[revealingPhoto.tag].bg, color: TAG_STYLES[revealingPhoto.tag].text }}>
                  {TAG_STYLES[revealingPhoto.tag].label}
                </span>
              )}
              {!revealingPhoto.tag && <div className="mb-8" />}
              <button
                onClick={handleReveal}
                disabled={revealing}
                className="px-10 py-4 rounded-full font-bold text-white text-lg"
                style={{ background: '#FF6B6B' }}
              >
                {revealing ? 'Opening…' : 'Reveal ✨'}
              </button>
              <button onClick={closeReveal} className="block mt-5 mx-auto text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Save for later
              </button>
            </div>
          ) : (
            /* Step 2: revealed photo — scrollable so full image is always visible */
            <div className="fixed inset-0 overflow-y-auto" style={{ background: 'rgba(20,10,10,0.97)', animation: 'fadeIn 0.5s ease-in' }}>
              {/* Close button stays fixed regardless of scroll */}
              <button
                onClick={closeReveal}
                className="fixed top-14 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <X size={18} color="white" />
              </button>

              {/* Spacer so image doesn't start behind the close button */}
              <div className="h-16" />

              {/* Full image — width 100%, height auto, no cropping */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(revealedData.image_path)}
                alt={revealedData.caption ?? 'photo'}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  imageOrientation: 'from-image',
                } as React.CSSProperties}
              />

              <div className="px-6 py-6" style={{ background: 'rgba(0,0,0,0.8)' }}>
                {revealedData.caption && (
                  <p className="text-white font-medium mb-1">{revealedData.caption}</p>
                )}
                {revealedData.tag && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
                    style={{ background: TAG_STYLES[revealedData.tag].bg, color: TAG_STYLES[revealedData.tag].text }}>
                    {TAG_STYLES[revealedData.tag].label}
                  </span>
                )}
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  From {partnerName} · {timeAgo(revealedData.created_at)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Photo lightbox ─────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(20,10,10,0.97)' }}>
          {/* Close button stays fixed regardless of scroll */}
          <button
            onClick={() => setLightboxPhoto(null)}
            className="fixed top-14 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <X size={18} color="white" />
          </button>

          <div className="h-16" />

          {/* Full image — width 100%, height auto, no cropping */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(lightboxPhoto.image_path)}
            alt={lightboxPhoto.caption ?? 'photo'}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              imageOrientation: 'from-image',
            } as React.CSSProperties}
          />

          <div className="px-6 py-6" style={{ background: 'rgba(0,0,0,0.8)' }}>
            {lightboxPhoto.status === 'pending' && lightboxPhoto.author === userEmail && (
              <p className="text-xs mb-2 font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Waiting for {partnerName} to open…
              </p>
            )}
            {lightboxPhoto.caption && (
              <p className="text-white font-medium mb-1">{lightboxPhoto.caption}</p>
            )}
            {lightboxPhoto.tag && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full mb-2"
                style={{ background: TAG_STYLES[lightboxPhoto.tag].bg, color: TAG_STYLES[lightboxPhoto.tag].text }}>
                {TAG_STYLES[lightboxPhoto.tag].label}
              </span>
            )}
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {lightboxPhoto.author === userEmail ? 'You' : partnerName}
              {' · '}{timeAgo(lightboxPhoto.created_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FeedCard ─────────────────────────────────────────────────────────────────

function FeedCard({ photo, isMe, partnerName, userId, myNick, pNick, onOpen }: {
  photo: FullPhoto
  isMe: boolean
  partnerName: string
  userId: string
  myNick: string
  pNick: string
  onOpen: () => void
}) {
  const isPending = photo.status === 'pending' && isMe
  const url = photoUrl(photo.image_path)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#F5EDE8' }}>
      <button
        onClick={onOpen}
        className="relative w-full"
        style={{ aspectRatio: '1', display: 'block', background: '#F5EDE8' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={photo.caption ?? ''}
          className="w-full h-full object-cover"
          style={{
            imageOrientation: 'from-image',
            filter: isPending ? 'brightness(0.7)' : 'none',
          } as React.CSSProperties}
        />

        {isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
            <p className="text-white text-xs font-medium text-center leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              Waiting for {partnerName}
            </p>
          </div>
        )}

        {photo.tag && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: TAG_STYLES[photo.tag].bg, color: TAG_STYLES[photo.tag].text }}>
            {photo.tag === 'achievement' ? '⭐' : photo.tag === 'moment' ? '✨' : '☀️'}
          </div>
        )}

        {photo.caption && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
            <p className="text-white text-[10px] leading-tight truncate">{photo.caption}</p>
          </div>
        )}
      </button>

      <div className="px-2 pt-1.5 pb-2 space-y-1">
        <ReactionsBar entityType="photo" entityId={photo.id} userId={userId} />
        <CommentThread entityType="photo" entityId={photo.id} userId={userId} myNick={myNick} partnerNick={pNick} />
      </div>
    </div>
  )
}

// ─── CollageGrid ─────────────────────────────────────────────────────────────
// achievement → spans 2 cols + 2 rows (big square)
// moment → spans 2 cols (wide landscape)
// everyday / null → 1×1 (normal square)

function CollageGrid({ photos, onOpen }: { photos: FullPhoto[]; onOpen: (p: FullPhoto) => void }) {
  if (photos.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridAutoRows: '100px',
        gap: '4px',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {photos.map(photo => {
        const span = photo.tag === 'achievement'
          ? { gridColumn: 'span 2', gridRow: 'span 2' }
          : photo.tag === 'moment'
          ? { gridColumn: 'span 2' }
          : {}

        return (
          <button
            key={photo.id}
            onClick={() => onOpen(photo)}
            style={{ ...span, position: 'relative', background: '#F5EDE8', overflow: 'hidden' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(photo.image_path)}
              alt={photo.caption ?? ''}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                imageOrientation: 'from-image',
              } as React.CSSProperties}
            />
            {photo.tag === 'achievement' && (
              <div className="absolute top-2 left-2 text-lg">⭐</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
