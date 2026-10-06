'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useLanguage } from '@/context/LanguageContext'

export interface OrderItem {
  id: string
  sku: string
  brand?: string
  title?: string
  length?: string
  price_ek: number
  price_vk?: number
  quantity: number
}

export interface Order {
  id: string
  created_at: string
  customer_id: string
  total_amount: number | string
  status: string
  user_email?: string
  items: OrderItem[] | string
  note?: string
  notes?: string
}

export default function OrderHistoryTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const { t } = useLanguage()
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Kunden-Profil laden, falls `customer_id` aus der `customers`-Tabelle stammt
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', user.email?.trim().toLowerCase())
      .maybeSingle()

    const customerId = customer?.id || user.id

    // Abfrage über user_email ODER customer_id
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`user_email.eq.${user.email},customer_id.eq.${customerId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fehler beim Laden der Bestellungen:', error.message)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id)
  }

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase()
    switch (s) {
      case 'completed':
      case 'abgeschlossen':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">{t('shop.orders_status_completed') || 'Abgeschlossen'}</span>
      case 'processing':
      case 'in bearbeitung':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{t('shop.orders_status_processing') || 'In Bearbeitung'}</span>
      case 'cancelled':
      case 'storniert':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">{t('shop.orders_status_cancelled') || 'Storniert'}</span>
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">{t('shop.orders_status_pending') || 'Offen'}</span>
    }
  }

  const parseItems = (rawItems: OrderItem[] | string): OrderItem[] => {
    if (Array.isArray(rawItems)) return rawItems
    if (typeof rawItems === 'string') {
      try {
        return JSON.parse(rawItems)
      } catch (e) {
        return []
      }
    }
    return []
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">{t('shop.orders_loading') || 'Bestellhistorie wird geladen...'}</div>
  }

  if (orders.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 border-2 border-dashed rounded-xl bg-gray-50">
        {t('shop.orders_empty') || 'Keine vergangenen Bestellungen vorhanden.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('shop.orders_title') || 'Bestellhistorie'}</h2>

      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.id
        const orderItems = parseItems(order.items)
        const orderNote = order.note || order.notes || ''
        
        const dateStr = new Date(order.created_at).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={order.id} className="border rounded-xl bg-white shadow-sm overflow-hidden border-gray-200">
            {/* Header */}
            <div
              onClick={() => toggleExpand(order.id)}
              className="p-4 sm:p-5 flex flex-wrap items-center justify-between cursor-pointer hover:bg-gray-50 transition gap-4"
            >
              <div className="space-y-1">
                <div className="font-bold text-gray-900 text-base">
                  {t('shop.orders_order_number') || 'Bestellung #'} {order.id.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500 font-medium">{dateStr}</div>
              </div>

              <div className="flex items-center space-x-6">
                <div>{getStatusBadge(order.status)}</div>
                <div className="font-bold text-gray-900 text-lg">
                  {Number(order.total_amount).toFixed(2)} €
                </div>
                <div className="text-gray-400 text-sm">
                  {isExpanded ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {/* Aufgeklappte Details */}
            {isExpanded && (
              <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 space-y-4">
                {/* Bestellkommentar / Anmerkung */}
                {orderNote && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                    <span className="font-bold block mb-0.5">📝 {t('shop.orders_note_label')}</span>
                    <p className="whitespace-pre-line italic text-amber-800">{orderNote}</p>
                  </div>
                )}

                {/* Artikelliste */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t('shop.orders_items_count') || 'Bestellte Positionen'} ({orderItems.length})
                  </h4>

                  <div className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {orderItems.map((item, idx) => {
                      const price = item.price_ek || 0
                      const itemTotal = price * item.quantity

                      return (
                        <div key={item.id || idx} className="p-3.5 flex justify-between items-center text-sm">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-gray-900">
                              {item.brand ? `${item.brand} - ` : ''}{item.title || 'Produkt'}
                              {item.length ? ` (${item.length} cm)` : ''}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">SKU: {item.sku}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-gray-600 text-xs">
                              {item.quantity} × {price.toFixed(2)} €
                            </div>
                            <div className="font-bold text-gray-900">{itemTotal.toFixed(2)} €</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}