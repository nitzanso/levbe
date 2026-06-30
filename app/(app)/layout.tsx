import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Update last_seen_at so the daily nudge cron knows who's been active today
  supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

  const { count: pendingPhotos } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .neq('author', user.email)
    .eq('status', 'pending')

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FFFAF7' }}>
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <BottomNav pendingPhotos={pendingPhotos ?? 0} />
    </div>
  )
}
