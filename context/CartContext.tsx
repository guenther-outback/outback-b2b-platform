'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  title: string
  brand: string
  sku: string
  length?: string
  color?: string // <-- HIEREIN EINGEFÜGT
  price_vk: number
  price_ek: number
  stock_main?: number      // <--- HINZUGEFÜGT
  stock_external?: number  // <--- HINZUGEFÜGT
  quantity: number
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: any, quantity: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  totalAmount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])

  // Warenkorb im Browser speichern
  useEffect(() => {
    const savedCart = localStorage.getItem('outback_cart')
    if (savedCart) setCart(JSON.parse(savedCart))
  }, [])

  useEffect(() => {
    localStorage.setItem('outback_cart', JSON.stringify(cart))
  }, [cart])

// In context/CartContext.tsx
const addToCart = (product: any, quantity: number) => {
  setCart((prevCart) => {
    const existingIndex = prevCart.findIndex((item) => item.id === product.id)

    if (existingIndex > -1) {
      const updated = [...prevCart]
      updated[existingIndex].quantity += quantity
      return updated
    } else {
      return [
        ...prevCart,
        {
          id: product.id,
          sku: product.sku,
          brand: product.brand,
          title: product.title,
          color: product.color, // <-- WICHTIG: Prüfen, ob `color` hier übergeben wird!
          length: product.length,
          price_ek: product.price_ek,
          price_vk: product.price_vk,
          stock_main: product.stock_main,
          stock_external: product.stock_external,
          quantity: quantity,
        },
      ]
    }
  })
}

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(productId)
    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity } : item))
    )
  }

  const clearCart = () => setCart([])

  // Gesamtsumme strikt basierend auf price_ek berechnen
  const totalAmount = cart.reduce((sum, item) => {
    const price = item.price_ek || item.price_vk || 0
    return sum + price * item.quantity
  }, 0)

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart muss innerhalb von CartProvider verwendet werden')
  return context
}