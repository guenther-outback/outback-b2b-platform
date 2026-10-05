import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import ExcelJS from 'exceljs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Helper zum sicheren Auslesen von Excel-Zellen
const getCellValue = (cell: any): string => {
  if (!cell || cell.value === null || cell.value === undefined) return ''
  let val = cell.value
  if (typeof val === 'object') {
    if ('result' in val && val.result !== null && val.result !== undefined) val = val.result
    else if ('text' in val && val.text !== null && val.text !== undefined) val = val.text
    else if ('richText' in val && Array.isArray(val.richText)) val = val.richText.map((rt: any) => rt.text || '').join('')
    else return ''
  }
  return String(val).trim()
}

// Helper zum Säubern von Mengenangaben ("50+" -> 50)
const parseStockValue = (val: any) => {
  if (val === null || val === undefined) return 0
  const strVal = String(val).replace(/[^0-9]/g, '')
  return parseInt(strVal, 10) || 0
}

export async function POST(request: Request) {
  try {
    // 1. Secret/Token aus Query-Parametern prüfen
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')
    const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // 2. Resend JSON-Body parsen
    const payload = await request.json()
    const emailData = payload?.data

    if (!emailData || !emailData.email_id) {
      return NextResponse.json({ message: 'Nessun dato e-mail valido ricevuto' }, { status: 200 })
    }

    const emailId = emailData.email_id

 // 3. Empfangene E-Mail samt Anhängen über das Inbound/Receiving API-Modul abrufen
    const { data: fullEmail, error: fetchError } = await resend.emails.receiving.get(emailId)

    if (fetchError || !fullEmail) {
      // Fallback: Falls attachments bereits im Webhook-Payload enthalten sind
      if (emailData.attachments && emailData.attachments.length > 0) {
        console.log('[Email Webhook] Verwende Webhook-Payload Attachments als Fallback.')
      } else {
        throw new Error(`Impossibile recuperare l'email da Resend: ${fetchError?.message || 'Email non trovata'}`)
      }
    }

    const attachments = fullEmail?.attachments || emailData.attachments || []

    // 4. Nach Excel-Anhang (.xlsx / .xls) suchen
    const excelAttachment = attachments.find((att: any) =>
      att.filename?.toLowerCase().endsWith('.xlsx') ||
      att.filename?.toLowerCase().endsWith('.xls') ||
      att.content_type?.includes('spreadsheet')
    )

    if (!excelAttachment || !excelAttachment.content) {
      console.log('[Email Webhook] Nessun allegato Excel valido trovato nella mail.')
      return NextResponse.json({ message: 'Nessun allegato Excel trovato' }, { status: 200 })
    }

    // 5. Attachment Content sicher in ein Uint8Array umwandeln
    let fileBuffer: Uint8Array

    if (Buffer.isBuffer(excelAttachment.content)) {
      fileBuffer = new Uint8Array(excelAttachment.content)
    } else if (typeof excelAttachment.content === 'string') {
      fileBuffer = new Uint8Array(Buffer.from(excelAttachment.content, 'base64'))
    } else {
      fileBuffer = new Uint8Array(Buffer.from(excelAttachment.content as any))
    }

    // 6. Excel im Speicher verarbeiten
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileBuffer as any)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Foglio Excel vuoto' }, { status: 400 })
    }

    // Header-Zeile dynamisch suchen (Zeile 1 bis 10)
    let headerRowIndex = 1
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 10) {
        row.eachCell((cell) => {
          const val = getCellValue(cell).toLowerCase()
          if (val === 'sku' || val === 'sku number' || val === 'sku_number') {
            headerRowIndex = rowNumber
          }
        })
      }
    })

    const headers: { [colNumber: number]: string } = {}
    const rawData: any[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === headerRowIndex) {
        row.eachCell((cell, colNumber) => {
          const headerText = getCellValue(cell)
          if (headerText) headers[colNumber] = headerText
        })
      } else if (rowNumber > headerRowIndex) {
        const rowObj: any = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber]
          if (header) rowObj[header] = getCellValue(cell)
        })
        if (Object.keys(rowObj).length > 0) rawData.push(rowObj)
      }
    })

    // 7. Bestände aufbereiten
    const updates = rawData.map((row: any) => {
      const sku = String(row['SKU Number'] || row['SKU_Number'] || row.SKU || row.sku || '').trim()
      const stockMainRaw = row.GiacenzaPrincipale || row.Stock || row.BestandHauptlager || row.stock_main || 0
      const stockExtRaw = row.GiacenzaEsterna || row.BestandAussenlager || row.stock_external || 0

      return {
        sku,
        stock_main: parseStockValue(stockMainRaw),
        stock_external: parseStockValue(stockExtRaw)
      }
    }).filter((item: any) => item.sku !== '')

    // Duplikate entfernen
    const uniqueStockMap = new Map<string, any>()
    for (const item of updates) {
      uniqueStockMap.set(item.sku.toLowerCase(), item)
    }
    const deduplicatedStock = Array.from(uniqueStockMap.values())

    // 8. Supabase-Update durchführen
    let updatedCount = 0
    for (const item of deduplicatedStock) {
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          stock_main: item.stock_main,
          stock_external: item.stock_external,
        })
        .eq('sku', item.sku)

      if (!error) updatedCount++
    }

    console.log(`[Email Webhook] Successo! Aggiornati ${updatedCount} prodotti da e-mail.`)

    return NextResponse.json({
      success: true,
      message: `Aggiornati ${updatedCount} prodotti con successo da allegato e-mail`,
      from: emailData.from
    })

  } catch (err: any) {
    console.error('[Email Webhook Error]:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}