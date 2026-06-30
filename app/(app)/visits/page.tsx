import { createClient } from '@/lib/supabase/server'
import VisitsClient from './VisitsClient'

export default async function VisitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: visits } = await supabase
    .from('visits')
    .select('*')
    .order('start_date', { ascending: true })

  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).maybeSingle()

  return <VisitsClient userEmail={user!.email ?? ''} userName={profile?.name ?? ''} visits={visits ?? []} />
}
