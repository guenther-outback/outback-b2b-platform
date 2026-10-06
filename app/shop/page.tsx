'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useCart } from '@/context/CartContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/context/LanguageContext'
import QuantityInput from '@/components/QuantityInput'
import OrderHistoryTab from '@/components/OrderHistoryTab'
import ProductCatalog from '@/components/ProductCatalog'

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderNote, setOrderNote] = useState('')

  const [allowedBrands, setAllowedBrands] = useState<string[] | null>(null)
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders'>('catalog')

  const { t } = useLanguage()
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart()
  const supabase = createClient()

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      setUserEmail(user.email)

      const { data: customer } = await supabase
        .from('customers')
        .select('is_admin, allowed_brands')
        .eq('email', user.email.trim().toLowerCase())
        .single()

      if (customer) {
        if (customer.is_admin) setIsAdmin(true)
        if (customer.allowed_brands && customer.allowed_brands.length > 0) {
          setAllowedBrands(customer.allowed_brands)
        } else {
          setAllowedBrands(null)
        }
      }
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
      <header className="bg-slate-900/95 backdrop-blur-md text-slate-100 sticky top-0 z-30 border-b border-slate-800/80 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/shop" className="text-base sm:text-lg font-semibold tracking-tight text-white hover:opacity-90 transition">
              OUTBACK <span className="text-xs font-normal text-slate-300 uppercase tracking-widest ml-1">B2B</span>
            </a>
            {userEmail && (
              <>
                <span className="hidden sm:inline text-slate-700">|</span>
                <span className="hidden sm:inline text-xs text-slate-300 font-medium truncate max-w-[200px]" title={userEmail}>
                  {userEmail}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />

            {isAdmin && (
              <a 
                href="/admin" 
                className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                title="Admin Dashboard"
              >
                <span className="text-purple-400 text-xs">⚙️</span>
                <span className="hidden sm:inline">Admin</span>
              </a>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="hidden sm:inline">{t('shop.cart')}</span>
              {cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) > 0 && (
                <span className="bg-white text-blue-700 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
                </span>
              )}
            </button>

            <button 
              onClick={handleLogout} 
              className="text-xs text-slate-300 hover:text-slate-200 transition-colors p-1 ml-1"
              title={t('shop.logout')}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline underline decoration-slate-600 underline-offset-4">{t('shop.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="sticky top-[49px] z-30 bg-gray-100/95 backdrop-blur-md border-b border-gray-300 shadow-sm pt-4 pb-2 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-2 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'catalog'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>🛍️</span>{t('shop.tab_catalog')}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-2 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>📦</span>{t('shop.tab_orders')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {activeTab === 'catalog' && (
          <ProductCatalog
            products={products}
            loading={loading}
            allowedBrands={allowedBrands}
            cart={cart}
            addToCart={addToCart}
            t={t}
          />
        )}

        {activeTab === 'orders' && <OrderHistoryTab />}
      </main>

      {/* Warenkorb Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col p-6 shadow-xl">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('shop.cart')}</h2>
              <button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="text-gray-600 hover:text-black font-bold">✕</button>
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
                    <p className="text-gray-600 font-medium text-center py-8">{t('shop.empty_cart')}</p>
                  ) : (
                    cart.map((item) => {
                      const itemEkPrice = item.price_ek || item.price_vk || 0
                      const itemSubtotal = itemEkPrice * item.quantity

                      const qty = Number(item.quantity) || 1
                      const stockMain = Number(item.stock_main) || 0
                      const mainQty = Math.min(stockMain, qty)
                      const extQty = Math.max(0, qty - mainQty)

                      return (
                        <div key={item.id} className="flex justify-between items-center border-b pb-3 gap-2">
                          <div>
                            <div className="font-bold text-sm text-gray-900">{item.brand} {item.title}</div>
                            <div className="text-xs text-gray-600 font-medium">
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
                              {itemEkPrice.toFixed(2)} € <span className="text-gray-600 font-normal">{t('shop.cart_unit_price')}</span>
                              <span className="text-gray-700 font-bold ml-2">({t('shop.cart_subtotal')} {itemSubtotal.toFixed(2)} €)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <QuantityInput
                              value={item.quantity || 1}
                              min={1}
                              onChange={(newQty) => updateQuantity(item.id, newQty)}
                            />

                            <button 
                              onClick={() => removeFromCart(item.id)} 
                              className="text-red-500 text-xs hover:underline p-1 font-bold"
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
                        className="w-full p-2 border border-gray-300 rounded text-xs text-gray-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex justify-between text-lg font-bold text-gray-900">
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