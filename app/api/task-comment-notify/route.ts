import { createClient } from '@/lib/supabase/server'
import { sendTaskCommentNotification } from '@/lib/email'
import { nickname } from '@/lib/nicknames'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, taskTitle, commentText } = await request.json()
  if (!taskId || !taskTitle || !commentText?.trim()) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Look up the task's creator email
  const { data: task } = await supabase
    .from('tasks')
    .select('created_by')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.created_by === user.email) {
    return Response.json({ ok: true, skipped: 'own_task' })
  }

  // Look up the commenter's display name
  const { data: meProfile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()
  const { data: recipientProfile } = await supabase
    .from('users')
    .select('id')
    .eq('email', task.created_by)
    .maybeSingle()

  const commenterName = meProfile?.name ?? user.email?.split('@')[0] ?? 'Your love'
  const commenterNick = nickname(commenterName)

  await Promise.all([
    sendTaskCommentNotification(task.created_by, commenterName, taskTitle, commentText.trim()),
    recipientProfile
      ? supabase.from('notifications').insert({
          recipient: recipientProfile.id,
          type: 'task_comment',
          entity_type: 'task',
          entity_id: taskId,
          message: `${commenterNick} commented on '${taskTitle}' 💬`,
        }).then(({ error }) => {
          if (error) console.error('[Levbe] task_comment notification insert failed:', error.message)
        })
      : (console.warn('[Levbe] task_comment notification skipped — no user row found for email:', task.created_by), Promise.resolve()),
  ])

  return Response.json({ ok: true })
}
