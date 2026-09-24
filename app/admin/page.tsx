'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import ProductTab from '@/components/admin/ProductTab'
import CustomersTab from '@/components/admin/CostumersTab'
import UploadTab from '@/components/admin/UploadTab'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'customers' | 'upload'>('products')
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: prodData } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    const { data: custData } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    
    if (prodData) setProducts(prodData)
    if (custData) setCustomers(custData)
    setLoading(false)
  }

  const getGroupKey = (p: any) => `${(p.brand || '').trim().toUpperCase()}_${(p.title || '').trim().toLowerCase()}`
  
  const groupedProducts = products.reduce((acc: { [key: string]: any[] }, p) => {
    const key = getGroupKey(p)
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">OUTBACK Admin Dashboard</h1>
          <a href="/shop" className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-600">Vai al Shop →</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex border-b border-gray-300 mb-6 gap-4">
          <button onClick={() => setActiveTab('products')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📦 Modelli & Varianti ({Object.keys(groupedProducts).length} Modelli)</button>
          <button onClick={() => setActiveTab('customers')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>👥 Whitelist Clienti ({customers.length})</button>
          <button onClick={() => setActiveTab('upload')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📊 Importazione Excel / CSV</button>
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-500">...</p>
        ) : (
          <>
            {activeTab === 'products' && (
              <ProductTab products={products} groupedProducts={groupedProducts} loadData={loadData} />
            )}
            {activeTab === 'customers' && (
              <CustomersTab customers={customers} loadData={loadData} />
            )}
            {activeTab === 'upload' && (
              <UploadTab products={products} loadData={loadData} />
            )}
          </>
        )}
      </div>
    </div>
  )
}