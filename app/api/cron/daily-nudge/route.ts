import { createClient } from '@supabase/supabase-js'
import { sendDailyNudge } from '@/lib/email'

// This route is called by Vercel Cron at 17:00 UTC (= 19:00 CEST / 20:00 IST in summer)
// It checks who hasn't been seen today and sends the other person a gentle nudge

export async function GET(request: Request) {
  // Protect against random callers
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Use service role to bypass RLS — this endpoint has no user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStr = todayStart.toISOString()

  // Fetch all users with email + last_seen_at
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, last_seen_at')

  if (error || !users || users.length < 2) {
    console.error('[cron] Could not fetch users', error)
    return Response.json({ error: 'Users not found' }, { status: 500 })
  }

  const results: string[] = []

  for (const user of users) {
    if (!user.email) continue

    const seenToday = user.last_seen_at && user.last_seen_at >= todayStr

    if (seenToday) {
      results.push(`${user.name ?? user.email}: seen today — no nudge`)
      continue
    }

    // Find the partner (the other user)
    const partner = users.find(u => u.id !== user.id)
    if (!partner?.email) continue

    // Avoid sending duplicate nudges to the same recipient today
    const { count } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', partner.email)
      .eq('type', 'daily_nudge')
      .gte('sent_at', todayStr)

    if ((count ?? 0) > 0) {
      results.push(`${partner.name ?? partner.email}: nudge already sent today — skipping`)
      continue
    }

    await supabase.from('notification_log').insert({
      recipient_email: partner.email,
      sender_email: null,
      type: 'daily_nudge',
    })

    const absentName = user.name ?? user.email.split('@')[0]
    await sendDailyNudge(partner.email, absentName)
    results.push(`Nudged ${partner.name ?? partner.email} about ${absentName}`)
  }

  return Response.json({ ok: true, results })
}
