import { createClient } from '@/lib/supabase/server'
import { nickname } from '@/lib/nicknames'

// Thin endpoint for client-side notification inserts that don't
// go through another API route (currently: dream_added).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, entityType, entityId } = await request.json()

  const { data: users } = await supabase.from('users').select('id, email, name')
  const me = users?.find(u => u.id === user.id)
  const partner = users?.find(u => u.id !== user.id)
  if (!me || !partner) return Response.json({ error: 'Users not found' }, { status: 500 })

  const senderNick = nickname(me.name ?? user.email?.split('@')[0] ?? 'Your love')

  const messages: Record<string, string> = {
    dream_added: `${senderNick} added a dream to your list 🌍`,
  }

  const message = messages[type]
  if (!message) return Response.json({ error: 'Unknown type' }, { status: 400 })

  await supabase.from('notifications').insert({
    recipient: partner.id,
    type,
    entity_type: entityType ?? null,
    entity_id: entityId ? String(entityId) : null,
    message,
  })

  return Response.json({ ok: true })
}
