import { createClient } from '@/lib/supabase/server'
import { nickname } from '@/lib/nicknames'
import { sendDateNightNotification } from '@/lib/email'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { momentId } = await request.json()

  const [{ data: moment }, { data: users }] = await Promise.all([
    supabase.from('weekly_moments').select('*').eq('id', momentId).single(),
    supabase.from('users').select('id, email, name'),
  ])

  if (!moment || !users || users.length < 2) {
    return Response.json({ error: 'Data not found' }, { status: 500 })
  }

  const me = users.find((u: any) => u.id === user.id)
  const partner = users.find((u: any) => u.id !== user.id)
  if (!me || !partner?.email) return Response.json({ error: 'Partner not found' }, { status: 500 })

  const myNick = nickname(me.name)

  // Parse day + time label from date_time
  let dayLabel = ''
  let timeLabel = ''
  if (moment.date_time) {
    const dt = new Date(moment.date_time)
    dayLabel = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    timeLabel = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const body = `${myNick} planned your date night — ${dayLabel} at ${timeLabel} 🌙${moment.idea_text ? ` · ${moment.idea_text}` : ''}`

  const { error: notifErr } = await supabase.from('notifications').insert({
    recipient: partner.id,
    type: 'date_night',
    body,
    related_id: momentId,
  })
  if (notifErr) console.error('[Levbe] date-night notify insert failed:', notifErr.message)

  await sendDateNightNotification(
    partner.email,
    myNick,
    dayLabel,
    timeLabel,
    moment.idea_text,
  )

  return Response.json({ ok: true })
}
