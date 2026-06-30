import { createClient } from '@/lib/supabase/server'
import CheckinClient from './CheckinClient'

export default async function CheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).maybeSingle()
  const { data: myCheckin } = await supabase.from('checkins').select('*').eq('author', user!.email).eq('date', todayStr).maybeSingle()
  const { data: partnerCheckin } = await supabase.from('checkins').select('*').neq('author', user!.email).eq('date', todayStr).maybeSingle()

  // Last 7 days for both
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
  const { data: recentCheckins } = await supabase
    .from('checkins')
    .select('*')
    .gte('date', sevenDaysAgoStr)
    .order('date', { ascending: false })

  return (
    <CheckinClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? 'you'}
      myCheckin={myCheckin}
      partnerCheckin={partnerCheckin}
      recentCheckins={recentCheckins ?? []}
      today={todayStr}
    />
  )
}
