'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Wrong email or password. Try again.')
      setLoading(false)
    } else {
      router.push('/home')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(135deg, #FFE5E5 0%, #FFF8D6 50%, #E0F7F5 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3 heartbeat inline-block">🩵</div>
          <h1 className="text-4xl font-bold" style={{ color: '#FF6B6B' }}>Levbe</h1>
          <p className="text-sm mt-2" style={{ color: '#B08585' }}>Heart in Hebrew, love in German</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: '#2D1B1B' }}>Welcome back</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#7A5C5C' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors text-sm"
                style={{ borderColor: '#F5EDE8', color: '#2D1B1B' }}
                onFocus={e => e.currentTarget.style.borderColor = '#FF6B6B'}
                onBlur={e => e.currentTarget.style.borderColor = '#F5EDE8'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#7A5C5C' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors text-sm"
                style={{ borderColor: '#F5EDE8', color: '#2D1B1B' }}
                onFocus={e => e.currentTarget.style.borderColor = '#FF6B6B'}
                onBlur={e => e.currentTarget.style.borderColor = '#F5EDE8'}
              />
            </div>

            {error && (
              <p className="text-sm text-center py-2 px-3 rounded-lg" style={{ background: '#FFE5E5', color: '#E85555' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity mt-2"
              style={{ background: loading ? '#B08585' : '#FF6B6B' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#B08585' }}>
          Private — just for Nitzan & Jens ♡
        </p>
      </div>
    </div>
  )
}
