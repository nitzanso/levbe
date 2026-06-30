'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, showBack, action }: PageHeaderProps) {
  const router = useRouter()
  return (
    <div className="px-5 pt-14 pb-4 flex items-start justify-between">
      <div className="flex items-start gap-3">
        {showBack && (
          <button onClick={() => router.back()} className="mt-0.5" style={{ color: '#B08585' }}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: '#2D1B1B' }}>{title}</h1>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: '#B08585' }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="mt-0.5">{action}</div>}
    </div>
  )
}
