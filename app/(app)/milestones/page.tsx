import { createClient } from '@/lib/supabase/server'
import MilestonesClient from './MilestonesClient'

export default async function MilestonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('users').select('name').eq('id', user!.id).maybeSingle()

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <MilestonesClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? 'you'}
      milestones={milestones ?? []}
    />
  )
}
