import { createClient } from '@/lib/supabase/server'
import NotesClient from './NotesClient'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notes } = await supabase
    .from('notes_and_doodles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).maybeSingle()

  return <NotesClient userId={user!.id} userEmail={user!.email ?? ''} userName={profile?.name ?? ''} notes={notes ?? []} />
}
