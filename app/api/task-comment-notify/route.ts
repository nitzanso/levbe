import { createClient } from '@/lib/supabase/server'
import { sendTaskCommentNotification } from '@/lib/email'

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

  const commenterName = meProfile?.name ?? user.email?.split('@')[0] ?? 'Your love'

  await sendTaskCommentNotification(task.created_by, commenterName, taskTitle, commentText.trim())

  return Response.json({ ok: true })
}
