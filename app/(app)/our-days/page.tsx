import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OurDaysClient from './OurDaysClient'

export default async function OurDaysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from('users').select('name, email, avatar_color').eq('id', user.id).maybeSingle(),
    supabase.from('day_entries').select('*').order('date', { ascending: false }).order('created_at', { ascending: true }),
  ])

  return (
    <OurDaysClient
      userId={user.id}
      userEmail={user.email ?? ''}
      userName={profile?.name ?? user.email?.split('@')[0] ?? ''}
      entries={entries ?? []}
    />
  )
}
