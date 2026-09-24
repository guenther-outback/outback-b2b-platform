import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function processAndUploadImageUrl(externalUrl: string, sku: string): Promise<string | null> {
  if (!externalUrl || !externalUrl.startsWith('http')) return externalUrl

  // Falls das Bild bereits auf eurem Supabase Storage liegt, direkt wiederverwenden
  if (externalUrl.includes('supabase.co/storage')) {
    return externalUrl
  }

  try {
    // 1. Externes Bild herunterladen
    const response = await fetch(externalUrl, { timeout: 8000 } as any)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // 2. Bild mit Sharp verkleinern (Max 800px) und in leichtes WebP/JPEG umwandeln
    const resizedImageBuffer = await sharp(inputBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    // 3. Eindeutigen Dateinamen im Storage festlegen
    const cleanSku = sku.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `imported/${cleanSku}_${Date.now()}.webp`

    // 4. In den Supabase Bucket 'product-images' hochladen
    const { error: uploadError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(fileName, resizedImageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (uploadError) {
      console.error('Fehler beim Supabase Storage Upload:', uploadError.message)
      return externalUrl // Fallback auf Original-URL bei Fehler
    }

    // 5. Sichere HTTPS-URL von Supabase zurückgeben
    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  } catch (err) {
    console.error('Fehler beim Verarbeiten des Bildes von URL:', externalUrl, err)
    return externalUrl
  }
}