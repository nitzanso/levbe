import { createClient } from '@/lib/supabase/server'

// GET /api/test-notification
// Inserts a test notification for the current user so you can confirm the pipeline works.
// Open browser console and run:  fetch('/api/test-notification').then(r=>r.json()).then(console.log)
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ step: 'auth', ok: false, error: 'Not logged in' }, { status: 401 })
  }

  // Step 1: confirm the notifications table exists by counting rows
  const { count, error: countError } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient', user.id)

  if (countError) {
    return Response.json({
      step: 'table_check',
      ok: false,
      error: countError.message,
      fix: 'Run supabase-notifications-v2.sql in Supabase SQL Editor, then reload.',
    })
  }

  // Step 2: insert a test notification for self
  const { data: inserted, error: insertError } = await supabase
    .from('notifications')
    .insert({
      recipient: user.id,
      type: 'ping',
      message: '🧪 Test notification — if you see this in the bell, it works!',
      read: false,
    })
    .select()
    .single()

  if (insertError) {
    return Response.json({
      step: 'insert',
      ok: false,
      error: insertError.message,
      fix: 'RLS might be blocking the insert. Check the n_insert policy in Supabase.',
    })
  }

  return Response.json({
    step: 'all_good',
    ok: true,
    userId: user.id,
    existingCount: count,
    inserted,
    next: 'Check the bell icon — you should see a new notification immediately.',
  })
}
