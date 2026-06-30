import { createClient } from '@/lib/supabase/server'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Week start (Monday)
  const weekStart = new Date(today)
  const dow = today.getDay()
  weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Profiles
  const { data: allProfiles } = await supabase.from('users').select('id, name, email, background_url')
  const myProfile = allProfiles?.find(p => p.email === user!.email)
  const partnerProfile = allProfiles?.find(p => p.email !== user!.email)
  const userName = myProfile?.name ?? user!.email?.split('@')[0] ?? 'you'
  const partnerName = partnerProfile?.name ?? 'your love'

  // Next confirmed visit
  const { data: nextVisit } = await supabase
    .from('visits')
    .select('*')
    .eq('status', 'confirmed')
    .gte('start_date', todayStr)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Today's check-in for both partners
  const { data: todayCheckins } = await supabase
    .from('checkins')
    .select('*')
    .eq('date', todayStr)

  const myCheckin = todayCheckins?.find(c => c.author === user!.email) ?? null
  const partnerCheckin = todayCheckins?.find(c => c.author !== user!.email) ?? null

  // This week stats
  const { data: weekCheckins } = await supabase
    .from('checkins')
    .select('mood, author')
    .gte('date', weekStartStr)
    .lte('date', todayStr)

  const { count: weekPhotos } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekStart.toISOString())

  const { count: weekNotes } = await supabase
    .from('notes_and_doodles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekStart.toISOString())

  // Pending photo from partner
  const { data: pendingPhotos } = await supabase
    .from('photos')
    .select('id')
    .neq('author', user!.email)
    .eq('status', 'pending')

  // Weekly highlights
  const { data: weekHighlights } = await supabase
    .from('weekly_highlights')
    .select('*')
    .gte('week_start', weekStartStr)
    .order('created_at', { ascending: true })

  // Latest 3 achievements this week
  const { data: weekAchievements } = await supabase
    .from('achievements')
    .select('*')
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(3)

  // This week's moment
  const { data: weekMoment } = await supabase
    .from('weekly_moments')
    .select('*')
    .gte('week_start_date', weekStartStr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Daily idea — deterministic by day-of-year
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const { data: allIdeas } = await supabase.from('daily_ideas').select('*').order('id')
  const dailyIdea = allIdeas && allIdeas.length > 0 ? allIdeas[dayOfYear % allIdeas.length] : null

  // Dreams
  const { data: dreams } = await supabase
    .from('dreams')
    .select('*')
    .order('created_at', { ascending: true })

  // Daily quote
  const { data: quotes } = await supabase.from('daily_quotes').select('*')
  const quote = quotes && quotes.length > 0 ? quotes[dayOfYear % quotes.length] : null

  // Ping count today
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: todayPingCount } = await supabase
    .from('notification_log')
    .select('*', { count: 'exact', head: true })
    .eq('sender_email', user!.email)
    .eq('type', 'ping')
    .gte('sent_at', todayStart.toISOString())

  return (
    <HomeClient
      userId={user!.id}
      userEmail={user!.email ?? ''}
      userName={userName}
      partnerName={partnerName}
      myBackgroundUrl={myProfile?.background_url ?? null}
      partnerBackgroundUrl={partnerProfile?.background_url ?? null}
      nextVisit={nextVisit}
      myCheckin={myCheckin}
      partnerCheckin={partnerCheckin}
      weekCheckins={weekCheckins ?? []}
      weekPhotos={weekPhotos ?? 0}
      weekNotes={weekNotes ?? 0}
      weekHighlights={weekHighlights ?? []}
      weekAchievements={weekAchievements ?? []}
      weekMoment={weekMoment}
      pendingPhotoCount={pendingPhotos?.length ?? 0}
      dailyIdea={dailyIdea}
      dreams={dreams ?? []}
      quote={quote}
      todayPingCount={todayPingCount ?? 0}
    />
  )
}
