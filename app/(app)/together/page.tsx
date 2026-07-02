import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TogetherClient from './TogetherClient'

export default async function TogetherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: profiles },
    { data: tasks },
    { data: visits },
    { data: milestones },
    { data: dreams },
    { data: moments },
    { data: recurringEvents },
    { data: oneOffEvents },
  ] = await Promise.all([
    supabase.from('users').select('name, email, avatar_color').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('id, name, email, avatar_color'),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('visits').select('*').order('start_date', { ascending: true }),
    supabase.from('milestones').select('*').order('created_at', { ascending: true }),
    supabase.from('dreams').select('*').order('created_at', { ascending: false }),
    supabase.from('weekly_moments').select('*').order('week_start_date', { ascending: false }),
    supabase.from('recurring_events').select('*').eq('active', true),
    supabase.from('one_off_events').select('*').order('date', { ascending: true }),
  ])

  return (
    <TogetherClient
      userId={user.id}
      userEmail={user.email ?? ''}
      userName={profile?.name ?? user.email?.split('@')[0] ?? ''}
      userColor={profile?.avatar_color ?? '#FF6B6B'}
      profiles={profiles ?? []}
      tasks={tasks ?? []}
      visits={visits ?? []}
      milestones={milestones ?? []}
      dreams={dreams ?? []}
      moments={moments ?? []}
      recurringEvents={recurringEvents ?? []}
      oneOffEvents={oneOffEvents ?? []}
    />
  )
}
