import { createClient } from '@/lib/supabase/server'
import { nickname } from '@/lib/nicknames'

const TYPE_MESSAGE: Record<string, (nick: string) => string> = {
  highlight: (nick) => `${nick} shared a highlight from their day ✨`,
  photo:     (nick) => `${nick} added a photo to today 📷`,
  doodle:    (nick) => `${nick} left you a doodle 🎨`,
  proud:     (nick) => `${nick} shared something they're proud of 🌟`,
  mood:      (nick) => `${nick} checked in with how they're feeling 🤍`,
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { entryId, type } = await request.json()

  const { data: users } = await supabase.from('users').select('id, email, name')
  if (!users || users.length < 2) return Response.json({ error: 'Users not found' }, { status: 500 })

  const me = users.find((u: any) => u.id === user.id)
  const partner = users.find((u: any) => u.id !== user.id)
  if (!me || !partner) return Response.json({ error: 'Partner not found' }, { status: 500 })

  const myNick = nickname(me.name)
  const msgFn = TYPE_MESSAGE[type]
  const message = msgFn ? msgFn(myNick) : `${myNick} added something to today 📖`

  const { error } = await supabase.from('notifications').insert({
    recipient:   partner.id,
    type:        'day_entry',
    entity_type: 'day_entry',
    entity_id:   entryId,
    message,
  })
  if (error) {
    console.error('[Levbe] day-entry notify insert failed:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
