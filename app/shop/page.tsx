'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useCart } from '@/context/CartContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/context/LanguageContext'

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderNote, setOrderNote] = useState('')

  const { t } = useLanguage()
  
  // Zustände für Farbauswahl, Längenauswahl und Menge pro Modell-Gruppe
  const [selectedColors, setSelectedColors] = useState<{ [groupKey: string]: string }>({})
  const [selectedLengths, setSelectedLengths] = useState<{ [groupKey: string]: string }>({})
  const [selectedQuantities, setSelectedQuantities] = useState<{ [groupKey: string]: number }>({})

  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart()
  const supabase = createClient()

  // Berechnet den virtuellen Restbestand im Shop (Originalbestand minus Warenkorb)
  const getEffectiveStock = (product: any) => {
    if (!product) return { stockMain: 0, stockExt: 0, total: 0 }

    const cartItem = cart.find((item) => item.id === product.id)
    const qtyInCart = Number(cartItem?.quantity) || 0

    const rawMain = Number(product.stock_main) || 0
    const rawExt = Number(product.stock_external) || 0

    const deductMain = Math.min(rawMain, qtyInCart)
    const remQty = qtyInCart - deductMain
    const deductExt = Math.min(rawExt, remQty)

    const stockMain = Math.max(0, rawMain - deductMain)
    const stockExt = Math.max(0, rawExt - deductExt)
    const total = stockMain + stockExt

    return { stockMain, stockExt, total }
  }

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      setUserEmail(user.email)
      
      const { data: customer } = await supabase
        .from('customers')
        .select('is_admin')
        .eq('email', user.email.trim().toLowerCase())
        .single()
      
      if (customer?.is_admin) setIsAdmin(true)
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sku', { ascending: true })

    if (!error && data) {
      setProducts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // 1. Nur Produkte mit tatsächlichem Restbestand (> 0) berücksichtigen
  const availableProducts = products.filter(
    (p) => getEffectiveStock(p).total > 0
  )

  // 2. Gruppierung streng nach Titel/Beschreibung (sowie Marke)
  const getGroupKey = (product: any) => {
    return `${(product.brand || '').trim().toUpperCase()}_${(product.title || '').trim().toLowerCase()}`
  }

  const groupedProducts = availableProducts.reduce((acc: { [key: string]: any[] }, product) => {
    const key = getGroupKey(product)
    if (!acc[key]) acc[key] = []
    acc[key].push(product)
    return acc
  }, {})

  const brands = Array.from(new Set(availableProducts.map((p) => p.brand).filter(Boolean)))

  // 3. Filtern nach Suche und Marke
  const groupedKeys = Object.keys(groupedProducts).filter((groupKey) => {
    const group = groupedProducts[groupKey]
    const mainItem = group[0]
    
    const matchesSearch =
      mainItem.title.toLowerCase().includes(search.toLowerCase()) || 
      group.some((p: any) => p.sku.toLowerCase().includes(search.toLowerCase()))
    
    const matchesBrand = selectedBrand === '' || mainItem.brand === selectedBrand

    return matchesSearch && matchesBrand
  })

  const handleAddToCart = (groupKey: string) => {
    const group = groupedProducts[groupKey]
    if (!group) return

    const selectedColor = selectedColors[groupKey]
    const selectedLength = selectedLengths[groupKey]
    const quantityToAdd = selectedQuantities[groupKey] || 1
    
    // Passende Variante für gewählte Farbe & Länge finden
    const productVariant = group.find(
      p => (selectedColor ? p.color === selectedColor : true) && 
           (selectedLength ? p.length === selectedLength : true)
    ) || group[0]
    
    if (productVariant) {
      const { total: effectiveTotal } = getEffectiveStock(productVariant)

      if (effectiveTotal <= 0) {
        alert('Dieser Artikel ist leider ausverkauft.')
        return
      }

      const safeQuantity = Math.min(quantityToAdd, effectiveTotal)

      const ekPrice = (Number(productVariant.price_ek) > 0) 
        ? Number(productVariant.price_ek) 
        : Number(productVariant.price_vk)

      const itemForCart = {
        ...productVariant,
        price_ek: ekPrice
      }

      addToCart(itemForCart, safeQuantity)
      setSelectedQuantities(prev => ({ ...prev, [groupKey]: 1 }))
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0 || orderSubmitting) return

    setOrderSubmitting(true)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          totalAmount,
          userEmail,
          note: orderNote,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Verarbeiten der Bestellung')
      }

      clearCart()
      setOrderNote('')
      setOrderSuccess(true)

      await fetchProducts()

    } catch (error: any) {
      console.error('Checkout Fehler:', error)
      alert(`Bestellung konnte nicht verarbeitet werden: ${error.message}`)
    } finally {
      setOrderSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-wide">OUTBACK B2B</h1>
            <p className="text-xs text-slate-400">{t('shop.logged_in_as')}: {userEmail}</p>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            
            {isAdmin && (
              <a href="/admin" className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md transition flex items-center gap-1">
                ⚙️ Admin
              </a>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
            >
              🛒 {t('shop.cart')}
              {cart.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
                </span>
              )}
            </button>
            <button onClick={handleLogout} className="text-xs text-slate-300 hover:text-white underline">
              {t('shop.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Filter */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <input
            type="text"
            placeholder={t('shop.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md text-sm"
          />

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full md:w-1/4 p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">{t('shop.all_brands')}</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Produkte Grid */}
        {loading ? (
          <p className="text-center py-12 text-gray-500">...</p>
        ) : groupedKeys.length === 0 ? (
          <p className="text-center py-12 text-gray-500">Keine verfügbaren Artikel gefunden.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedKeys.map((groupKey) => {
              const group = groupedProducts[groupKey]
              const mainItem = group[0]

              // 1. Verfügbare Farben ermitteln
              const availableColors = Array.from(
                new Set(group.map(p => p.color).filter(Boolean))
              ) as string[]

              const currentColor = selectedColors[groupKey] || availableColors[0] || ''

              // 2. Verfügbare Längen basierend auf der gewählten Farbe ermitteln
              const colorFilteredGroup = group.filter(
                p => !currentColor || p.color === currentColor
              )

              const availableLengths = Array.from(
                new Set(
                  colorFilteredGroup
                    .filter(p => getEffectiveStock(p).total > 0)
                    .map(p => p.length)
                    .filter(Boolean)
                )
              ) as string[]

              const currentLength = selectedLengths[groupKey] || availableLengths[0] || ''

              // Aktive Variante auflösen
              const activeVariant = group.find(
                p => (currentColor ? p.color === currentColor : true) &&
                     (currentLength ? p.length === currentLength : true)
              ) || group[0]

              const effectiveStock = getEffectiveStock(activeVariant)

              return (
                <div key={groupKey} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                  {/* Produktbild */}
                  <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100 relative">
                    {activeVariant.image_url || mainItem.image_url ? (
                      <img
                        src={activeVariant.image_url || mainItem.image_url}
                        alt={mainItem.title}
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <div className="text-gray-400 text-xs flex flex-col items-center gap-1">
                        <span>📷 Kein Bild vorhanden</span>
                      </div>
                    )}
                  </div>

                  {/* Produktdetails */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{mainItem.brand}</span>
                        <span className="text-xs text-gray-400">SKU: {activeVariant.sku}</span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg mb-3">{mainItem.title}</h3>
                      
                      {/* VARIANTEN AUSWAHL: FARBE & LÄNGE */}
                      <div className="space-y-3 mb-4">
                        {/* Farbauswahl Dropdown */}
                        {availableColors.length > 0 && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Farbe / Colore:
                            </label>
                            <select
                              value={currentColor}
                              onChange={(e) => {
                                const newColor = e.target.value
                                setSelectedColors({ ...selectedColors, [groupKey]: newColor })
                                
                                // Erste verfügbare Länge dieser Farbe automatisch wählen
                                const nextGroup = group.filter(p => p.color === newColor && getEffectiveStock(p).total > 0)
                                if (nextGroup.length > 0) {
                                  setSelectedLengths({ ...selectedLengths, [groupKey]: nextGroup[0].length })
                                }
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:bg-white font-medium"
                            >
                              {availableColors.map((color) => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Längenauswahl Dropdown */}
                        {availableLengths.length > 0 && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              {t('shop.select_length')}:
                            </label>
                            <select
                              value={currentLength}
                              onChange={(e) => setSelectedLengths({ ...selectedLengths, [groupKey]: e.target.value })}
                              className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:bg-white font-medium"
                            >
                              {availableLengths.map((len) => {
                                const variant = colorFilteredGroup.find(p => p.length === len)
                                if (!variant) return null
                                const { total: stock } = getEffectiveStock(variant)

                                return (
                                  <option key={len} value={len}>
                                    {len} ({t('shop.stock')}: {stock})
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detaillierter Lieferzeit-Status */}
                    <div className="mb-4 text-xs">
                      {effectiveStock.stockMain > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                          <span>🟢</span> {t('shop.warehouse_main')} ({effectiveStock.stockMain} Stk.)
                        </span>
                      ) : effectiveStock.stockExt > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                          <span>🟠</span> {t('shop.warehouse_external')} ({effectiveStock.stockExt} Stk.)
                        </span>
                      ) : null}
                    </div>

                    <div className="border-t pt-4 flex justify-between items-end mt-2">
                      <div>
                        {activeVariant.price_vk > 0 && (
                          <div className="text-[11px] font-medium text-gray-500">
                            {t('shop.price_uvp') || 'UVP'}: {activeVariant.price_vk.toFixed(2)} €
                          </div>
                        )}

                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mt-0.5">
                          {t('shop.price_b2b') || 'Ihr B2B Preis'}
                        </div>
                        <div className="text-2xl font-black text-gray-900 leading-tight">
                          {(activeVariant.price_ek || activeVariant.price_vk).toFixed(2)} €
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={effectiveStock.total}
                          value={selectedQuantities[groupKey] || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            const clampedVal = Math.min(Math.max(1, val), Math.max(1, effectiveStock.total))
                            
                            setSelectedQuantities({
                              ...selectedQuantities,
                              [groupKey]: clampedVal,
                            })
                          }}
                          className="w-14 p-1.5 border border-gray-300 rounded text-center text-sm font-semibold bg-gray-50 focus:bg-white"
                        />
                        <button
                          onClick={() => handleAddToCart(groupKey)}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium transition"
                        >
                          {t('shop.add_to_cart')}
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Warenkorb Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col p-6 shadow-xl">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-lg font-bold">{t('shop.cart')}</h2>
              <button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="text-gray-500 hover:text-black">✕</button>
            </div>

            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-2">✅</span>
                <h3 className="text-xl font-bold text-green-600 mb-2">{t('shop.order_success_title')}</h3>
                <p className="text-sm text-gray-600 mb-6">{t('shop.order_success_sub')}</p>
                <button
                  onClick={() => { setOrderSuccess(false); setIsCartOpen(false); }}
                  className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {t('shop.back_to_shop')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-4">
                  {cart.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">{t('shop.empty_cart')}</p>
                  ) : (
                    cart.map((item) => {
                      const itemEkPrice = item.price_ek || item.price_vk || 0
                      const itemSubtotal = itemEkPrice * item.quantity

                      const qty = Number(item.quantity) || 1
                      const stockMain = Number(item.stock_main) || 0
                      const mainQty = Math.min(stockMain, qty)
                      const extQty = Math.max(0, qty - mainQty)

                      return (
                        <div key={item.id} className="flex justify-between items-center border-b pb-3">
                          <div>
                            <div className="font-bold text-sm">{item.brand} - {item.title}</div>
                            <div className="text-xs text-gray-500">
                              SKU: {item.sku} {item.color && `| ${item.color}`} {item.length && `| ${item.length}`}
                            </div>

                            <div className="text-[11px] font-medium mt-0.5">
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

                            <div className="text-xs text-blue-600 font-bold mt-0.5">
                              {itemEkPrice.toFixed(2)} € <span className="text-gray-400 font-normal">{t('shop.cart_unit_price')}</span>
                              <span className="text-gray-700 font-bold ml-2">({t('shop.cart_subtotal')} {itemSubtotal.toFixed(2)} €)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity || 1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                updateQuantity(item.id, isNaN(val) ? 1 : val)
                              }}
                              className="w-12 p-1 border text-center rounded text-sm font-semibold bg-gray-50 focus:bg-white"
                            />
                            <button 
                              onClick={() => removeFromCart(item.id)} 
                              className="text-red-500 text-xs hover:underline p-1"
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

                {cart.length > 0 && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        {t('shop.cart_note_label')}
                      </label>
                      <textarea
                        rows={2}
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder={t('shop.cart_note_placeholder')}
                        className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('shop.total')}:</span>
                      <span>{totalAmount.toFixed(2)} €</span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={orderSubmitting}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded text-center transition disabled:opacity-50"
                    >
                      {orderSubmitting ? '...' : t('shop.checkout_btn')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}