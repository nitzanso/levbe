import { createClient } from '@/lib/supabase/server'
import { sendCommentNotification } from '@/lib/email'

const ENTITY_TABLE: Record<string, string> = {
  photo: 'photos',
  note: 'notes_and_doodles',
  achievement: 'achievements',
  checkin: 'checkins',
}

const ENTITY_LABEL: Record<string, string> = {
  photo: 'photo',
  note: 'note',
  achievement: 'achievement',
  checkin: 'check-in',
}

const ENTITY_PATH: Record<string, string> = {
  photo: '/photos',
  note: '/notes',
  achievement: '/proud',
  checkin: '/checkin',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { entityType, entityId, text } = await request.json()
  if (!entityType || !entityId || !text?.trim()) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: comment } = await supabase
    .from('comments')
    .insert({ author: user.id, entity_type: entityType, entity_id: entityId, text: text.trim() })
    .select('id, author, text, created_at')
    .single()

  // Notify partner only if the entity belongs to them
  const table = ENTITY_TABLE[entityType]
  if (table && user.email) {
    const { data: entity } = await supabase.from(table).select('author').eq('id', entityId).maybeSingle()
    if (entity && entity.author !== user.email) {
      const { data: meProfile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
      const senderName = meProfile?.name ?? user.email.split('@')[0]
      await sendCommentNotification(
        entity.author,
        senderName,
        text.trim(),
        ENTITY_LABEL[entityType],
        ENTITY_PATH[entityType],
      )
    }
  }

  return Response.json({ ok: true, comment })
}
