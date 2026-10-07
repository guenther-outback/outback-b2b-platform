'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useCart } from '@/context/CartContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/context/LanguageContext'
import OrderHistoryTab from '@/components/OrderHistoryTab'
import ProductCatalog from '@/components/ProductCatalog'
import CartDrawer from '@/components/CartDrawer'

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
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart()
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

  const handleCheckout = async (shippingCost: number, grandTotal: number) => {
    if (cart.length === 0 || orderSubmitting) return

    setOrderSubmitting(true)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          shippingCost,
          totalAmount: grandTotal,
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

  const totalCartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* KOMBILIERTER STICKY HEADER FÜR MOBIL & DESKTOP */}
      <header className="bg-slate-900/95 backdrop-blur-md text-slate-100 sticky top-0 z-50 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <a href="/shop" className="text-sm sm:text-lg font-bold tracking-tight text-white hover:opacity-90">
              OUTBACK <span className="text-[10px] sm:text-xs font-normal text-slate-300 uppercase tracking-widest ml-0.5">B2B</span>
            </a>
          </div>

          {/* Rechte Steuerungs-Buttons (Kompakt auf Mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="scale-90 sm:scale-100 origin-right">
              <LanguageSwitcher />
            </div>

            {isAdmin && (
              <a 
                href="/admin" 
                className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800 border border-slate-700 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg transition"
                title="Admin Dashboard"
              >
                <span className="text-purple-400 text-xs">⚙️</span>
                <span className="hidden sm:inline ml-1">Admin</span>
              </a>
            )}

            {/* Warenkorb Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="hidden sm:inline">{t('shop.cart')}</span>
              {totalCartCount > 0 && (
                <span className="bg-white text-blue-700 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Logout Button */}
            <button 
              onClick={handleLogout} 
              className="text-xs text-slate-300 hover:text-white p-1"
              title={t('shop.logout')}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline underline decoration-slate-600 underline-offset-4">{t('shop.logout')}</span>
            </button>
          </div>
        </div>

        {/* TAB-NAVIGATION DIREKT IN DEN HEADER INTEGRIERT (VERHINDERT DOPPELTEN STICKY-ABSTAND) */}
        <div className="bg-slate-900 border-t border-slate-800/80 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex gap-2 sm:gap-6 overflow-x-auto text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-2 px-3 font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === 'catalog'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="mr-1">🛍️</span>{t('shop.tab_catalog')}
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`py-2 px-3 font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="mr-1">📦</span>{t('shop.tab_orders')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1 w-full">
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

      {/* Ausgelagertes Cart Drawer Modul */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        orderNote={orderNote}
        setOrderNote={setOrderNote}
        handleCheckout={handleCheckout}
        orderSubmitting={orderSubmitting}
        orderSuccess={orderSuccess}
        setOrderSuccess={setOrderSuccess}
        t={t}
      />
    </div>
  )
}