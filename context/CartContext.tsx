'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  title: string
  brand: string
  sku: string
  length?: string
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

  const addToCart = (product: any, quantity: number) => {
    // EK-Preis ermitteln (Fallback auf price_vk, falls price_ek nicht vorhanden oder 0 ist)
    const ekPrice = Number(product.price_ek) > 0 
      ? Number(product.price_ek) 
      : Number(product.price_vk || 0)

    const vkPrice = Number(product.price_vk) || 0

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id)
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [
        ...prevCart,
        {
          id: product.id,
          title: product.title,
          brand: product.brand,
          sku: product.sku,
          length: product.length,
          price_ek: ekPrice, // <--- B2B-Einkaufspreis hinterlegt
          price_vk: vkPrice,
          stock_main: Number(product.stock_main) || 0,        // <--- HINZUGEFÜGT
          stock_external: Number(product.stock_external) || 0,// <--- HINZUGEFÜGT
          quantity,
        },
      ]
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