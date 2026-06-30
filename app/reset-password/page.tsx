'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PageState = 'loading' | 'ready' | 'invalid' | 'success'

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout>

    // Supabase sets up a session automatically when it detects the recovery token
    // in the URL hash (#access_token=...&type=recovery). We listen for that event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        clearTimeout(timeout)
        setPageState('ready')
      }
    })

    // Also check if a session is already active (e.g. second render after token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        clearTimeout(timeout)
        setPageState('ready')
      }
    })

    // If nothing fires in 4 seconds, the link is invalid or already used
    timeout = setTimeout(() => {
      setPageState(prev => prev === 'loading' ? 'invalid' : prev)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('Something went wrong — try requesting a new reset link.')
      setSaving(false)
      return
    }

    setPageState('success')
    setTimeout(() => router.push('/home'), 2000)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #FFE5E5 0%, #FFF8D6 50%, #E0F7F5 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3 inline-block">🩵</div>
          <h1 className="text-4xl font-bold" style={{ color: '#FF6B6B' }}>Levbe</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">

          {/* Loading — waiting for Supabase to parse the URL token */}
          {pageState === 'loading' && (
            <div className="text-center py-4">
              <div className="text-3xl mb-4 animate-pulse">🔑</div>
              <p className="text-sm" style={{ color: '#B08585' }}>Checking your reset link…</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === 'invalid' && (
            <div className="text-center">
              <div className="text-4xl mb-4">😕</div>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#2D1B1B' }}>Link expired</h2>
              <p className="text-sm mb-6" style={{ color: '#7A5C5C' }}>
                This reset link is invalid or has already been used. Links expire after 1 hour.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full py-3 rounded-xl font-semibold text-center text-white"
                style={{ background: '#FF6B6B' }}
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* Password form */}
          {pageState === 'ready' && (
            <>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2D1B1B' }}>Set a new password</h2>
              <p className="text-sm mb-6" style={{ color: '#B08585' }}>At least 8 characters.</p>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#7A5C5C' }}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors text-sm"
                    style={{ borderColor: '#F5EDE8', color: '#2D1B1B' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#FF6B6B'}
                    onBlur={e => e.currentTarget.style.borderColor = '#F5EDE8'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#7A5C5C' }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
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
                  disabled={saving}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-opacity"
                  style={{ background: saving ? '#B08585' : '#FF6B6B' }}
                >
                  {saving ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            </>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2D1B1B' }}>Password updated</h2>
              <p className="text-sm" style={{ color: '#B08585' }}>Taking you home…</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
