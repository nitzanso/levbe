import { createClient } from '@/lib/supabase/server'
import { nickname } from '@/lib/nicknames'

const TYPE_COPY: Record<string, string> = {
  highlight: 'shared a highlight',
  photo:     'added a photo',
  doodle:    'drew something',
  proud:     'added something they\'re proud of',
  mood:      'checked in with a mood',
}
const TYPE_EMOJI: Record<string, string> = {
  highlight: '📝',
  photo:     '📷',
  doodle:    '✏️',
  proud:     '🌟',
  mood:      '😊',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { entryId, type } = await request.json()

  const { data: users } = await supabase.from('users').select('id, email, name')
  if (!users || users.length < 2) return Response.json({ error: 'Users not found' }, { status: 500 })

  const me = users.find(u => u.id === user.id)
  const partner = users.find(u => u.id !== user.id)
  if (!me || !partner) return Response.json({ error: 'Partner not found' }, { status: 500 })

  const myNick = nickname(me.name)
  const verb = TYPE_COPY[type] ?? 'added something'
  const emoji = TYPE_EMOJI[type] ?? '📝'
  const body = `${myNick} ${verb} to today ${emoji}`

  const { error } = await supabase.from('notifications').insert({
    recipient: partner.id,
    type: 'day_entry',
    body,
    related_id: entryId,
  })
  if (error) {
    console.error('[Levbe] day-entry notify insert failed:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
