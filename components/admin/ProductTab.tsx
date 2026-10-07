'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

interface ProductTabProps {
  products: any[]
  groupedProducts: { [key: string]: any[] }
  loadData: () => void
}

export default function ProductTab({ products, groupedProducts, loadData }: ProductTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null)
  const [applyImageToSameColor, setApplyImageToSameColor] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [stockInputs, setStockInputs] = useState<{ [variantId: string]: { main: number; ext: number } }>({})
  const [savingStockId, setSavingStockId] = useState<string | null>(null)

  const [productForm, setProductForm] = useState({
    sku: '', brand: '', category: 'Skis', title: '', length: '', color: '',
    price_ek: 0, price_vk: 0, stock_main: 0, stock_external: 0, image_url: '',
  })

  const supabase = createClient()

  const toggleGroup = (key: string) => {
    setOpenGroupKey(prevKey => (prevKey === key ? null : key))
  }

  const handleStockInputChange = (variantId: string, field: 'main' | 'ext', value: number) => {
    setStockInputs(prev => ({
      ...prev,
      [variantId]: {
        main: field === 'main' ? value : (prev[variantId]?.main ?? 0),
        ext: field === 'ext' ? value : (prev[variantId]?.ext ?? 0)
      }
    }))
  }

  // Bestände direkt in Supabase & lokal aktualisieren OHNE loadData()
  const handleSaveStock = async (variant: any) => {
    const inputs = stockInputs[variant.id]
    if (!inputs) return

    setSavingStockId(variant.id)
    const { error } = await supabase
      .from('products')
      .update({
        stock_main: inputs.main,
        stock_external: inputs.ext
      })
      .eq('id', variant.id)

    if (error) {
      alert('Errore durante l\'aggiornamento della giacenza: ' + error.message)
    } else {
      // Direktes lokales Update der Daten für sofortige Reaktion ohne Reload
      variant.stock_main = inputs.main
      variant.stock_external = inputs.ext

      setStockInputs(prev => {
        const next = { ...prev }
        delete next[variant.id]
        return next
      })
    }
    setSavingStockId(null)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      const filePath = `products/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file)

      if (uploadError) {
        alert('Errore caricamento immagine: ' + uploadError.message)
        setUploadingImage(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      setProductForm(prev => ({ ...prev, image_url: urlData.publicUrl }))
    } catch (err: any) {
      alert('Caricamento fallito: ' + err.message)
    }
    setUploadingImage(false)
  }

  // Produkt-Variante speichern OHNE loadData(), damit Akkordeon & Suche nicht zurückgesetzt werden
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        const { error } = await supabase.from('products').update(productForm).eq('id', editingId)
        if (error) throw error

        if (applyImageToSameColor && productForm.color && productForm.image_url) {
          await supabase
            .from('products')
            .update({ image_url: productForm.image_url })
            .eq('brand', productForm.brand)
            .eq('title', productForm.title)
            .eq('color', productForm.color)
        }

        // Aktualisiert lokale Objekte im geöffneten Akkordeon-Array direkt
        if (openGroupKey && groupedProducts[openGroupKey]) {
          const itemIdx = groupedProducts[openGroupKey].findIndex(v => v.id === editingId)
          if (itemIdx !== -1) {
            groupedProducts[openGroupKey][itemIdx] = { ...groupedProducts[openGroupKey][itemIdx], ...productForm }
          }
        }
      } else {
        const { data, error } = await supabase.from('products').insert([productForm]).select().single()
        if (error) throw error

        if (applyImageToSameColor && productForm.color && productForm.image_url) {
          await supabase
            .from('products')
            .update({ image_url: productForm.image_url })
            .eq('brand', productForm.brand)
            .eq('title', productForm.title)
            .eq('color', productForm.color)
        }

        // Falls ein neues Produkt angelegt wurde, laden wir im Hintergrund nach
        loadData()
      }

      setEditingId(null)
      alert('Variante salvata con successo!')
    } catch (err: any) {
      alert('Errore durante il salvataggio: ' + err.message)
    }
  }

  const handleEditClick = (product: any, groupKey: string) => {
    setEditingId(product.id)
    setOpenGroupKey(groupKey) // Hält das entsprechende Akkordeon offen
    setProductForm({
      sku: product.sku,
      brand: product.brand,
      category: product.category,
      title: product.title,
      length: product.length || '',
      color: product.color || '',
      price_ek: product.price_ek,
      price_vk: product.price_vk,
      stock_main: product.stock_main || 0,
      stock_external: product.stock_external || 0,
      image_url: product.image_url || '',
    })
  }

  const handleDeleteProduct = async (id: string, groupKey: string) => {
    if (!confirm('Eliminare veramente la variante?')) return
    await supabase.from('products').delete().eq('id', id)

    // Entferne es lokal aus dem Gruppenarray
    if (groupedProducts[groupKey]) {
      groupedProducts[groupKey] = groupedProducts[groupKey].filter(v => v.id !== id)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setProductForm({
      sku: '', brand: '', category: 'Skis', title: '', length: '',
      color: '', price_ek: 0, price_vk: 0, stock_main: 0, stock_external: 0, image_url: ''
    })
  }

  const filteredGroupKeys = Object.keys(groupedProducts).filter(groupKey => {
    if (!searchTerm.trim()) return true
    const variants = groupedProducts[groupKey]
    const term = searchTerm.toLowerCase()
    return variants.some(v => 
      (v.title && v.title.toLowerCase().includes(term)) ||
      (v.brand && v.brand.toLowerCase().includes(term)) ||
      (v.sku && v.sku.toLowerCase().includes(term)) ||
      (v.color && v.color.toLowerCase().includes(term))
    )
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form Creazione / Modifica */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-gray-800">{editingId ? 'Modifica Variante' : 'Crea Variante Prodotto'}</h2>
          {editingId && <button onClick={resetForm} className="text-xs text-red-500 underline">Annulla</button>}
        </div>

        <form onSubmit={handleSaveProduct} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600">SKU (Codice Variante)</label>
            <input type="text" required value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Marca</label>
              <input type="text" required value={productForm.brand} onChange={e => setProductForm({...productForm, brand: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Categoria</label>
              <input type="text" required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full p-2 border rounded" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Titolo Modello (Descrizione)</label>
            <input type="text" required value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Colore</label>
              <input type="text" value={productForm.color} onChange={e => setProductForm({...productForm, color: e.target.value})} className="w-full p-2 border rounded" placeholder="Es. Nero" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Lunghezza / Misura</label>
              <input type="text" value={productForm.length} onChange={e => setProductForm({...productForm, length: e.target.value})} className="w-full p-2 border rounded" placeholder="Es. 175cm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600">Prezzo EK (€)</label>
              <input type="number" step="0.01" value={productForm.price_ek} onChange={e => setProductForm({...productForm, price_ek: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Prezzo VK / B2B (€)</label>
              <input type="number" step="0.01" required value={productForm.price_vk} onChange={e => setProductForm({...productForm, price_vk: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded border space-y-2">
            <div className="font-semibold text-xs text-slate-700">Giacenze Magazzino:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-emerald-700 font-medium">Mag. Principale</label>
                <input type="number" value={productForm.stock_main} onChange={e => setProductForm({...productForm, stock_main: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium">Mag. Esterno</label>
                <input type="number" value={productForm.stock_external} onChange={e => setProductForm({...productForm, stock_external: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded border space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Immagine Prodotto (Upload)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadingImage && <p className="text-xs text-blue-600 font-medium">Caricamento in corso...</p>}
            
            {productForm.image_url && (
              <div className="mt-2 flex items-center gap-3">
                <img src={productForm.image_url} alt="Anteprima" className="w-12 h-12 object-contain border rounded bg-white" />
                <span className="text-[10px] text-green-600 font-bold">✅ Immagine OK</span>
              </div>
            )}

            {productForm.color && (
              <div className="pt-2 border-t mt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={applyImageToSameColor}
                    onChange={e => setApplyImageToSameColor(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span>Applica immagine a <strong>tutte le misure</strong> del colore <em>"{productForm.color}"</em></span>
                </label>
              </div>
            )}
          </div>

          <button type="submit" className={`w-full text-white font-bold py-2 rounded text-sm mt-4 ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {editingId ? 'Salva Modifiche' : 'Crea Variante'}
          </button>
        </form>
      </div>

      {/* Suche & Akkordeon-Produktboxen */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
          <span className="text-gray-400 pl-1">🔍</span>
          <input
            type="text"
            placeholder="Cerca per titolo, marca, SKU o colore..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-sm outline-none bg-transparent"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-xs text-gray-400 hover:text-gray-600 font-bold pr-1">✕</button>
          )}
        </div>

        {filteredGroupKeys.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 text-sm">
            Nessun modello trovato per "{searchTerm}".
          </div>
        ) : (
          filteredGroupKeys.map(groupKey => {
            const variants = groupedProducts[groupKey]
            if (!variants || variants.length === 0) return null

            const main = variants[0]
            const totalMainStock = variants.reduce((sum, v) => sum + (v.stock_main || 0), 0)
            const totalExtStock = variants.reduce((sum, v) => sum + (v.stock_external || 0), 0)
            const isOpen = openGroupKey === groupKey

            return (
              <div
                key={groupKey}
                className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between transition relative overflow-hidden"
              >     
                {/* Header-Design per il Modello */}
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full p-4 bg-white hover:bg-slate-50 text-gray-800 flex justify-between items-center text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{isOpen ? '🔽' : '▶️'}</span>
                    {main.image_url ? (
                      <img src={main.image_url} alt={main.title} className="w-10 h-10 object-contain rounded border border-gray-200 bg-white p-1" />
                    ) : (
                      <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400">No img</div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">{main.brand}</span>
                      <h3 className="font-bold text-base text-gray-900 leading-tight">{main.title}</h3>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="bg-gray-100 px-2.5 py-1 rounded text-gray-600 font-medium border border-gray-200">
                      {variants.length} Varianti | Totale: <strong className="text-emerald-700">{totalMainStock + totalExtStock} pz.</strong>
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                          <th className="p-2.5">Img</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Colore</th>
                          <th className="p-2.5">Lunghezza</th>
                          <th className="p-2.5">Prezzo B2B</th>
                          <th className="p-2.5 text-emerald-700">Mag. Princ.</th>
                          <th className="p-2.5 text-amber-700">Mag. Est.</th>
                          <th className="p-2.5 text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v: any) => {
                          const isOut = (v.stock_main || 0) + (v.stock_external || 0) === 0
                          const currentMainInput = stockInputs[v.id]?.main ?? (v.stock_main || 0)
                          const currentExtInput = stockInputs[v.id]?.ext ?? (v.stock_external || 0)
                          const isStockChanged = stockInputs[v.id] && (
                            stockInputs[v.id].main !== (v.stock_main || 0) ||
                            stockInputs[v.id].ext !== (v.stock_external || 0)
                          )

                          return (
                            <tr key={v.id} className={`border-b border-gray-100 hover:bg-slate-50 ${editingId === v.id ? 'bg-amber-50' : ''} ${isOut ? 'bg-red-50/40' : ''}`}>
                              <td className="p-2">
                                {v.image_url ? (
                                  <img src={v.image_url} alt={v.title} className="w-7 h-7 object-contain rounded border border-gray-200 bg-white" />
                                ) : (
                                  <span className="text-[10px] text-gray-400">No img</span>
                                )}
                              </td>
                              <td className="p-2 font-mono font-bold text-gray-800">{v.sku}</td>
                              <td className="p-2 font-semibold text-gray-700">{v.color || '-'}</td>
                              <td className="p-2 text-gray-600">{v.length || '-'}</td>
                              <td className="p-2 font-bold text-gray-900">{(v.price_vk || 0).toFixed(2)} €</td>
                              
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentMainInput}
                                  onChange={e => handleStockInputChange(v.id, 'main', parseInt(e.target.value) || 0)}
                                  className="w-14 p-1 border border-emerald-300 rounded text-center text-xs font-bold text-emerald-800 bg-emerald-50/50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentExtInput}
                                  onChange={e => handleStockInputChange(v.id, 'ext', parseInt(e.target.value) || 0)}
                                  className="w-14 p-1 border border-amber-300 rounded text-center text-xs font-bold text-amber-800 bg-amber-50/50 focus:bg-white focus:ring-1 focus:ring-amber-500"
                                />
                              </td>

                              <td className="p-2 text-right space-x-1">
                                {isStockChanged && (
                                  <button
                                    onClick={() => handleSaveStock(v)}
                                    disabled={savingStockId === v.id}
                                    className="p-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                                    title="Salva giacenza"
                                  >
                                    💾
                                  </button>
                                )}
                                <button onClick={() => handleEditClick(v, groupKey)} className="p-1 text-slate-500 hover:text-blue-600 text-sm" title="Modifica variante">✏️</button>
                                <button onClick={() => handleDeleteProduct(v.id, groupKey)} className="p-1 text-red-400 hover:text-red-600 text-sm" title="Elimina variante">✕</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}