import { createClient } from '@/lib/supabase/server'
import { sendCommentNotification } from '@/lib/email'
import { nickname } from '@/lib/nicknames'

const ENTITY_TABLE: Record<string, string> = {
  photo:       'photos',
  note:        'notes_and_doodles',
  achievement: 'achievements',
  checkin:     'checkins',
  day_entry:   'day_entries',
}

const ENTITY_LABEL: Record<string, string> = {
  photo:       'photo',
  note:        'note',
  achievement: 'achievement',
  checkin:     'check-in',
  day_entry:   'day entry',
}

const ENTITY_PATH: Record<string, string> = {
  photo:       '/our-days',
  note:        '/our-days',
  achievement: '/our-days',
  checkin:     '/our-days',
  day_entry:   '/our-days',
}

const AUTHOR_IS_UUID = new Set(['day_entry'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { entityType, entityId, text } = await request.json()
  if (!entityType || !entityId || !text?.trim()) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: comment, error: insertErr } = await supabase
    .from('comments')
    .insert({ author: user.id, entity_type: entityType, entity_id: String(entityId), text: text.trim() })
    .select('id, author, text, created_at')
    .single()

  if (insertErr) {
    console.error('[Levbe] comment insert error:', insertErr.message, '— Run supabase-reactions.sql if table is missing', { entityType, entityId })
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  // Notify partner (best-effort, never blocks the response)
  ;(async () => {
    try {
      const table = ENTITY_TABLE[entityType]
      if (!table) return

      const { data: entity } = await supabase.from(table).select('author').eq('id', entityId).maybeSingle()
      if (!entity) return

      const entityAuthor: string = entity.author
      const isOwnComment = AUTHOR_IS_UUID.has(entityType)
        ? entityAuthor === user.id
        : entityAuthor === user.email

      if (isOwnComment) return

      const { data: meProfile } = await supabase.from('users').select('id, name').eq('id', user.id).maybeSingle()
      const senderNick = nickname(meProfile?.name ?? user.email?.split('@')[0] ?? '')

      const recipientQuery = AUTHOR_IS_UUID.has(entityType)
        ? supabase.from('users').select('id, email').eq('id', entityAuthor).maybeSingle()
        : supabase.from('users').select('id, email').eq('email', entityAuthor).maybeSingle()

      const { data: recipient } = await recipientQuery
      if (!recipient) return

      const label = ENTITY_LABEL[entityType] ?? entityType
      const path = ENTITY_PATH[entityType] ?? '/our-days'

      await Promise.all([
        recipient.email
          ? sendCommentNotification(recipient.email, meProfile?.name ?? '', text.trim(), label, path)
          : Promise.resolve(),
        supabase.from('notifications').insert({
          recipient: recipient.id,
          type: 'comment',
          entity_type: entityType,
          entity_id: String(entityId),
          message: `${senderNick} commented on your ${label} 💬`,
        }).then(({ error }) => {
          if (error) console.error('[Levbe] comment notification insert failed:', error.message)
        }),
      ])
    } catch (e) {
      console.error('[Levbe] comment notification error:', e)
    }
  })()

  return Response.json({ ok: true, comment })
}
