import { createClient } from '@/lib/supabase/server'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch today's quote
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const { data: quotes } = await supabase.from('daily_quotes').select('*')
  const quote = quotes && quotes.length > 0 ? quotes[dayOfYear % quotes.length] : null

  // Fetch next confirmed visit
  const todayStr = today.toISOString().split('T')[0]
  const { data: nextVisit } = await supabase
    .from('visits')
    .select('*')
    .eq('status', 'confirmed')
    .gte('start_date', todayStr)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Fetch today's check-in for this user
  const { data: todayCheckin } = await supabase
    .from('checkins')
    .select('*')
    .eq('author', user!.email)
    .eq('date', todayStr)
    .maybeSingle()

  // Fetch latest note/doodle from partner
  const { data: latestNote } = await supabase
    .from('notes_and_doodles')
    .select('*')
    .neq('author', user!.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch latest 3 achievements
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  // Fetch this week's moment
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const { data: weekMoment } = await supabase
    .from('weekly_moments')
    .select('*')
    .gte('week_start_date', weekStartStr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch profile info
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle()

  // Fetch pending photo from partner (just the count + latest tag, not the image)
  const { data: pendingPhotos } = await supabase
    .from('photos')
    .select('id, tag, created_at')
    .neq('author', user!.email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)

  // Get partner name for the pending photo card
  const { data: allProfiles } = await supabase.from('users').select('name, email')
  const partnerProfile = allProfiles?.find(p => p.email && p.email !== user!.email)
  const partnerName = partnerProfile?.name ?? 'your love'

  return (
    <HomeClient
      userEmail={user!.email ?? ''}
      userName={profile?.name ?? user!.email?.split('@')[0] ?? 'you'}
      quote={quote}
      nextVisit={nextVisit}
      todayCheckin={todayCheckin}
      latestNote={latestNote}
      achievements={achievements ?? []}
      weekMoment={weekMoment}
      pendingPhotoCount={pendingPhotos?.length ?? 0}
      partnerName={partnerName}
    />
  )
}
