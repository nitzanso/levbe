'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    // Use the env var in production; fall back to current origin for local dev
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const redirectTo = `${siteUrl}/reset-password`

    await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    // Always show the same message — don't reveal whether the email matched an account
    setLoading(false)
    setSubmitted(true)
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
          {submitted ? (
            /* Success state */
            <div className="text-center">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#2D1B1B' }}>
                Check your email
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#7A5C5C' }}>
                If that address is registered, you&apos;ll get a reset link in the next couple of minutes.
                Check your spam folder too.
              </p>
              <Link
                href="/login"
                className="block w-full py-3 rounded-xl font-semibold text-center text-white"
                style={{ background: '#FF6B6B' }}
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Email form */
            <>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2D1B1B' }}>
                Reset your password
              </h2>
              <p className="text-sm mb-6" style={{ color: '#B08585' }}>
                Enter your email and we&apos;ll send you a link to set a new one.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-opacity"
                  style={{ background: loading ? '#B08585' : '#FF6B6B' }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link href="/login" className="text-sm" style={{ color: '#B08585' }}>
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
