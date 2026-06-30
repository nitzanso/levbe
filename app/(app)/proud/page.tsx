import { createClient } from '@/lib/supabase/server'
import ProudClient from './ProudClient'

export default async function ProudPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: achievements } = await supabase
    .from('achievements')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).maybeSingle()

  return <ProudClient userEmail={user!.email ?? ''} userName={profile?.name ?? ''} achievements={achievements ?? []} />
}
