import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Mehrsprachige E-Mail-Vorlagen für den Sicherheitscode
const emailTemplates: Record<string, { subject: string; title: string; text: string; footer: string }> = {
  de: {
    subject: 'Dein B2B Anmeldecode — Outback 97',
    title: 'Anmeldung B2B Portal',
    text: 'Nutze den folgenden 8-stelligen Sicherheitscode, um dich im Outback B2B-Portal anzumelden:',
    footer: 'Dieser Code ist kurzzeitig gültig. Falls du keine Anmeldung angefordert hast, kannst du diese E-Mail ignorieren.',
  },
  it: {
    subject: 'Il tuo codice di accesso B2B — Outback 97',
    title: 'Accesso Portale B2B',
    text: 'Utilizza il seguente codice di sicurezza a 8 cifre per accedere al portale B2B Outback:',
    footer: 'Questo codice è valido per un periodo di tempo limitato. Se non hai richiesto l\'accesso, puoi ignorare questa e-mail.',
  },
  en: {
    subject: 'Your B2B Login Code — Outback 97',
    title: 'B2B Portal Sign-In',
    text: 'Use the following 8-digit security code to sign in to the Outback B2B portal:',
    footer: 'This code is valid for a limited time. If you did not request a sign-in code, you can safely ignore this email.',
  },
}

export async function POST(request: Request) {
  try {
    const { email, language = 'it' } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'E-Mail erforderlich' }, { status: 400 })
    }

    // 1. OTP-Code direkt von Supabase generieren lassen
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim().toLowerCase(),
    })

    if (error || !data.properties?.email_otp) {
      console.error('Supabase OTP Generation Error:', error)
      return NextResponse.json(
        { error: error?.message || 'Fehler beim Generieren des Codes' },
        { status: 500 }
      )
    }

    const otpCode = data.properties.email_otp

    // 2. Sprache auswählen (mit Fallback auf Italienisch)
    const langKey = ['de', 'it', 'en'].includes(language) ? language : 'it'
    const t = emailTemplates[langKey]

    // 3. HTML-Mail im Swiss-Brutalist Stil generieren
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #111111; line-height: 1.5;">
        <div style="border-bottom: 2px solid #111111; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
            OUTBACK <span style="font-size: 12px; font-weight: normal; color: #666666;">97 B2B</span>
          </h2>
        </div>

        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; text-transform: uppercase;">
          ${t.title}
        </h3>

        <p style="font-size: 14px; color: #333333; margin-bottom: 24px;">
          ${t.text}
        </p>

        <div style="background-color: #f4f4f5; border: 2px solid #111111; padding: 16px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #000000;">
            ${otpCode}
          </span>
        </div>

        <p style="font-size: 12px; color: #777777; border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 30px;">
          ${t.footer}
        </p>
      </div>
    `

    // 4. E-Mail über Resend absenden
    await resend.emails.send({
      from: 'Outback B2B <info@b2b.outback.it>',
      to: [email.trim().toLowerCase()],
      subject: t.subject,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send OTP Error:', err)
    return NextResponse.json(
      { error: err.message || 'Fehler beim Senden der E-Mail' },
      { status: 500 }
    )
  }
}