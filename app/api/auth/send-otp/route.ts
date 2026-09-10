import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Supabase Service Role Client (braucht Administrationsrechte zum Code-Generieren)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Wichtig: In .env.local eintragen!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const cleanEmail = email.trim().toLowerCase()

    // 1. Prüfen, ob der Kunde in der Whitelist ist
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('company_name, contact_name, is_active')
      .eq('email', cleanEmail)
      .single()

    if (customerError || !customer || !customer.is_active) {
      return NextResponse.json(
        { error: 'Diese E-Mail-Adresse ist nicht für das B2B-Portal freigeschaltet.' },
        { status: 403 }
      )
    }

    // 2. OTP Code bei Supabase generieren
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
    })

    if (authError || !authData.properties?.email_otp) {
      return NextResponse.json(
        { error: 'Fehler beim Generieren des Sicherheitscodes.' },
        { status: 500 }
      )
    }

    const otpCode = authData.properties.email_otp

    // 3. E-Mail direkt über Resend versenden
    const emailResult = await resend.emails.send({
      from: 'Outback B2B <onboarding@resend.dev>', // Nach Domain-Verifizierung z.B. auth@outback.it
      to: [cleanEmail],
      subject: `${otpCode} ist dein Outback B2B Login-Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
          <h2 style="color: #1a365d; margin-bottom: 8px;">Outback B2B Portal</h2>
          <p style="color: #4a5568; font-size: 16px;">Hallo ${customer.contact_name || customer.company_name},</p>
          <p style="color: #4a5568; font-size: 14px;">dein Sicherheitscode für den Login im B2B-Portal lautet:</p>
          
          <div style="background-color: #f7fafc; border: 2px dashed #cbd5e0; padding: 15px; text-align: center; margin: 20px 0; border-radius: 6px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2b6cb0;">${otpCode}</span>
          </div>

          <p style="color: #718096; font-size: 12px;">Dieser Code ist 1 Stunde lang gültig. Falls du keinen Code angefordert hast, kannst du diese E-Mail einfach ignorieren.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px;" />
          <p style="color: #a0aec0; font-size: 11px; text-align: center;">Outback Sports B2B Plattform</p>
        </div>
      `,
    })

    if (emailResult.error) {
      return NextResponse.json({ error: emailResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Serverfehler' }, { status: 500 })
  }
}