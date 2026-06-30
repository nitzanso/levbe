import { createClient } from '@/lib/supabase/server'
import {
  sendPhotoNotification,
  sendNoteNotification,
  sendAchievementNotification,
  sendPingNotification,
} from '@/lib/email'

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

    await sendPingNotification(partner.email, senderName)
    return Response.json({ ok: true })
  }

  if (body.type === 'activity') {
    await supabase.from('notification_log').insert({
      recipient_email: partner.email,
      sender_email: me.email,
      type: 'activity',
      related_entity: body.relatedEntity ?? null,
    })

    if (body.activityType === 'photo') {
      await sendPhotoNotification(partner.email, senderName)
    } else if (body.activityType === 'note') {
      await sendNoteNotification(partner.email, senderName, body.noteType ?? 'note')
    } else if (body.activityType === 'achievement') {
      await sendAchievementNotification(partner.email, senderName)
    }

    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown type' }, { status: 400 })
}
