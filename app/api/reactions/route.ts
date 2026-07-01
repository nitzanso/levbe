import { createClient } from '@/lib/supabase/server'
import { sendReactionNotification } from '@/lib/email'
import { nickname } from '@/lib/nicknames'

const ENTITY_TABLE: Record<string, string> = {
  photo: 'photos',
  note: 'notes_and_doodles',
  achievement: 'achievements',
  checkin: 'checkins',
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

  const { entityType, entityId, emoji } = await request.json()
  if (!entityType || !entityId || !emoji) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Toggle: delete if already exists, insert if not
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('author', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id)
    return Response.json({ ok: true, action: 'removed' })
  }

  const { data: reaction } = await supabase
    .from('reactions')
    .insert({ author: user.id, entity_type: entityType, entity_id: entityId, emoji })
    .select('id, author, emoji')
    .single()

  // Notify partner only if the entity belongs to them
  const table = ENTITY_TABLE[entityType]
  if (table && user.email) {
    const { data: entity } = await supabase.from(table).select('author').eq('id', entityId).maybeSingle()
    if (entity && entity.author !== user.email) {
      const { data: meProfile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
      const { data: recipientProfile } = await supabase.from('users').select('id').eq('email', entity.author).maybeSingle()
      const senderName = meProfile?.name ?? user.email.split('@')[0]
      const senderNick = nickname(senderName)
      await Promise.all([
        sendReactionNotification(entity.author, senderName, emoji, entityType, ENTITY_PATH[entityType]),
        recipientProfile
          ? supabase.from('notifications').insert({
              recipient: recipientProfile.id,
              type: 'reaction',
              entity_type: entityType,
              entity_id: String(entityId),
              message: `${senderNick} reacted ${emoji} to your ${entityType}`,
            }).then(({ error }) => {
              if (error) console.error('[Levbe] reaction notification insert failed:', error.message)
            })
          : (console.warn('[Levbe] reaction notification skipped — no user row found for email:', entity.author), Promise.resolve()),
      ])
    }
  }

  return Response.json({ ok: true, action: 'added', reaction })
}
