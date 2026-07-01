// Server-only — never import this from a client component

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://levbe-ivory.vercel.app'

// Rotate through these so daily nudges don't feel robotic
const NUDGE_COPY = [
  (name: string) => `${name} hasn't opened Levbe today 🌙 — maybe they just need a little nudge from you`,
  (name: string) => `It's been a quiet day on Levbe — ${name} might be waiting to hear from you 🤍`,
  (_name: string) => `Someone is thinking of you tonight 💛 — open Levbe and say something`,
]

const PING_COPY = [
  (sender: string) => `${sender} is thinking of you right now 💛`,
  (sender: string) => `${sender} poked you on Levbe 👉 — go say hi`,
  (sender: string) => `Someone in the world misses you right now 🌍 — it's ${sender}`,
]

function emailHtml(body: string, ctaLabel: string, ctaHref: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FFFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFAF7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="padding:32px 32px 0;text-align:center;">
            <div style="font-size:40px;margin-bottom:6px;">🩵</div>
            <div style="font-size:26px;font-weight:700;color:#FF6B6B;letter-spacing:-0.5px;">Levbe</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#2D1B1B;">
              ${body}
            </p>
            <a href="${ctaHref}"
               style="display:block;background:#FF6B6B;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:14px;font-size:15px;font-weight:600;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#B08585;">— Levbe 🌿</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function send(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send')
    return
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'Levbe <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    console.error('[email] Resend error', res.status, await res.text())
  }
}

export async function sendPhotoNotification(to: string, senderName: string) {
  const html = emailHtml(
    `<strong>${senderName}</strong> left you a photo to open in Levbe.<br><br>Come open it — they thought of you when they took it ✨`,
    'Open your photo →',
    `${APP_URL}/photos`,
  )
  await send(to, `${senderName} left you something to open 📷`, html)
}

export async function sendNoteNotification(to: string, senderName: string, type: 'note' | 'drawing') {
  const what = type === 'drawing' ? 'a little doodle' : 'a note'
  const html = emailHtml(
    `<strong>${senderName}</strong> left you ${what} in Levbe ✏️`,
    'See it →',
    `${APP_URL}/notes`,
  )
  await send(to, `${senderName} left you a little something ✏️`, html)
}

export async function sendAchievementNotification(to: string, senderName: string) {
  const html = emailHtml(
    `<strong>${senderName}</strong> shared something they're proud of in Levbe 🌟<br><br>Go read it — it might make your day.`,
    'Read it →',
    `${APP_URL}/proud`,
  )
  await send(to, `${senderName} shared something they're proud of 🌟`, html)
}

export async function sendPingNotification(to: string, senderName: string) {
  const copy = PING_COPY[Math.floor(Math.random() * PING_COPY.length)](senderName)
  const html = emailHtml(
    copy,
    'Open Levbe →',
    APP_URL,
  )
  await send(to, `${senderName} is thinking of you 💛`, html)
}

export async function sendReactionNotification(to: string, reactorName: string, emoji: string, entityLabel: string, entityPath: string) {
  const html = emailHtml(
    `<strong>${reactorName}</strong> reacted to your ${entityLabel} with ${emoji}`,
    'See it →',
    `${APP_URL}${entityPath}`,
  )
  await send(to, `${reactorName} reacted to your ${entityLabel} ${emoji}`, html)
}

export async function sendCommentNotification(to: string, commenterName: string, commentText: string, entityLabel: string, entityPath: string) {
  const html = emailHtml(
    `<strong>${commenterName}</strong> left a comment on your ${entityLabel} 💬<br><br>"${commentText}"`,
    'Reply →',
    `${APP_URL}${entityPath}`,
  )
  await send(to, `${commenterName} left a comment 💬`, html)
}

export async function sendTaskCommentNotification(to: string, commenterName: string, taskTitle: string, commentText: string) {
  const html = emailHtml(
    `<strong>${commenterName}</strong> commented on your task "<em>${taskTitle}</em>" 💬<br><br>"${commentText}"`,
    'See the task →',
    `${APP_URL}/tasks`,
  )
  await send(to, `${commenterName} commented on your task 💬`, html)
}

export async function sendDailyNudge(to: string, partnerName: string) {
  const copy = NUDGE_COPY[Math.floor(Math.random() * NUDGE_COPY.length)](partnerName)
  const html = emailHtml(
    copy,
    'Open Levbe →',
    APP_URL,
  )
  await send(to, `It's been quiet today on Levbe 🌙`, html)
}
