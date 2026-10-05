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

  // In app/admin/page.tsx beim Einbinden des Kunden-Tabs:
  const availableBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[]

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
      {/* 1. DUNKEL-BLAUER HEADER (Fixiert ganz oben) */}
      <header className="bg-slate-900/95 backdrop-blur-md text-slate-100 sticky top-0 z-40 border-b border-slate-800/80 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
              OUTBACK <span className="text-xs font-normal text-purple-400 uppercase tracking-widest ml-1">Admin</span>
            </h1>
          </div>

          <a 
            href="/shop" 
            className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
          >
            <span>Vai al Shop</span>
            <span className="text-slate-400">→</span>
          </a>
        </div>
      </header>

      {/* 2. STICKY TAB-NAVIGATION (Direkt unter dem Header fixiert) */}
      <div className="sticky top-[49px] z-30 bg-gray-100/95 backdrop-blur-md border-b border-gray-300 shadow-sm pt-4 pb-2 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('products')} 
            className={`pb-2 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📦 Modelli & Varianti ({Object.keys(groupedProducts).length})
          </button>
          <button 
            onClick={() => setActiveTab('customers')} 
            className={`pb-2 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            👥 Whitelist Clienti ({customers.length})
          </button>
          <button 
            onClick={() => setActiveTab('upload')} 
            className={`pb-2 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📊 Importazione Excel / CSV
          </button>
        </div>
      </div>

      {/* HAUPTINHALT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 w-full flex-1">
        {loading ? (
          <p className="text-center py-12 text-gray-500">...</p>
        ) : (
          <>
            {activeTab === 'products' && (
              <ProductTab products={products} groupedProducts={groupedProducts} loadData={loadData} />
            )}
            {activeTab === 'customers' && (
              <CustomersTab customers={customers} availableBrands={availableBrands} loadData={loadData} />
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