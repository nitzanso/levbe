import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SideNav from '@/components/SideNav'
import NudgeDrawer from '@/components/NudgeDrawer'

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

  const today = localDateStr(new Date())
  const threeDaysAgo = localDateStr(new Date(Date.now() - 3 * 86400000))

  const [
    { count: pendingPhotos },
    { data: profile },
    { data: todayEntries },
    { data: recentDoodles },
    { count: openTasks },
    { data: confirmedVisits },
    { data: confirmedMoments },
  ] = await Promise.all([
    supabase.from('photos').select('*', { count: 'exact', head: true })
      .neq('author', user.email).eq('status', 'pending'),
    supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
    supabase.from('day_entries').select('id').eq('author', user.id).eq('date', today).limit(1),
    supabase.from('day_entries').select('id').eq('author', user.id).eq('type', 'doodle').gte('date', threeDaysAgo).limit(1),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .neq('status', 'done').neq('status', 'backlog'),
    supabase.from('visits').select('id').eq('status', 'confirmed').gte('start_date', today).limit(1),
    supabase.from('weekly_moments').select('id').eq('confirmed', true).gte('week_start_date', today).limit(1),
  ])

  const userName = profile?.name ?? user.email?.split('@')[0] ?? ''

  return (
    <div className="flex min-h-screen" style={{ background: '#FFFAF7' }}>
      <SideNav pendingPhotos={pendingPhotos ?? 0} userId={user.id} userName={userName} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
      <NudgeDrawer
        hasEntryToday={(todayEntries?.length ?? 0) > 0}
        hasDoodleRecent={(recentDoodles?.length ?? 0) > 0}
        hasOpenTasks={(openTasks ?? 0) > 0}
        hasConfirmedVisit={(confirmedVisits?.length ?? 0) > 0}
        hasDateNightThisWeek={(confirmedMoments?.length ?? 0) > 0}
      />
    </div>
  )
}
