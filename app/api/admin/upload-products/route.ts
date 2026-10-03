import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processAndUploadImageUrl } from '@/lib/imageDownloader'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { products, mode } = await request.json()

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Dati prodotti non validi' }, { status: 400 })
    }

    // A) REINER BESTANDS-UPDATE (nur SKU, stock_main, stock_external)
    if (mode === 'stock_only') {
      const updates = products.map((p: any) => ({
        sku: (p.sku || '').trim(),
        length: (p.length || '').trim(),
        stock_main: parseInt(p.stock_main) || 0,
        stock_external: parseInt(p.stock_external) || 0,
      }))

      // Duplikate im selben File filtern
      const uniqueStockMap = new Map<string, any>()
      for (const item of updates) {
        const key = `${item.sku.toLowerCase()}_${item.length.toLowerCase()}`
        uniqueStockMap.set(key, item)
      }
      const deduplicatedStock = Array.from(uniqueStockMap.values())

      for (const item of deduplicatedStock) {
        let query = supabaseAdmin
          .from('products')
          .update({
            stock_main: item.stock_main,
            stock_external: item.stock_external,
          })
          .eq('sku', item.sku)

        if (item.length) {
          query = query.eq('length', item.length)
        }

        const { error } = await query
        if (error) console.error(`Fehler bei SKU ${item.sku}:`, error.message)
      }

      return NextResponse.json({ success: true, count: deduplicatedStock.length })
    }

    // B) VOLLSTÄNDIGER IMPORT (Produkte + Bilder + Bestände)
    const processedProducts = await Promise.all(
      products.map(async (p: any) => {
        let imageUrl = p.image_url

        if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('supabase.co')) {
          const securePublicUrl = await processAndUploadImageUrl(imageUrl, p.sku)
          if (securePublicUrl) imageUrl = securePublicUrl
        }

        return {
          ...p,
          image_url: imageUrl,
        }
      })
    )

    const uniqueProductsMap = new Map<string, any>()
    for (const prod of processedProducts) {
      const uniqueKey = `${(prod.sku || '').trim().toLowerCase()}_${(prod.length || '').trim().toLowerCase()}`
      uniqueProductsMap.set(uniqueKey, prod)
    }

    const deduplicatedProducts = Array.from(uniqueProductsMap.values())

    const { error } = await supabaseAdmin
      .from('products')
      .upsert(deduplicatedProducts, { onConflict: 'sku,length' })

    if (error) {
      if (error.message.includes('onConflict') || error.code === '42704') {
        const { error: fallbackError } = await supabaseAdmin
          .from('products')
          .upsert(deduplicatedProducts, { onConflict: 'sku' })

        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, count: deduplicatedProducts.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore durante l\'importazione' }, { status: 500 })
  }
}