import { createClient } from '@/lib/supabase/server'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('name').eq('id', user!.id).maybeSingle()

  const [
    { data: visits },
    { data: milestones },
    { data: tasks },
    { data: moments },
    { data: recurringEvents },
    { data: oneOffEvents },
  ] = await Promise.all([
    supabase.from('visits').select('id,status,traveler,start_date,end_date,notes,proposed_by').order('start_date'),
    supabase.from('milestones').select('id,track,title,definition_of_done,target_date,status').not('target_date', 'is', null),
    supabase.from('tasks').select('id,title,status,due_date,tags,created_by').not('due_date', 'is', null),
    supabase.from('weekly_moments').select('id,week_start_date,idea_text,proposed_by,confirmed,date_time').not('date_time', 'is', null),
    supabase.from('recurring_events').select('*').eq('active', true),
    supabase.from('one_off_events').select('*').order('date'),
  ])

  return (
    <CalendarClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? 'you'}
      visits={visits ?? []}
      milestones={milestones ?? []}
      tasks={tasks ?? []}
      moments={moments ?? []}
      recurringEvents={recurringEvents ?? []}
      oneOffEvents={oneOffEvents ?? []}
    />
  )
}
