// Affectionate nicknames for the two users.
// Falls back to the raw name if no mapping is defined.
const MAP: Record<string, string> = {
  nitzan: 'Nitzi',
  jens:   'Jensi',
}

/** "Nitzan" → "Nitzi", "Jens" → "Jensi", anything else → name as-is */
export function nickname(name: string): string {
  return MAP[name.toLowerCase()] ?? name
}

/** Given the logged-in user's display name, returns the partner's nickname */
export function partnerNick(myName: string): string {
  const lower = myName.toLowerCase()
  if (lower === 'nitzan' || lower === 'nitzi') return 'Jensi'
  if (lower === 'jens'   || lower === 'jensi') return 'Nitzi'
  return 'your love'
}
