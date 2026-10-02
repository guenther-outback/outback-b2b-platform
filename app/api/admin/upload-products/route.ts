import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processAndUploadImageUrl } from '@/lib/imageDownloader'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { products } = await request.json()

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Dati prodotti non validi' }, { status: 400 })
    }

    // 1. Bilder verarbeiten & hochladen
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

    // 2. DUPLIKATE ENTFERNEN: Falls die gleiche SKU + Länge mehrfach in der Excel vorhanden ist,
    // behalten wir nur den letzten Eintrag, um den Postgres 21000 Fehler zu verhindern.
    const uniqueProductsMap = new Map<string, any>()

    for (const prod of processedProducts) {
      // Eindeutiger Schlüssel aus SKU und Länge (oder nur SKU)
      const uniqueKey = `${(prod.sku || '').trim().toLowerCase()}_${(prod.length || '').trim().toLowerCase()}`
      uniqueProductsMap.set(uniqueKey, prod)
    }

    const deduplicatedProducts = Array.from(uniqueProductsMap.values())

    // 3. Upsert in Supabase ausführen
    const { error } = await supabaseAdmin
      .from('products')
      .upsert(deduplicatedProducts, { onConflict: 'sku,length' })

    if (error) {
      // Falls der Constraint in Supabase nur auf 'sku' liegt, versuchen wir es mit 'sku'
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