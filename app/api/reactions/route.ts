import { createClient } from '@/lib/supabase/server'
import { sendReactionNotification } from '@/lib/email'
import { nickname } from '@/lib/nicknames'

// entity_type → table name
const ENTITY_TABLE: Record<string, string> = {
  photo:      'photos',
  note:       'notes_and_doodles',
  achievement: 'achievements',
  checkin:    'checkins',
  day_entry:  'day_entries',
}

// entity_type → app path for email CTA
const ENTITY_PATH: Record<string, string> = {
  photo:      '/our-days',
  note:       '/our-days',
  achievement: '/our-days',
  checkin:    '/our-days',
  day_entry:  '/our-days',
}

// old tables store author as email; day_entries stores author as uuid
const AUTHOR_IS_UUID = new Set(['day_entry'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { entityType, entityId, emoji } = await request.json()
  if (!entityType || !entityId || !emoji) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Toggle: delete if already exists, insert if not
  const { data: existing, error: existErr } = await supabase
    .from('reactions')
    .select('id')
    .eq('author', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .eq('emoji', emoji)
    .maybeSingle()

  if (existErr) {
    console.error('[Levbe] reactions select error:', existErr.message, '— Run supabase-reactions.sql if table is missing')
    return Response.json({ error: existErr.message }, { status: 500 })
  }

  if (existing) {
    const { error: delErr } = await supabase.from('reactions').delete().eq('id', existing.id)
    if (delErr) console.error('[Levbe] reaction delete error:', delErr.message)
    return Response.json({ ok: true, action: 'removed' })
  }

  const { data: reaction, error: insertErr } = await supabase
    .from('reactions')
    .insert({ author: user.id, entity_type: entityType, entity_id: String(entityId), emoji })
    .select('id, author, emoji')
    .single()

  if (insertErr) {
    console.error('[Levbe] reaction insert error:', insertErr.message, '{ entityType, entityId, emoji }', { entityType, entityId, emoji })
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  // Notify partner if the entity belongs to them (best-effort, never blocks the response)
  ;(async () => {
    try {
      const table = ENTITY_TABLE[entityType]
      if (!table) return

      const { data: entity } = await supabase.from(table).select('author').eq('id', entityId).maybeSingle()
      if (!entity) return

      const entityAuthor: string = entity.author
      const isOwnReaction = AUTHOR_IS_UUID.has(entityType)
        ? entityAuthor === user.id
        : entityAuthor === user.email

      if (isOwnReaction) return

      const { data: meProfile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
      const senderNick = nickname(meProfile?.name ?? user.email?.split('@')[0] ?? '')

      // Find recipient by UUID or email
      const recipientQuery = AUTHOR_IS_UUID.has(entityType)
        ? supabase.from('users').select('id, email').eq('id', entityAuthor).maybeSingle()
        : supabase.from('users').select('id, email').eq('email', entityAuthor).maybeSingle()

      const { data: recipient } = await recipientQuery
      if (!recipient) return

      await Promise.all([
        recipient.email
          ? sendReactionNotification(recipient.email, meProfile?.name ?? '', emoji, entityType, ENTITY_PATH[entityType] ?? '/our-days')
          : Promise.resolve(),
        supabase.from('notifications').insert({
          recipient: recipient.id,
          type: 'reaction',
          entity_type: entityType,
          entity_id: String(entityId),
          body: `${senderNick} reacted ${emoji}`,
        }).then(({ error }) => {
          if (error) console.error('[Levbe] reaction notification insert failed:', error.message)
        }),
      ])
    } catch (e) {
      console.error('[Levbe] reaction notification error:', e)
    }
  })()

  return Response.json({ ok: true, action: 'added', reaction })
}
