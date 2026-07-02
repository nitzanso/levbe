import { createClient } from '@/lib/supabase/server'
import { nickname } from '@/lib/nicknames'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, taskTitle, assigneeId } = await request.json()
  if (!taskId || !taskTitle || !assigneeId) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Only notify if the assignee is not the current user
  if (assigneeId === user.id) return Response.json({ ok: true })

  const { data: me } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
  const senderNick = nickname(me?.name ?? '')

  const { error } = await supabase.from('notifications').insert({
    recipient:   assigneeId,
    type:        'task_assigned',
    entity_type: 'task',
    entity_id:   taskId,
    message:     `${senderNick} assigned you a task: "${taskTitle}" ✅`,
  })

  if (error) {
    console.error('[Levbe] task assign-notify insert failed:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
