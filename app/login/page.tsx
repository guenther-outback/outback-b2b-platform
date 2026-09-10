'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

// Schritt 1: Auth-Code via unserer eigenen Resend-API anfordern
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Fehler beim Senden des Codes.')
      } else {
        setStep('code')
        setMessage('Ein 6-stelliger Code wurde via Resend an deine E-Mail gesendet!')
      }
    } catch (error) {
      setMessage('Netzwerkfehler. Bitte versuche es erneut.')
    }

    setLoading(false)
  }

  // Schritt 2: Code verifizieren
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otpToken.trim(),
      type: 'email',
    })

    if (error) {
      setMessage('Ungültiger oder abgelaufener Code: ' + error.message)
    } else {
      setMessage('Erfolgreich angemeldet! Leite weiter...')
      // Weiterleitung zum Shop
      window.location.href = '/shop'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">Outback B2B Portal</h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          {step === 'email' ? 'Gib deine registrierte E-Mail-Adresse ein' : 'Gib den per E-Mail erhaltenen Code ein'}
        </p>

        {message && (
          <div className="mb-4 p-3 rounded text-sm bg-blue-50 text-blue-700 border border-blue-200">
            {message}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail Adresse</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firma.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Prüfe E-Mail...' : 'Code anfordern'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">6-stelliger Code</label>
              <input
                type="text"
                required
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                placeholder="123456"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Verifiziere...' : 'Anmelden'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-xs text-gray-500 hover:underline text-center block pt-2"
            >
              Andere E-Mail verwenden
            </button>
          </form>
        )}
      </div>
    </div>
  )
}