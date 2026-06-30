import { createClient } from '@/lib/supabase/server'
import TalkClient from './TalkClient'

export default async function TalkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('users').select('name').eq('id', user!.id).maybeSingle()

  const { data: discussions } = await supabase
    .from('discussions')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <TalkClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? 'you'}
      discussions={discussions ?? []}
    />
  )
}
