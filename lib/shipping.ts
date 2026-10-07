export interface CartItem {
  id: string
  brand: string
  quantity: number
  price_ek: number
  price_vk: number
  [key: string]: any
}

export interface ShippingValidationResult {
  shippingCost: number
  isValid: boolean
  minOrderErrors: string[]
  brandTotals: { [brand: string]: { amount: number; qty: number } }
}

export function calculateShippingAndValidation(cart: CartItem[]): ShippingValidationResult {
  let shippingCost = 0
  const minOrderErrors: string[] = []

  // Gruppierung nach Marken
  const brandTotals: { [brand: string]: { amount: number; qty: number } } = {}

  cart.forEach((item) => {
    const brand = (item.brand || '').trim()
    const qty = Number(item.quantity) || 0
    const price = Number(item.price_ek) || Number(item.price_vk) || 0

    if (!brandTotals[brand]) {
      brandTotals[brand] = { amount: 0, qty: 0 }
    }
    brandTotals[brand].amount += price * qty
    brandTotals[brand].qty += qty
  })

  // 1. Überprüfung Mindestbestellmengen (Minimo d'ordine)
  if (brandTotals['Akta'] && brandTotals['Akta'].qty < 20) {
    minOrderErrors.push(`Akta richiede un ordine minimo di 20 pezzi (attualmente: ${brandTotals['Akta'].qty} pz).`)
  }

  if (brandTotals['Suno'] && brandTotals['Suno'].qty < 6) {
    minOrderErrors.push(`Suno richiede un ordine minimo di 6 pezzi (attualmente: ${brandTotals['Suno'].qty} pz).`)
  }

  // 2. Berechnung Versandkosten für Einzelmarken (Lager getrennt)
  
  // AKTA
  if (brandTotals['Akta']) {
    if (brandTotals['Akta'].amount < 200) {
      shippingCost += 10.0
    }
  }

  // SUNO
  if (brandTotals['Suno']) {
    if (brandTotals['Suno'].amount < 150) {
      shippingCost += 7.0
    }
  }

  // FLAXTA
  if (brandTotals['Flaxta']) {
    if (brandTotals['Flaxta'].amount < 150) {
      shippingCost += 12.0
    }
  }

  // 3. Gemeinsames Hauptlager (Kang, Flipfuel, DPS)
  const sharedGroupBrands = ['Kang', 'Flipfuel', 'DPS']
  let sharedGroupTotal = 0
  let hasSharedGroupItems = false

  sharedGroupBrands.forEach((b) => {
    if (brandTotals[b]) {
      sharedGroupTotal += brandTotals[b].amount
      hasSharedGroupItems = true
    }
  })

  if (hasSharedGroupItems) {
    // Wenn die Kombination aus Kang + Flipfuel + DPS unter 300€ liegt, fallen einmalig 20€ Versand an
    if (sharedGroupTotal < 300) {
      shippingCost += 20.0
    }
  }

  // Zusätzliche Marken (Falls neue hinzukommen, die nicht definiert sind)
  Object.keys(brandTotals).forEach((b) => {
    if (!['Akta', 'Suno', 'Flaxta', ...sharedGroupBrands].includes(b)) {
      // Standard-Fallback falls nötig
    }
  })

  return {
    shippingCost,
    isValid: minOrderErrors.length === 0,
    minOrderErrors,
    brandTotals,
  }
}