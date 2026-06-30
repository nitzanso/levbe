import { createClient } from '@/lib/supabase/server'
import PhotosClient from './PhotosClient'

export default async function PhotosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user!.email ?? ''

  const [
    { data: myPhotos },
    { data: partnerRevealed },
    { data: partnerPending },
    { data: allProfiles },
    { data: profile },
  ] = await Promise.all([
    // My own photos — all statuses, full data (I can always see what I sent)
    supabase.from('photos').select('*')
      .eq('author', userEmail)
      .order('created_at', { ascending: false }),

    // Partner's revealed photos — full data, go into shared feed
    supabase.from('photos').select('*')
      .neq('author', userEmail)
      .eq('status', 'revealed')
      .order('revealed_at', { ascending: false }),

    // Partner's pending photos — NO image_path so it can't be rendered until revealed
    supabase.from('photos')
      .select('id, author, caption, status, tag, created_at, revealed_at')
      .neq('author', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    supabase.from('users').select('name, email'),
    supabase.from('users').select('name, avatar_color').eq('id', user!.id).maybeSingle(),
  ])

  const partnerProfile = allProfiles?.find(p => p.email && p.email !== userEmail)
  const partnerName = partnerProfile?.name ?? 'your love'

  return (
    <PhotosClient
      userId={user!.id}
      userEmail={userEmail}
      userName={profile?.name ?? userEmail.split('@')[0]}
      partnerName={partnerName}
      myPhotos={myPhotos ?? []}
      partnerRevealed={partnerRevealed ?? []}
      partnerPending={partnerPending ?? []}
    />
  )
}
