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

    // Bilder im Hintergrund herunterladen, verkleinern und zu Supabase hochladen
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

    // Upsert in die Produktdatenbank mit den neuen, sicheren Bild-URLs
    const { error } = await supabaseAdmin
      .from('products')
      .upsert(processedProducts, { onConflict: 'sku,length' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: processedProducts.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore durante l\'importazione' }, { status: 500 })
  }
}