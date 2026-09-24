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
      return NextResponse.json({ error: 'Dati ordine non validi' }, { status: 400 })
    }

    // 1. Riduzione atomica dello stock in Supabase via RPC (stock_main & stock_external)
    const stockItems = items.map((item: any) => ({
      id: item.id,
      quantity: Number(item.quantity) || 1,
    }))

    const { error: stockError } = await supabaseAdmin.rpc('decrement_stock', {
      items: stockItems,
    })

    if (stockError) {
      console.error('Aggiornamento magazzino fallito:', stockError)
      return NextResponse.json(
        { error: `Aggiornamento magazzino fallito: ${stockError.message}` },
        { status: 500 }
      )
    }

    // 2. Caricamento dati cliente da Supabase
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', userEmail.trim().toLowerCase())
      .single()

    const customerInfo = customer ? `
      <strong>Azienda:</strong> ${customer.company_name}<br/>
      <strong>Referente:</strong> ${customer.contact_name}<br/>
      <strong>Indirizzo:</strong> ${customer.address}, ${customer.zip_code} ${customer.city}<br/>
      <strong>E-mail:</strong> ${customer.email}
    ` : `<strong>E-mail:</strong> ${userEmail}`

    // 3. Salvataggio dell'ordine nella tabella 'orders'
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

    if (orderError) console.error('Errore durante il salvataggio dell\'ordine:', orderError)

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

    // 4. Generazione della tabella HTML per l'email in italiano (con ripartizione dei magazzini)
    const itemsHtml = items.map((item: any) => {
      const itemEkPrice = item.price_ek || item.price_vk || 0
      const qty = Number(item.quantity) || 1
      const stockMain = Number(item.stock_main) || 0

      // Calcolo esatto della ripartizione tra magazzino principale ed esterno
      const mainQty = Math.min(stockMain, qty)
      const extQty = Math.max(0, qty - mainQty)

      let warehouseText = ''
      let warehouseColor = '#059669' // Verde per magazzino principale

      if (extQty === 0) {
        warehouseText = 'Magazzino: Magazzino Principale'
      } else if (mainQty === 0) {
        warehouseText = 'Magazzino: Magazzino Esterno'
        warehouseColor = '#d97706' // Arancione per magazzino esterno
      } else {
        warehouseText = `Magazzino: ${mainQty}x Principale / ${extQty}x Esterno`
        warehouseColor = '#2563eb' // Blu per magazzino misto
      }

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${item.sku}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <strong>${item.brand}</strong> - ${item.title} ${item.length ? `(${item.length})` : ''}<br/>
            <small style="color: ${warehouseColor}; font-weight: bold;">
              ${warehouseText}
            </small>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${itemEkPrice.toFixed(2)} €</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(itemEkPrice * qty).toFixed(2)} €</td>
        </tr>
      `
    }).join('')

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #2d3748; line-height: 1.5;">
        <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 8px;">Nuovo Ordine B2B Ricevuto</h2>
        
        <h3 style="color: #2b6cb0; margin-top: 20px;">Informazioni Cliente:</h3>
        <p style="background: #f7fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
          ${customerInfo}
        </p>

        ${note ? `<p style="background: #fffaf0; padding: 12px; border-radius: 6px; border: 1px solid #feebc8;"><strong>Nota del cliente:</strong><br/>${note}</p>` : ''}

        <h3 style="color: #2b6cb0; margin-top: 25px;">Articoli Ordinati:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #edf2f7; text-align: left; color: #4a5568;">
              <th style="padding: 10px;">SKU</th>
              <th style="padding: 10px;">Articolo</th>
              <th style="padding: 10px; text-align: center;">Quantità</th>
              <th style="padding: 10px; text-align: right;">Prezzo Unitario (Netto)</th>
              <th style="padding: 10px; text-align: right;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 18px; margin-top: 20px; padding-top: 10px; border-top: 2px solid #e2e8f0;">
          <strong>Importo Totale (Netto): ${totalAmount.toFixed(2)} €</strong>
        </div>

        <p style="font-size: 12px; color: #a0aec0; margin-top: 40px; text-align: center;">
          Questa è una notifica automatica dal Portale B2B Outback.
        </p>
      </div>
    `

    // 5. Invio e-mail tramite Resend utilizzando il dominio verificato
    await resend.emails.send({
      from: 'Outback B2B <info@b2b.outback.it>',
      to: ['info@outback.it'],
      replyTo: userEmail,
      subject: `[Ordine B2B] ${customer?.company_name || userEmail}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore durante il checkout' }, { status: 500 })
  }
}