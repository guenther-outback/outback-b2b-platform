import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { items, totalAmount, userEmail, note } = await request.json()

    if (!items || items.length === 0 || !userEmail) {
      return NextResponse.json({ error: 'Ungültige Bestelldaten' }, { status: 400 })
    }

    // 1. Lagerbestand atomar via RPC reduzieren (stock_main & stock_external)
    const stockItems = items.map((item: any) => ({
      id: item.id,
      quantity: Number(item.quantity) || 1,
    }))

    const { error: stockError } = await supabaseAdmin.rpc('decrement_stock', {
      items: stockItems,
    })

    if (stockError) {
      console.error('Bestandsaktualisierung fehlgeschlagen:', stockError)
      return NextResponse.json(
        { error: `Bestandsaktualisierung fehlgeschlagen: ${stockError.message}` },
        { status: 500 }
      )
    }

    // 2. Kundendaten aus Supabase laden
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', userEmail.trim().toLowerCase())
      .single()

    const customerInfo = customer ? `
      <strong>Firma:</strong> ${customer.company_name}<br/>
      <strong>Ansprechpartner:</strong> ${customer.contact_name}<br/>
      <strong>Adresse:</strong> ${customer.address}, ${customer.zip_code} ${customer.city}<br/>
      <strong>E-Mail:</strong> ${customer.email}
    ` : `<strong>E-Mail:</strong> ${userEmail}`

    // 3. Bestellung in Supabase speichern
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer?.id || null,
        user_email: userEmail,
        total_amount: totalAmount,
        items: items,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError) console.error('Fehler beim Speichern der Order:', orderError)

    if (order) {
      const orderItems = items.map((item: any) => {
        const price = item.price_ek || item.price_vk || 0
        return {
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: price
        }
      })
      await supabaseAdmin.from('order_items').insert(orderItems)
    }

    // 4. HTML-Tabelle für die E-Mail generieren (mit EK-Preis)
    const itemsHtml = items.map((item: any) => {
      const itemEkPrice = item.price_ek || item.price_vk || 0
      const isMainWarehouse = (Number(item.stock_main) || 0) > 0
      return `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.sku}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <strong>${item.brand}</strong> - ${item.title} ${item.length ? `(${item.length})` : ''}<br/>
                <small style="color: ${isMainWarehouse ? '#059669' : '#d97706'};">
                Lager: ${isMainWarehouse ? 'Hauptlager' : 'Externes Händlerlager'}
                </small>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${itemEkPrice.toFixed(2)} €</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${(itemEkPrice * item.quantity).toFixed(2)} €</td>
        </tr>
      `
    }).join('')

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
        <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 8px;">Neue B2B Bestellung eingegangen</h2>
        
        <h3>Kundeninformationen:</h3>
        <p style="background: #f7fafc; padding: 12px; border-radius: 6px;">
          ${customerInfo}
        </p>

        ${note ? `<p><strong>Anmerkung des Kunden:</strong><br/>${note}</p>` : ''}

        <h3>Bestellte Artikel:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #edf2f7; text-align: left;">
              <th style="padding: 8px;">SKU</th>
              <th style="padding: 8px;">Artikel</th>
              <th style="padding: 8px; text-align: center;">Menge</th>
              <th style="padding: 8px; text-align: right;">EP (Netto EK)</th>
              <th style="padding: 8px; text-align: right;">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 18px; margin-top: 20px;">
          <strong>Gesamtsumme (Netto EK): ${totalAmount.toFixed(2)} €</strong>
        </div>
      </div>
    `

    // 5. E-Mail via Resend schicken
    await resend.emails.send({
      from: 'Outback B2B <onboarding@resend.dev>',
      to: ['guenther@outback.it'],
      replyTo: userEmail,
      subject: `[B2B Bestellung] ${customer?.company_name || userEmail}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Fehler beim Checkout' }, { status: 500 })
  }
}