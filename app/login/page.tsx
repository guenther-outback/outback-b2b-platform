'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/context/LanguageContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // language hier explizit mit herausziehen!
  const { language, t } = useLanguage()
  const supabase = createClient()

  // Schritt 1: Auth-Code via Resend-API anfordern
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          language // jetzt korrekt im Scope vorhanden!
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || t('login.error_general'))
      } else {
        setStep('code')
        setMessage(t('login.code_sent_msg'))
      }
    } catch (error) {
      setMessage(t('login.error_general'))
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
      setMessage(t('login.invalid_code_msg') + error.message)
    } else {
      setMessage(t('login.success_redirect'))
      window.location.href = '/shop'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col justify-between p-6 sm:p-12 selection:bg-black selection:text-white">
      {/* Header mit Branding & Sprachauswahl */}
      <div className="flex justify-between items-center w-full max-w-md mx-auto">
        <a href="/" className="text-lg font-black tracking-widest uppercase hover:opacity-70 transition">
          OUTBACK <span className="text-xs font-normal text-gray-500">97</span>
        </a>

        <LanguageSwitcher />
      </div>

      {/* Login Form Container */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wider uppercase mb-2">
            {t('login.title')}
          </h1>
          <p className="text-xs text-gray-500 font-medium tracking-wide">
            {step === 'email' ? t('login.subtitle_email') : t('login.subtitle_code')}
          </p>
        </div>

        {/* System-/Fehlermeldungen */}
        {message && (
          <div className="mb-6 p-3 bg-gray-50 border-l-4 border-black text-xs font-medium text-gray-800">
            {message}
          </div>
        )}

        {/* SCHRITT 1: E-Mail Eingabe */}
        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                {t('login.email_label')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.email_placeholder')}
                className="w-full p-3 border-2 border-gray-200 focus:border-black focus:outline-none text-sm transition-colors rounded-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white hover:bg-gray-800 font-bold py-3.5 px-4 text-xs uppercase tracking-widest transition-all disabled:opacity-50 mt-2"
            >
              {loading ? t('login.checking_email_btn') : t('login.send_code_btn')}
            </button>
          </form>
        ) : (
          /* SCHRITT 2: OTP-Code Eingabe (8-stellig) */
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                {t('login.code_label')}
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                placeholder="12345678"
                className="w-full p-3 border-2 border-gray-200 focus:border-black focus:outline-none text-center text-2xl tracking-widest font-mono transition-colors rounded-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white hover:bg-gray-800 font-bold py-3.5 px-4 text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loading ? t('login.verifying_btn') : t('login.submit_btn')}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setMessage('')
              }}
              className="w-full text-xs text-gray-500 hover:text-black font-semibold tracking-wider uppercase transition-colors text-center pt-2"
            >
              ← {t('login.use_different_email')}
            </button>
          </form>
        )}

        {/* Support Link */}
        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <a
            href="mailto:info@outback.it?subject=Richiesta%20accesso%20B2B"
            className="text-xs text-gray-500 hover:text-black font-semibold tracking-wider uppercase transition-colors"
          >
            ✉️ {t('login.request_access')}
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-gray-400 font-mono uppercase tracking-widest">
        Outback 97 srl — Bergamo (BG)
      </div>
    </div>
  )
}