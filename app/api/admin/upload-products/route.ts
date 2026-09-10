import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY fehlt in der .env.local Datei!' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { products } = await request.json()

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Keine gültigen Produkte übergeben' }, { status: 400 })
    }

    // DUPLIKATE FILTERN:
    // Falls dieselbe Kombination aus SKU + Länge mehrfach in der Excel vorkommt,
    // behalten wir nur den jeweils letzten Eintrag.
    const uniqueProductsMap = new Map<string, any>()

    products.forEach((p) => {
      const compositeKey = `${p.sku.toLowerCase().trim()}_${(p.length || '').toLowerCase().trim()}`
      uniqueProductsMap.set(compositeKey, p)
    })

    const deduplicatedProducts = Array.from(uniqueProductsMap.values())

    // Upsert mit den bereinigten Daten durchführen
    const { error } = await supabaseAdmin
      .from('products')
      .upsert(deduplicatedProducts, { onConflict: 'sku,length' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: deduplicatedProducts.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Interner Serverfehler' }, { status: 500 })
  }
}