import { createClient } from '@/lib/supabase/server'
import TalkClient from './TalkClient'

export default async function TalkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: discussions } = await supabase
    .from('discussions')
    .select('*')
    .order('created_at', { ascending: false })

  return <TalkClient userEmail={user!.email ?? ''} discussions={discussions ?? []} />
}
