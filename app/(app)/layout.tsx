import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SideNav from '@/components/SideNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Update last_seen_at so the daily nudge cron knows who's been active today
  supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

  const [{ count: pendingPhotos }, { data: profile }] = await Promise.all([
    supabase.from('photos').select('*', { count: 'exact', head: true })
      .neq('author', user.email).eq('status', 'pending'),
    supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
  ])

  const userName = profile?.name ?? user.email?.split('@')[0] ?? ''

  return (
    <div className="flex min-h-screen" style={{ background: '#FFFAF7' }}>
      <SideNav pendingPhotos={pendingPhotos ?? 0} userId={user.id} userName={userName} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
