'use client'

import { useState, useEffect } from 'react'
import QuantityInput from '@/components/QuantityInput'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  cart: any[]
  updateQuantity: (id: string, qty: number) => void
  removeFromCart: (id: string) => void
  orderNote: string
  setOrderNote: (note: string) => void
  handleCheckout: (shippingCost: number, grandTotal: number, deliveryDate: string) => void
  orderSubmitting: boolean
  orderSuccess: boolean
  setOrderSuccess: (val: boolean) => void
  isAgent?: boolean
  agentCustomerNote?: string
  setAgentCustomerNote?: (val: string) => void
  customersList?: any[]
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
  isAgent = false,
  agentCustomerNote = '',
  setAgentCustomerNote = () => {},
  customersList = [],
  t,
}: CartDrawerProps) {
  const getTodayISO = () => new Date().toISOString().split('T')[0]
  const [deliveryDate, setDeliveryDate] = useState(getTodayISO())
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('custom')

  useEffect(() => {
    if (isOpen && !deliveryDate) {
      setDeliveryDate(getTodayISO())
    }
  }, [isOpen])

  if (!isOpen) return null

  // --- VERSANDKOSTEN- & MINDESTBESTELLMENGEN-BERECHNUNG ---
  const subtotal = cart.reduce((sum, item) => {
    const price = Number(item.price_ek) || Number(item.price_vk) || 0
    return sum + price * (Number(item.quantity) || 1)
  }, 0)

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

  // 1. Mindestmengenprüfungen
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

  // 2. Einzelmarken Versandkosten
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

  // 3. Hauptlager
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

  const isAgentValid = !isAgent || agentCustomerNote.trim().length > 0
  const isOrderValid = minOrderErrors.length === 0 && isAgentValid
  const grandTotal = subtotal + shippingCost

  const handleSelectCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedCustomerId(val)

    if (val === 'custom') {
      setAgentCustomerNote('')
    } else {
      const selected = customersList.find((c) => c.id === val)
      if (selected) {
        setAgentCustomerNote(`${selected.company_name} (${selected.contact_name} - ${selected.email})`)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      {/* NURFALLS 1 SCROLLBAR: Der gesamte Drawer scrollt als eine einzige Einheit */}
      <div className="bg-white w-full max-w-md h-full h-[100dvh] flex flex-col overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">{t('shop.cart')}</h2>
          <button
            onClick={() => {
              onClose()
              setOrderSuccess(false)
            }}
            className="text-gray-500 hover:text-black font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        {orderSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
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
          <div className="p-4 space-y-5 flex-1 flex flex-col justify-between">
            {/* ARTIKEL-LISTE */}
            <div className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-gray-500 font-medium text-center py-12">{t('shop.empty_cart')}</p>
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
                    <div key={item.id} className="flex justify-between items-start border-b pb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                          {item.brand} {item.title}
                        </div>

                        {(itemColor || itemLength) && (
                          <div className="text-[11px] text-gray-600 font-medium mt-0.5">
                            {itemColor && <span>{itemColor}</span>}
                            {itemColor && itemLength && <span> | </span>}
                            {itemLength && <span>{itemLength}</span>}
                          </div>
                        )}

                        <div className="text-[10px] font-medium mt-1">
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

                        <div className="text-[11px] text-blue-600 font-bold mt-1">
                          {itemEkPrice.toFixed(2)} €{' '}
                          <span className="text-gray-500 font-normal">{t('shop.cart_unit_price')}</span>
                          <span className="text-gray-800 font-bold ml-1.5">
                            ({t('shop.cart_subtotal')} {itemSubtotal.toFixed(2)} €)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <QuantityInput
                          value={item.quantity || 1}
                          min={1}
                          onChange={(newQty) => updateQuantity(item.id, newQty)}
                        />

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 text-xs hover:bg-red-50 p-1 rounded-full font-bold transition"
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

            {/* KUNDENDATEN & BESTELL-FORMULAR (Direkt unter den Artikeln) */}
            {cart.length > 0 && (
              <div className="pt-4 border-t space-y-4">
                {/* Kundenauswahl für Admins / Agenten */}
                {isAgent && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-md space-y-2">
                    <label className="block text-xs font-bold text-amber-900">
                      👤 {t('shop.agent_customer_label')}
                    </label>

                    {customersList.length > 0 && (
                      <select
                        value={selectedCustomerId}
                        onChange={handleSelectCustomerChange}
                        className="w-full p-2 border border-amber-300 rounded text-xs text-gray-900 bg-white font-medium focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="custom">✏️ {t('shop.agent_customer_new_option')}</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name} ({c.city || c.contact_name})
                          </option>
                        ))}
                      </select>
                    )}

                    {(selectedCustomerId === 'custom' || customersList.length === 0) && (
                      <input
                        type="text"
                        required
                        value={agentCustomerNote}
                        onChange={(e) => setAgentCustomerNote(e.target.value)}
                        placeholder={t('shop.agent_customer_placeholder')}
                        className="w-full p-2 border border-amber-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-amber-500 bg-white"
                      />
                    )}
                  </div>
                )}

                {/* Gewünschtes Lieferdatum */}
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-700 shrink-0">
                    📅 {t('shop.delivery_date_label')}
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="p-1.5 border border-gray-300 rounded text-xs text-gray-800 bg-white font-medium"
                  />
                </div>

                {/* Mindestmengen Fehlermeldung */}
                {!isOrderValid && minOrderErrors.length > 0 && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs space-y-0.5">
                    <div className="font-bold">⚠️ {t('shop.shipping_min_order_error')}</div>
                    {minOrderErrors.map((err, idx) => (
                      <div key={idx}>{err}</div>
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
                  <div className="flex justify-between text-gray-600">
                    <span>{t('shop.cart_subtotal_items')}:</span>
                    <span className="font-semibold">{subtotal.toFixed(2)} €</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>{t('shop.cart_shipping_costs')}:</span>
                      <div className="group/shipping relative inline-block">
                        <button
                          type="button"
                          className="w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-slate-700 hover:text-white text-gray-600 text-[10px] font-bold flex items-center justify-center transition"
                        >
                          ?
                        </button>
                        <div className="hidden group-hover/shipping:block absolute bottom-full left-0 mb-2 w-72 p-2.5 bg-slate-900 text-slate-100 rounded-lg shadow-xl text-[11px] leading-relaxed z-50 pointer-events-none transition-all">
                          <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">
                            {t('shop.shipping_detail_title')}
                          </div>
                          {breakdownLines.length > 0 ? (
                            <div className="space-y-0.5 text-slate-300">
                              {breakdownLines.map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400">{t('shop.shipping_no_costs')}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {shippingCost === 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                        {t('shop.shipping_free')} (0.00 €)
                      </span>
                    ) : (
                      <span className="font-bold text-gray-800">{shippingCost.toFixed(2)} €</span>
                    )}
                  </div>

                  <div className="flex justify-between text-sm font-black text-gray-900 border-t pt-2">
                    <span>{t('shop.cart_total_net')}:</span>
                    <span>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Bestellbutton ganz unten im normalen Fluss */}
                <button
                  onClick={() => handleCheckout(shippingCost, grandTotal, deliveryDate)}
                  disabled={orderSubmitting || !isOrderValid}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded text-center transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {orderSubmitting ? '...' : t('shop.checkout_btn')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}