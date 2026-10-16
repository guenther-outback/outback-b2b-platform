'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useLanguage } from '@/context/LanguageContext'

export default function OrderHistoryTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  
  const { t } = useLanguage()
  const supabase = createClient()

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setLoading(false)
        return
      }

      const userEmail = user.email.trim().toLowerCase()

      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('role')
        .eq('email', userEmail)
        .single()

      const userRole = currentCustomer?.role || 'customer'

      let orderQuery = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (userRole === 'admin') {
        // Admin sieht alle Bestellungen
      } else if (userRole === 'agent') {
        const { data: myAssignedCustomers } = await supabase
          .from('customers')
          .select('email')
          .eq('agent_email', userEmail)

        const assignedEmails = (myAssignedCustomers || []).map((c: any) => c.email.toLowerCase())
        const allowedEmails = Array.from(new Set([userEmail, ...assignedEmails]))

        orderQuery = orderQuery.or(
          `user_email.in.(${allowedEmails.map((e) => `"${e}"`).join(',')}),placed_by_agent_email.eq."${userEmail}"`
        )
      } else {
        orderQuery = orderQuery.eq('user_email', userEmail)
      }

      const { data, error } = await orderQuery

      if (!error && data) {
        setOrders(data)
      }
      setLoading(false)
    }

    fetchOrders()
  }, [])

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
        <span>📦</span> {t('shop.orders_history_title')} ({orders.length})
      </h2>

      {loading ? (
        <p className="text-center py-8 text-gray-500 font-medium">{t('shop.order_loading')}</p>
      ) : orders.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-medium">{t('shop.order_empty')}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id
            const orderDate = new Date(order.created_at).toLocaleDateString()

            return (
              <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div 
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-gray-900">
                      {t('shop.order_number')} #{order.id.slice(0, 8)} • <span className="text-gray-600">{orderDate}</span>
                    </div>

                    {order.placed_by_agent_email && (
                      <div className="text-[11px] text-amber-800 font-medium">
                        💼 {t('shop.order_placed_by_agent')}: <span className="font-bold">{order.placed_by_agent_email}</span>
                      </div>
                    )}
                    <div className="text-gray-500 text-[11px]">
                      {t('shop.order_customer')}: <span className="font-semibold text-gray-700">{order.user_email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {order.delivery_date && (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        📅 {t('shop.order_delivery_date')}: {order.delivery_date}
                      </span>
                    )}

                    <span className="font-black text-sm text-gray-900">
                      {Number(order.total_amount || 0).toFixed(2)} €
                    </span>

                    <span className="text-gray-400 font-bold">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-white border-t border-gray-100 text-xs space-y-3">
                    {order.note && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900">
                        <strong>{t('shop.order_note')}:</strong> {order.note}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="font-bold text-gray-700">{t('shop.order_items_title')}:</div>
                      {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-50">
                          <div>
                            <span className="font-bold text-gray-800">{item.brand} {item.title}</span>
                            <span className="text-gray-500 ml-2">({item.quantity}x)</span>
                          </div>
                          <div className="font-semibold text-gray-900">
                            {((Number(item.price_ek) || Number(item.price_vk) || 0) * item.quantity).toFixed(2)} €
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}