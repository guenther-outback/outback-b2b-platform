'use client'

import QuantityInput from '@/components/QuantityInput'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  cart: any[]
  updateQuantity: (id: string, qty: number) => void
  removeFromCart: (id: string) => void
  orderNote: string
  setOrderNote: (note: string) => void
  handleCheckout: (shippingCost: number, grandTotal: number) => void
  orderSubmitting: boolean
  orderSuccess: boolean
  setOrderSuccess: (val: boolean) => void
  t: (key: string) => string
}

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  updateQuantity,
  removeFromCart,
  orderNote,
  setOrderNote,
  handleCheckout,
  orderSubmitting,
  orderSuccess,
  setOrderSuccess,
  t,
}: CartDrawerProps) {
  if (!isOpen) return null

  // --- VERSANDKOSTEN- & MINDESTBESTELLMENGEN-BERECHNUNG ---
  const subtotal = cart.reduce((sum, item) => {
    const price = Number(item.price_ek) || Number(item.price_vk) || 0
    return sum + price * (Number(item.quantity) || 1)
  }, 0)

  // Case-Insensitive Gruppierung nach Marken
  const brandTotals: { [brandKey: string]: { amount: number; qty: number; rawName: string } } = {}

  cart.forEach((item) => {
    const rawBrand = (item.brand || '').trim()
    const brandKey = rawBrand.toLowerCase()
    const qty = Number(item.quantity) || 0
    const price = Number(item.price_ek) || Number(item.price_vk) || 0

    if (!brandTotals[brandKey]) {
      brandTotals[brandKey] = { amount: 0, qty: 0, rawName: rawBrand }
    }
    brandTotals[brandKey].amount += price * qty
    brandTotals[brandKey].qty += qty
  })

  // 1. Mindestmengenprüfungen (Minimo d'ordine)
  const minOrderErrors: string[] = []
  if (brandTotals['akta'] && brandTotals['akta'].qty < 20) {
    minOrderErrors.push(
      t('shop.min_order_akta').replace('{qty}', String(brandTotals['akta'].qty))
    )
  }
  if (brandTotals['suno'] && brandTotals['suno'].qty < 6) {
    minOrderErrors.push(
      t('shop.min_order_suno').replace('{qty}', String(brandTotals['suno'].qty))
    )
  }

  // 2. Einzelmarken Versandkosten & Porto Franco + Aufschlüsselungs-Details
  let shippingCost = 0
  const breakdownLines: string[] = []

  if (brandTotals['akta']) {
    const amt = brandTotals['akta'].amount
    if (amt < 200) {
      shippingCost += 10.0
      const diff = (200 - amt).toFixed(2)
      breakdownLines.push(
        `• Akta: 10,00 € (${t('shop.shipping_missing_for_free').replace('{amount}', diff)})`
      )
    } else {
      breakdownLines.push(`• Akta: ${t('shop.shipping_free')} (≥ 200 €)`)
    }
  }

  if (brandTotals['suno']) {
    const amt = brandTotals['suno'].amount
    if (amt < 150) {
      shippingCost += 7.0
      const diff = (150 - amt).toFixed(2)
      breakdownLines.push(
        `• Suno: 7,00 € (${t('shop.shipping_missing_for_free').replace('{amount}', diff)})`
      )
    } else {
      breakdownLines.push(`• Suno: ${t('shop.shipping_free')} (≥ 150 €)`)
    }
  }

  if (brandTotals['flaxta']) {
    const amt = brandTotals['flaxta'].amount
    if (amt < 150) {
      shippingCost += 12.0
      const diff = (150 - amt).toFixed(2)
      breakdownLines.push(
        `• Flaxta: 12,00 € (${t('shop.shipping_missing_for_free').replace('{amount}', diff)})`
      )
    } else {
      breakdownLines.push(`• Flaxta: ${t('shop.shipping_free')} (≥ 150 €)`)
    }
  }

  // 3. Gemeinsames Hauptlager (Kang, Flipfuel, DPS) -> Porto Franco 300 € kumuliert
  const sharedBrandKeys = ['kang', 'flipfuel', 'dps']
  let sharedTotal = 0
  let hasSharedItems = false
  const activeSharedBrands: string[] = []

  sharedBrandKeys.forEach((key) => {
    if (brandTotals[key]) {
      sharedTotal += brandTotals[key].amount
      hasSharedItems = true
      activeSharedBrands.push(brandTotals[key].rawName)
    }
  })

  if (hasSharedItems) {
    const brandListStr = activeSharedBrands.join(', ')
    const warehouseLabel = t('shop.shipping_main_warehouse')
    if (sharedTotal < 300) {
      shippingCost += 20.0
      const diff = (300 - sharedTotal).toFixed(2)
      breakdownLines.push(
        `• ${brandListStr} (${warehouseLabel}): 20,00 € (${t('shop.shipping_missing_for_free').replace('{amount}', diff)})`
      )
    } else {
      breakdownLines.push(
        `• ${brandListStr} (${warehouseLabel}): ${t('shop.shipping_free')} (≥ 300 €)`
      )
    }
  }

  const isOrderValid = minOrderErrors.length === 0
  const grandTotal = subtotal + shippingCost

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col p-6 shadow-xl">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t('shop.cart')}</h2>
          <button
            onClick={() => {
              onClose()
              setOrderSuccess(false)
            }}
            className="text-gray-600 hover:text-black font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {orderSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-2">✅</span>
            <h3 className="text-xl font-bold text-green-600 mb-2">{t('shop.order_success_title')}</h3>
            <p className="text-sm text-gray-600 mb-6">{t('shop.order_success_sub')}</p>
            <button
              onClick={() => {
                setOrderSuccess(false)
                onClose()
              }}
              className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-slate-800 transition"
            >
              {t('shop.back_to_shop')}
            </button>
          </div>
        ) : (
          <>
            {/* Artikel-Liste */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {cart.length === 0 ? (
                <p className="text-gray-600 font-medium text-center py-8">{t('shop.empty_cart')}</p>
              ) : (
cart.map((item) => {
  const itemEkPrice = item.price_ek || item.price_vk || 0
  const itemSubtotal = itemEkPrice * item.quantity

  const qty = Number(item.quantity) || 1
  const stockMain = Number(item.stock_main) || 0
  const mainQty = Math.min(stockMain, qty)
  const extQty = Math.max(0, qty - mainQty)

  const itemColor = item.color || item.color_name
  const itemLength = item.length

  return (
    <div key={item.id} className="flex justify-between items-start border-b pb-3 gap-3">
      <div className="flex-1 min-w-0">
        {/* Titel */}
        <div className="font-bold text-sm text-gray-900 leading-snug">
          {item.brand} {item.title}
        </div>

        {/* Nur Farbe und Länge (ohne SKU, ohne Icons, ohne Badge) */}
        {(itemColor || itemLength) && (
          <div className="text-xs text-gray-600 font-medium mt-0.5">
            {itemColor && <span>{itemColor}</span>}
            {itemColor && itemLength && <span> | </span>}
            {itemLength && <span>{itemLength}</span>}
          </div>
        )}

        {/* Magazzino Status */}
        <div className="text-[11px] font-medium mt-1">
          {mainQty > 0 && extQty > 0 ? (
            <span className="text-blue-600 font-semibold">
              {t('shop.cart_stock_split_both')
                .replace('{main}', String(mainQty))
                .replace('{ext}', String(extQty))}
            </span>
          ) : mainQty > 0 ? (
            <span className="text-emerald-700 font-semibold">
              {t('shop.cart_stock_split_main').replace('{qty}', String(qty))}
            </span>
          ) : (
            <span className="text-amber-700 font-semibold">
              {t('shop.cart_stock_split_ext').replace('{qty}', String(qty))}
            </span>
          )}
        </div>

        {/* Preise */}
        <div className="text-xs text-blue-600 font-bold mt-1">
          {itemEkPrice.toFixed(2)} €{' '}
          <span className="text-gray-500 font-normal">{t('shop.cart_unit_price')}</span>
          <span className="text-gray-800 font-bold ml-2">
            ({t('shop.cart_subtotal')} {itemSubtotal.toFixed(2)} €)
          </span>
        </div>
      </div>

      {/* Mengen-Eingabe & Entfernen-Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        <QuantityInput
          value={item.quantity || 1}
          min={1}
          onChange={(newQty) => updateQuantity(item.id, newQty)}
        />

        <button
          onClick={() => removeFromCart(item.id)}
          className="text-red-500 text-xs hover:bg-red-50 p-1.5 rounded-full font-bold transition"
          title={t('shop.cart_remove_item')}
        >
          ✕
        </button>
      </div>
    </div>
  )
})
              )}
            </div>

            {/* Zusammenfassung & Versandkosten */}
            {cart.length > 0 && (
              <div className="border-t pt-4 mt-4 space-y-3 bg-gray-50 -mx-6 -mb-6 p-6">
                {/* Fehlermeldungen Mindestmengen */}
                {!isOrderValid && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs space-y-1">
                    <div className="font-bold">⚠️ {t('shop.shipping_min_order_error')}</div>
                    {minOrderErrors.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                )}

                {/* Bestellhinweis */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {t('shop.cart_note_label')}
                  </label>
                  <textarea
                    rows={2}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder={t('shop.cart_note_placeholder')}
                    className="w-full p-2 border border-gray-300 rounded text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* Preistabelle */}
                <div className="space-y-1.5 text-xs">
                  {/* ZWISCHENSUMME ARTIKEL */}
                  <div className="flex justify-between text-gray-600">
                    <span>{t('shop.cart_subtotal_items')}:</span>
                    <span className="font-semibold">{subtotal.toFixed(2)} €</span>
                  </div>

                  {/* SPESE DI TRASPORTO / VERSANDKOSTEN */}
                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>{t('shop.cart_shipping_costs')}:</span>
                      
                      {/* Tooltip Icon (?) */}
                      <div className="group/shipping relative inline-block">
                        <button
                          type="button"
                          className="w-4 h-4 rounded-full bg-gray-200 hover:bg-slate-700 hover:text-white text-gray-600 text-[10px] font-bold flex items-center justify-center transition"
                        >
                          ?
                        </button>

                        {/* Tooltip Popover */}
                        <div className="hidden group-hover/shipping:block absolute bottom-full left-0 mb-2 w-72 p-3 bg-slate-900 text-slate-100 rounded-lg shadow-xl text-[11px] leading-relaxed z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <div className="font-bold border-b border-slate-700 pb-1 mb-1.5 text-slate-200">
                            {t('shop.shipping_detail_title')}
                          </div>
                          {breakdownLines.length > 0 ? (
                            <div className="space-y-1 text-slate-300">
                              {breakdownLines.map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400">{t('shop.shipping_no_costs')}</div>
                          )}
                          <div className="absolute top-full left-1.5 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>

                    {shippingCost === 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                        {t('shop.shipping_free')} (0.00 €)
                      </span>
                    ) : (
                      <span className="font-bold text-gray-800">{shippingCost.toFixed(2)} €</span>
                    )}
                  </div>

                  {/* GESAMTSUMME (NETTO) */}
                  <div className="flex justify-between text-base font-black text-gray-900 border-t pt-2 mt-1">
                    <span>{t('shop.cart_total_net')}:</span>
                    <span>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={() => handleCheckout(shippingCost, grandTotal)}
                  disabled={orderSubmitting || !isOrderValid}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded text-center transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {orderSubmitting ? '...' : t('shop.checkout_btn')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}