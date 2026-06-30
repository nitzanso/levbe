interface CardProps {
  children: React.ReactNode
  className?: string
  accent?: 'coral' | 'teal' | 'gold'
}

const accentBorders: Record<string, string> = {
  coral: '#FF6B6B',
  teal: '#4ECDC4',
  gold: '#FFD93D',
}

export default function Card({ children, className = '', accent }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm ${className}`}
      style={{
        borderLeft: accent ? `4px solid ${accentBorders[accent]}` : undefined,
      }}
    >
      {children}
    </div>
  )
}
