'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  title: string
  brand: string
  sku: string
  length?: string
  price_vk: number
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
          price_vk: product.price_vk,
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

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price_vk * item.quantity,
    0
  )

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