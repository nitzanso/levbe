import { createClient } from '@/lib/supabase/server'
import MilestonesClient from './MilestonesClient'

export default async function MilestonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .order('created_at', { ascending: true })

  return <MilestonesClient userEmail={user!.email ?? ''} milestones={milestones ?? []} />
}
