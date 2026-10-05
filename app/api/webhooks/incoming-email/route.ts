import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { simpleParser } from 'mailparser'
import ExcelJS from 'exceljs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper zum sicheren Auslesen von Excel-Zellen (selbe Logik wie im Frontend)
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
    // 1. Sicherheit: Webhook-Token prüfen (falls konfiguriert)
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')
    const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // 2. E-Mail Body parsen
    const formData = await request.formData()
    // Je nach Inbound-Provider (Resend, SendGrid, Mailgun) kommt die Mail als raw 'email' oder 'message'
    const rawEmail = formData.get('email') || formData.get('body-mime') || formData.get('message')

    if (!rawEmail) {
      return NextResponse.json({ error: 'Nessun contenuto e-mail trovato' }, { status: 400 })
    }

    const parsedEmail = await simpleParser(rawEmail as any)

    // Optional: Absender-Prüfung
    const sender = parsedEmail.from?.text || ''
    console.log(`[Email Webhook] Ricevuta e-mail da: ${sender}, Oggetto: ${parsedEmail.subject}`)

    // 3. Suche nach Excel-Anhang (.xlsx oder .xls)
    const excelAttachment = parsedEmail.attachments.find(att => 
      att.filename?.toLowerCase().endsWith('.xlsx') || 
      att.filename?.toLowerCase().endsWith('.xls') ||
      att.contentType.includes('spreadsheet')
    )

    if (!excelAttachment) {
      console.log('[Email Webhook] Nessun file Excel allegato trovato.')
      return NextResponse.json({ message: 'Nessun allegato Excel trovato' }, { status: 200 })
    }

    // 4. Excel-Datei direkt im Buffer verarbeiten
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(excelAttachment.content)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Foglio Excel vuoto' }, { status: 400 })
    }

    // Header-Zeile suchen (Zeile 1 bis 10)
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

    // 5. Bestands-Updates vorbereiten
    const updates = rawData.map((row: any) => {
      const sku = String(row['SKU Number'] || row['SKU_Number'] || row.SKU || row.sku || '').trim()
      const stockMainRaw = row.GiacenzaPrincipale || row.Stock || row.BestandHauptlager || row.stock_main || 0
      const stockExtRaw = row.GiacenzaEsterna || row.BestandAussenlager || row.stock_external || 0

      return {
        sku,
        stock_main: parseStockValue(stockMainRaw),
        stock_external: parseStockValue(stockExtRaw)
      }
    }).filter(item => item.sku !== '')

    // Duplikate filtern
    const uniqueStockMap = new Map<string, any>()
    for (const item of updates) {
      uniqueStockMap.set(item.sku.toLowerCase(), item)
    }
    const deduplicatedStock = Array.from(uniqueStockMap.values())

    // 6. Supabase-Update durchführen
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
      sender 
    })

  } catch (err: any) {
    console.error('[Email Webhook Error]:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}