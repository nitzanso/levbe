import { createClient } from '@/lib/supabase/server'
import ThisWeekClient from './ThisWeekClient'

export default async function ThisWeekPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('users').select('name').eq('id', user!.id).maybeSingle()

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const { data: currentMoment } = await supabase
    .from('weekly_moments')
    .select('*')
    .gte('week_start_date', weekStartStr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: ideaBank } = await supabase
    .from('idea_bank')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: pastMoments } = await supabase
    .from('weekly_moments')
    .select('*')
    .lt('week_start_date', weekStartStr)
    .order('week_start_date', { ascending: false })
    .limit(8)

  return (
    <ThisWeekClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? 'you'}
      currentMoment={currentMoment}
      ideaBank={ideaBank ?? []}
      pastMoments={pastMoments ?? []}
      weekStartStr={weekStartStr}
    />
  )
}
