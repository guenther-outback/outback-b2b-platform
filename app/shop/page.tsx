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
  const [orderSuccess, setOrderSuccess] = useState(false)

  const { t } = useLanguage()
  
  // Zustand für die ausgewählte Länge pro SKU
  const [selectedLengths, setSelectedLengths] = useState<{ [sku: string]: string }>({})
  // Zustand für die ausgewählte Bestellmenge pro SKU
  const [selectedQuantities, setSelectedQuantities] = useState<{ [sku: string]: number }>({})

  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProducts(data)
        
        // Initial für jede SKU die erste verfügbare Länge & Standardmenge = 1 setzen
        const initialLengths: { [sku: string]: string } = {}
        const initialQuantities: { [sku: string]: number } = {}

        data.forEach(p => {
          if (!initialLengths[p.sku] && p.length) {
            initialLengths[p.sku] = p.length
          }
          if (!initialQuantities[p.sku]) {
            initialQuantities[p.sku] = 1
          }
        })
        setSelectedLengths(initialLengths)
        setSelectedQuantities(initialQuantities)
      }
      setLoading(false)
    }
    loadData()
  }, [])

// 1. Nur Produkte berücksichtigen, die in mindestens einem Lager Bestand haben (> 0)
  const availableProducts = products.filter(
    (p) => (p.stock_main || 0) + (p.stock_external || 0) > 0
  )

  // 2. Verfügbare Produkte nach SKU gruppieren
  const groupedProducts = availableProducts.reduce((acc: { [key: string]: any[] }, product) => {
    const key = product.sku
    if (!acc[key]) acc[key] = []
    acc[key].push(product)
    return acc
  }, {})

  const brands = Array.from(new Set(availableProducts.map((p) => p.brand).filter(Boolean)))

  // 3. Gruppierte Produkte nach Suchbegriff und Marke filtern
  const groupedKeys = Object.keys(groupedProducts).filter((sku) => {
    const group = groupedProducts[sku]
    const mainItem = group[0]
    
    const matchesSearch =
      mainItem.title.toLowerCase().includes(search.toLowerCase()) || 
      sku.toLowerCase().includes(search.toLowerCase())
    const matchesBrand = selectedBrand === '' || mainItem.brand === selectedBrand

    return matchesSearch && matchesBrand
  })

  // Wenn der Kunde auf "+ Hinzufügen" klickt, wird die eingestellte Menge übertragen
  const handleAddToCart = (sku: string) => {
    const group = groupedProducts[sku]
    const selectedLength = selectedLengths[sku]
    const quantityToAdd = selectedQuantities[sku] || 1
    
    const productVariant = group.find(p => p.length === selectedLength) || group[0]
    
    if (productVariant) {
      addToCart(productVariant, quantityToAdd)
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setOrderSubmitting(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, totalAmount, userEmail }),
      })

      if (res.ok) {
        setOrderSuccess(true)
        clearCart()
      } else {
        alert('Fehler beim Absenden der Bestellung.')
      }
    } catch (e) {
      alert('Netzwerkfehler beim Absenden der Bestellung.')
    }
    setOrderSubmitting(false)
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
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
            >
              🛒 {t('shop.cart')}
              {cart.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
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
          <p className="text-center py-12 text-gray-500">Keine Artikel gefunden.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedKeys.map((sku) => {
              const group = groupedProducts[sku]
              const mainItem = group[0]
              
              const availableLengths = group
                .map(p => p.length)
                .filter((v, i, a) => v && a.indexOf(v) === i)

              const currentLength = selectedLengths[sku] || availableLengths[0]
              const activeVariant = group.find(p => p.length === currentLength) || mainItem

              return (
                <div key={sku} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                  {/* Produktbild */}
                  <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100 relative">
                    {mainItem.image_url ? (
                      <img
                        src={mainItem.image_url}
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
                        <span className="text-xs text-gray-400">SKU: {sku}</span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg mb-2">{mainItem.title}</h3>
                      
                      {/* Längenauswahl Dropdown */}
                      {availableLengths.length > 0 && (
                        <div className="mb-4">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t('shop.select_length')}:
                          </label>
                          <select
                            value={currentLength}
                            onChange={(e) => setSelectedLengths({ ...selectedLengths, [sku]: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:bg-white font-medium"
                          >
                            {availableLengths.map((len) => {
                              const variant = group.find(p => p.length === len)
                              const totalStock = (variant?.stock_main || 0) + (variant?.stock_external || 0)

                              return (
                                <option key={len} value={len}>
                                  {len} {totalStock > 0 ? `(${t('shop.stock')}: ${totalStock})` : `(${t('shop.out_of_stock')})`}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Detaillierter, mehrsprachiger Lieferzeit-Status */}
                    <div className="mb-4 text-xs">
                      {activeVariant && (activeVariant.stock_main || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                          <span>🟢</span> {t('shop.warehouse_main')} ({(activeVariant.stock_main || 0)} Stk.)
                        </span>
                      ) : activeVariant && (activeVariant.stock_external || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                          <span>🟠</span> {t('shop.warehouse_external')} ({(activeVariant.stock_external || 0)} Stk.)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-800 border border-red-200 font-medium">
                          <span>🔴</span> {t('shop.out_of_stock')}
                        </span>
                      )}
                    </div>

                    <div className="border-t pt-4 flex justify-between items-end mt-2">
                      <div>
                        <div className="text-xs text-gray-400">{t('shop.price_b2b')}</div>
                        <div className="text-xl font-bold text-gray-900">{activeVariant.price_vk.toFixed(2)} €</div>
                      </div>
                      
                      {/* Mengeneingabe & Add Button */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={selectedQuantities[sku] || 1}
                          onChange={(e) =>
                            setSelectedQuantities({
                              ...selectedQuantities,
                              [sku]: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-14 p-1.5 border border-gray-300 rounded text-center text-sm font-semibold bg-gray-50 focus:bg-white"
                        />
                        <button
                          onClick={() => handleAddToCart(sku)}
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
              <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-black">✕</button>
            </div>

            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-2">✅</span>
                <h3 className="text-xl font-bold text-green-600 mb-2">{t('shop.order_success_title')}</h3>
                <p className="text-sm text-gray-600 mb-6">{t('shop.order_success_sub')}</p>
                <button
                  onClick={() => { setOrderSuccess(false); setIsCartOpen(false); }}
                  className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
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
                    cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center border-b pb-3">
                        <div>
                          <div className="font-bold text-sm">{item.brand} - {item.title}</div>
                          <div className="text-xs text-gray-500">
                            SKU: {item.sku} {item.length && `| ${item.length}`} | {item.price_vk.toFixed(2)} €
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-12 p-1 border text-center rounded text-sm"
                          />
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-xs hover:underline">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="border-t pt-4 mt-4 space-y-4">
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