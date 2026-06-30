import { createClient } from '@/lib/supabase/server'
import TasksClient from './TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tasks }, { data: allProfiles }, { data: profile }] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('users').select('id, name, avatar_color, email'),
    supabase.from('users').select('*').eq('id', user!.id).maybeSingle(),
  ])

  return (
    <TasksClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? ''}
      userColor={profile?.avatar_color ?? '#FF6B6B'}
      tasks={tasks ?? []}
      allProfiles={allProfiles ?? []}
    />
  )
}
