import { createClient } from '@/lib/supabase/server'
import {
  sendPhotoNotification,
  sendNoteNotification,
  sendAchievementNotification,
  sendPingNotification,
} from '@/lib/email'
import { nickname } from '@/lib/nicknames'

// TODO: add per-user notification preference toggles when needed

const PING_DAILY_LIMIT = 3

type ActivityType = 'photo' | 'note' | 'achievement'
type RequestBody =
  | { type: 'activity'; activityType: ActivityType; noteType?: 'note' | 'drawing'; relatedEntity?: string }
  | { type: 'ping' }

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: RequestBody = await request.json()

  // Look up both users (this is a 2-person app)
  const { data: users } = await supabase.from('users').select('id, email, name')
  if (!users || users.length < 2) {
    return Response.json({ error: 'Users not found' }, { status: 500 })
  }

  const me = users.find(u => u.id === user.id)
  const partner = users.find(u => u.id !== user.id)

  if (!me || !partner || !partner.email) {
    return Response.json({ error: 'Partner not found' }, { status: 500 })
  }

  const senderName = me.name ?? user.email?.split('@')[0] ?? 'Your love'
  const senderNick = nickname(senderName)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  if (body.type === 'ping') {
    // Rate-limit: max 3 pings per sender per day
    const { count } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('sender_email', me.email)
      .eq('type', 'ping')
      .gte('sent_at', todayStart.toISOString())

    if ((count ?? 0) >= PING_DAILY_LIMIT) {
      // Silent — return ok but don't send
      return Response.json({ ok: true, skipped: 'rate_limited' })
    }

    await supabase.from('notification_log').insert({
      recipient_email: partner.email,
      sender_email: me.email,
      type: 'ping',
    })

    await Promise.all([
      sendPingNotification(partner.email, senderName),
      supabase.from('notifications').insert({
        recipient: partner.id,
        type: 'ping',
        message: `${senderNick} is thinking of you 👋`,
      }),
    ])
    return Response.json({ ok: true })
  }

  if (body.type === 'activity') {
    await supabase.from('notification_log').insert({
      recipient_email: partner.email,
      sender_email: me.email,
      type: 'activity',
      related_entity: body.relatedEntity ?? null,
    })

    // Extract entity id from "photo:uuid" style strings
    const entityId = body.relatedEntity ? body.relatedEntity.split(':')[1] ?? null : null

    if (body.activityType === 'photo') {
      await Promise.all([
        sendPhotoNotification(partner.email, senderName),
        supabase.from('notifications').insert({
          recipient: partner.id, type: 'photo',
          entity_type: 'photo', entity_id: entityId,
          message: `${senderNick} sent you a photo 📷`,
        }),
      ])
    } else if (body.activityType === 'note') {
      const isDrawing = body.noteType === 'drawing'
      await Promise.all([
        sendNoteNotification(partner.email, senderName, body.noteType ?? 'note'),
        supabase.from('notifications').insert({
          recipient: partner.id,
          type: isDrawing ? 'drawing' : 'note',
          entity_type: 'note', entity_id: entityId,
          message: isDrawing
            ? `${senderNick} left you a drawing ✏️`
            : `${senderNick} left you a note 💛`,
        }),
      ])
    } else if (body.activityType === 'achievement') {
      await Promise.all([
        sendAchievementNotification(partner.email, senderName),
        supabase.from('notifications').insert({
          recipient: partner.id, type: 'achievement',
          entity_type: 'achievement', entity_id: entityId,
          message: `${senderNick} shared something they're proud of 🌟`,
        }),
      ])
    }

    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown type' }, { status: 400 })
}
