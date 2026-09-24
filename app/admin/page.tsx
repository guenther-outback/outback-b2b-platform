'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import ExcelJS from 'exceljs'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'customers' | 'upload'>('products')
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Stato per inserimento / modifica manuale prodotti
  const [productForm, setProductForm] = useState({
    sku: '',
    brand: '',
    category: 'Skis',
    title: '',
    length: '',
    color: '',
    price_ek: 0,
    price_vk: 0,
    stock_main: 0,
    stock_external: 0,
    image_url: '',
  })

  // Stato per clienti (incluso flag is_admin)
  const [newCustomer, setNewCustomer] = useState({
    company_name: '', 
    contact_name: '', 
    email: '', 
    address: '', 
    zip_code: '', 
    city: '',
    is_admin: false
  })

  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

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

  // Funzione helper per la lettura del testo CSV nel browser (supporta virgola e punto e virgola)
  const parseCsvString = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length < 2) return []
    const separator = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''))
    
    const result: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(separator)
      if (currentline.length < headers.length && currentline.join('').trim() === '') continue
      const obj: any = {}
      for (let j = 0; j < headers.length; j++) {
        let val = currentline[j] ? currentline[j].trim() : ''
        val = val.replace(/^["']|["']$/g, '')
        obj[headers[j]] = val
      }
      result.push(obj)
    }
    return result
  }

  // UPLOAD IMMAGINI SU SUPABASE STORAGE
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
        alert('Errore durante il caricamento dell\'immagine: ' + uploadError.message)
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

  // Crea O Aggiorna Prodotto
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingId) {
      const { data, error } = await supabase
        .from('products')
        .update(productForm)
        .eq('id', editingId)
        .select()

      if (error) {
        alert('Errore durante l\'aggiornamento: ' + error.message)
      } else if (!data || data.length === 0) {
        alert('Errore: Il database ha bloccato la modifica (Verificare i permessi RLS).')
      } else {
        alert('Prodotto aggiornato con successo!')
        resetForm()
        loadData()
      }
    } else {
      const { error } = await supabase.from('products').insert([productForm])
      if (error) {
        alert('Errore durante la creazione: ' + error.message)
      } else {
        alert('Nuovo prodotto creato!')
        resetForm()
        loadData()
      }
    }
  }

  const handleEditClick = (product: any) => {
    setEditingId(product.id)
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

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Eliminare veramente l\'articolo?')) return
    await supabase.from('products').delete().eq('id', id)
    loadData()
  }

  const resetForm = () => {
    setEditingId(null)
    setProductForm({
      sku: '', brand: '', category: 'Skis', title: '', length: '',
      color: '', price_ek: 0, price_vk: 0, stock_main: 0, stock_external: 0, image_url: ''
    })
  }

  // Abilita cliente B2B
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('customers').insert([{
      ...newCustomer,
      email: newCustomer.email.trim().toLowerCase(),
      is_active: true
    }])
    if (!error) {
      alert('Cliente abilitato con successo!')
      setNewCustomer({ company_name: '', contact_name: '', email: '', address: '', zip_code: '', city: '', is_admin: false })
      loadData()
    } else {
      alert('Errore durante la registrazione: ' + error.message)
    }
  }

  // Cambio diretto stato Admin di un cliente
  const handleToggleAdmin = async (customer: any) => {
    const newStatus = !customer.is_admin
    const { error } = await supabase
      .from('customers')
      .update({ is_admin: newStatus })
      .eq('id', customer.id)

    if (error) {
      alert('Errore nel cambio ruolo: ' + error.message)
    } else {
      loadData()
    }
  }

  // Upload diretto Excel (Senza anteprima)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus('Lettura file in corso...')

    try {
      let rawData: any[] = []

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        rawData = parseCsvString(text)
      } else {
        const workbook = new ExcelJS.Workbook()
        const arrayBuffer = await file.arrayBuffer()
        await workbook.xlsx.load(arrayBuffer)

        const worksheet = workbook.worksheets[0]
        const headers: string[] = []

        worksheet?.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = cell.text ? String(cell.text).trim() : ''
            })
          } else {
            const rowObj: any = {}
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber]
              if (header) {
                let val = cell.value
                if (val !== null && typeof val === 'object') {
                  if ('result' in val) val = (val as any).result
                  else if ('text' in val) val = (val as any).text
                }
                rowObj[header] = val
              }
            })
            if (Object.keys(rowObj).length > 0) rawData.push(rowObj)
          }
        })
      }

      const formattedData = rawData.map((row: any) => ({
        sku: String(row.SKU || row.sku || '').trim(),
        brand: String(row.Marke || row.brand || row.Marca || '').trim(),
        category: String(row.Kategorie || row.category || row.Categoria || 'Skis').trim(),
        title: String(row.Titel || row.title || row.Titolo || '').trim(),
        length: String(row.Länge || row.length || row.Lunghezza || '').trim(),
        color: String(row.Farbe || row.color || row.Colore || '').trim(),
        price_ek: parseFloat(row.EK || row.price_ek || row.PrezzoEK || 0) || 0,
        price_vk: parseFloat(row.VK || row.price_vk || row.PrezzoVK || 0) || 0,
        stock_main: parseInt(row.BestandHauptlager || row.stock_main || row.GiacenzaPrincipale || 0) || 0,
        stock_external: parseInt(row.BestandAussenlager || row.stock_external || row.GiacenzaEsterna || 0) || 0,
        image_url: row.Bild || row.image_url || row.Immagine || null,
      })).filter(item => item.sku !== '')

      const { error } = await supabase.from('products').upsert(formattedData, { onConflict: 'sku,length' })

      if (error) setUploadStatus('Errore: ' + error.message)
      else {
        setUploadStatus(`✅ ${formattedData.length} prodotti aggiornati!`)
        loadData()
      }
    } catch (err: any) {
      setUploadStatus('Errore: ' + err.message)
    }
    setIsUploading(false)
  }

  // 1. GENERAZIONE E DOWNLOAD MODELLO EXCEL
  const downloadTemplate = async () => {
    const templateData = [
      {
        SKU: 'SK-AT-G9',
        Marca: 'Atomic',
        Categoria: 'Skis',
        Titolo: 'Redster G9 Revoshock S',
        Lunghezza: '173cm',
        Colore: 'Rosso',
        PrezzoEK: 380.00,
        PrezzoVK: 580.00,
        GiacenzaPrincipale: 10,
        GiacenzaEsterna: 5,
        Immagine: 'https://...'
      },
      {
        SKU: 'ST-LK-SP3D',
        Marca: 'Leki',
        Categoria: 'Stocchi',
        Titolo: 'Spitfire 3D Freeride',
        Lunghezza: '125cm',
        Colore: 'Giallo',
        PrezzoEK: 32.00,
        PrezzoVK: 55.00,
        GiacenzaPrincipale: 25,
        GiacenzaEsterna: 0,
        Immagine: ''
      }
    ]

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Modello_Prodotti')

    worksheet.columns = [
      { header: 'SKU', key: 'SKU', width: 15 },
      { header: 'Marca', key: 'Marca', width: 15 },
      { header: 'Categoria', key: 'Categoria', width: 15 },
      { header: 'Titolo', key: 'Titolo', width: 25 },
      { header: 'Lunghezza', key: 'Lunghezza', width: 12 },
      { header: 'Colore', key: 'Colore', width: 10 },
      { header: 'PrezzoEK', key: 'PrezzoEK', width: 12 },
      { header: 'PrezzoVK', key: 'PrezzoVK', width: 12 },
      { header: 'GiacenzaPrincipale', key: 'GiacenzaPrincipale', width: 18 },
      { header: 'GiacenzaEsterna', key: 'GiacenzaEsterna', width: 18 },
      { header: 'Immagine', key: 'Immagine', width: 25 }
    ]

    templateData.forEach(item => worksheet.addRow(item))

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Outback_B2B_Modello_Prodotti.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // 2. LETTURA FILE EXCEL / CSV E GENERAZIONE ANTEPRIMA
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('Lettura file in corso...')

    try {
      let rawData: any[] = []

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        rawData = parseCsvString(text)
      } else {
        const workbook = new ExcelJS.Workbook()
        const arrayBuffer = await file.arrayBuffer()
        await workbook.xlsx.load(arrayBuffer)

        const worksheet = workbook.worksheets[0]
        if (!worksheet) throw new Error('Nessun foglio di lavoro trovato nel file.')

        const headers: string[] = []

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = cell.text ? String(cell.text).trim() : ''
            })
          } else {
            const rowObj: any = {}
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber]
              if (header) {
                let val = cell.value
                if (val !== null && typeof val === 'object') {
                  if ('result' in val) val = (val as any).result
                  else if ('text' in val) val = (val as any).text
                  else if ('hyperlink' in val) val = (val as any).text || (val as any).hyperlink
                }
                rowObj[header] = val
              }
            })
            if (Object.keys(rowObj).length > 0) rawData.push(rowObj)
          }
        })
      }

      // Mappatura flessibile dei nomi delle colonne (Italiano, Tedesco, Inglese)
      const parsed = rawData.map((row: any) => {
        const sku = String(row.SKU || row.sku || row.CodiceArticolo || row.Artikelnummer || '').trim()
        const length = String(row.Lunghezza || row.Länge || row.length || row.Laenge || '').trim()
        const exists = products.some(p => p.sku === sku && (p.length || '') === length)

        return {
          sku,
          brand: String(row.Marca || row.Marke || row.brand || row.Produttore || '').trim(),
          category: String(row.Categoria || row.Kategorie || row.category || 'Skis').trim(),
          title: String(row.Titolo || row.Titel || row.title || row.Denominazione || '').trim(),
          length,
          color: String(row.Colore || row.Farbe || row.color || '').trim(),
          price_ek: parseFloat(row.PrezzoEK || row.EK || row.price_ek || row.PrezzoAcquisto || 0) || 0,
          price_vk: parseFloat(row.PrezzoVK || row.VK || row.price_vk || row.PrezzoB2B || 0) || 0,
          stock_main: parseInt(row.GiacenzaPrincipale || row.BestandHauptlager || row.stock_main || row.MagazzinoPrincipale || 0) || 0,
          stock_external: parseInt(row.GiacenzaEsterna || row.BestandAussenlager || row.stock_external || row.MagazzinoEsterno || 0) || 0,
          image_url: row.Immagine || row.Bild || row.image_url || row.URLImmagine || null,
          isUpdate: exists
        }
      }).filter(item => item.sku !== '')

      setPreviewData(parsed)
      setUploadStatus(`${parsed.length} prodotti validi caricati per l'anteprime.`)
    } catch (err: any) {
      setUploadStatus('Errore durante la lettura: ' + err.message)
    }
  }

  // 3. SALVATAGGIO ANTEPRIMA NEL DATABASE (UPSERT)
  const handleConfirmUpload = async () => {
    if (previewData.length === 0) return

    setIsUploading(true)
    setUploadStatus('Caricamento dati nel database...')

    const dataToUpload = previewData.map(({ isUpdate, ...item }) => item)

    try {
      const res = await fetch('/api/admin/upload-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: dataToUpload }),
      })

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const textError = await res.text()
        console.error('Server HTML Error:', textError)
        setUploadStatus(`Errore (${res.status}): Route API non trovata o crash del server. Verificare i log del terminale.`)
        setIsUploading(false)
        return
      }

      const result = await res.json()

      if (!res.ok) {
        setUploadStatus('Errore durante l\'importazione: ' + result.error)
      } else {
        setUploadStatus(`🎉 Importati con successo ${dataToUpload.length} prodotti!`)
        setPreviewData([])
        loadData()
      }
    } catch (err: any) {
      setUploadStatus('Errore di rete: ' + err.message)
    }

    setIsUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Pannello di Controllo OUTBACK Admin</h1>
          <a href="/shop" className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-600">Vai al Shop →</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex border-b border-gray-300 mb-6 gap-4">
          <button onClick={() => setActiveTab('products')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📦 Prodotti ({products.length})</button>
          <button onClick={() => setActiveTab('customers')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>👥 Whitelist Clienti ({customers.length})</button>
          <button onClick={() => setActiveTab('upload')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📊 Importazione Excel / CSV</button>
        </div>

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form per Creazione O Modifica Prodotto */}
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg text-gray-800">{editingId ? 'Modifica Prodotto' : 'Crea Nuovo Prodotto'}</h2>
                {editingId && <button onClick={resetForm} className="text-xs text-red-500 underline">Annulla</button>}
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">SKU (Codice Articolo)</label>
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
                  <label className="block text-xs font-semibold text-gray-600">Nome Prodotto</label>
                  <input type="text" required value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} className="w-full p-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Lunghezza</label>
                    <input type="text" value={productForm.length} onChange={e => setProductForm({...productForm, length: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Prezzo VK / B2B (€)</label>
                    <input type="number" step="0.01" required value={productForm.price_vk} onChange={e => setProductForm({...productForm, price_vk: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" />
                  </div>
                </div>

                {/* Giacenze Magazzini */}
                <div className="p-3 bg-slate-50 rounded border space-y-2">
                  <div className="font-semibold text-xs text-slate-700">Modifica Giacenze Magazzino:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-emerald-700 font-medium">Magazzino Principale</label>
                      <input type="number" value={productForm.stock_main} onChange={e => setProductForm({...productForm, stock_main: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-amber-700 font-medium">Magazzino Esterno</label>
                      <input type="number" value={productForm.stock_external} onChange={e => setProductForm({...productForm, stock_external: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
                    </div>
                  </div>
                </div>

                {/* SEZIONE UPLOAD IMMAGINE */}
                <div className="p-3 bg-gray-50 rounded border space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">Immagine Prodotto (Upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadingImage && <p className="text-xs text-blue-600 font-medium">Caricamento immagine...</p>}
                  
                  {/* Anteprima Immagine */}
                  {productForm.image_url && (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={productForm.image_url} alt="Anteprima" className="w-12 h-12 object-contain border rounded bg-white" />
                      <span className="text-[10px] text-green-600 font-bold">✅ Immagine presente</span>
                    </div>
                  )}
                </div>

                <button type="submit" className={`w-full text-white font-bold py-2 rounded text-sm mt-4 ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {editingId ? 'Salva Modifiche' : 'Crea Articolo'}
                </button>
              </form>
            </div>

            {/* Tabella Prodotti */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border overflow-x-auto">
              <h2 className="font-bold text-lg mb-4 text-gray-800">Catalogo & Giacenze</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2">Img</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Marca & Articolo</th>
                    <th className="p-2">Lunghezza</th>
                    <th className="p-2">Prezzo B2B</th>
                    <th className="p-2 text-emerald-700">Mag. Principale</th>
                    <th className="p-2 text-amber-700">Mag. Esterno</th>
                    <th className="p-2 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className={`border-b hover:bg-gray-50 ${editingId === p.id ? 'bg-amber-50' : ''}`}>
                      <td className="p-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title} className="w-8 h-8 object-contain rounded bg-gray-50" />
                        ) : (
                          <span className="text-[10px] text-gray-400">Nessuna foto</span>
                        )}
                      </td>
                      <td className="p-2 font-mono font-bold">{p.sku}</td>
                      <td className="p-2"><strong>{p.brand}</strong> {p.title}</td>
                      <td className="p-2">{p.length || '-'}</td>
                      <td className="p-2 font-bold">{p.price_vk.toFixed(2)} €</td>
                      <td className="p-2 font-bold text-emerald-600">{p.stock_main || 0} pz.</td>
                      <td className="p-2 font-bold text-amber-600">{p.stock_external || 0} pz.</td>
                      <td className="p-2 text-right space-x-2">
                        <button onClick={() => handleEditClick(p)} className="p-1 text-slate-600 hover:text-blue-600 text-sm" title="Modifica articolo">✏️</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-1 text-red-500 hover:text-red-700 text-sm" title="Elimina articolo">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WHITELIST CLIENTE */}
        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
              <h2 className="font-bold text-lg mb-4 text-gray-800">Abilita Cliente B2B</h2>
              <form onSubmit={handleCreateCustomer} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Ragione Sociale</label>
                  <input type="text" required value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} className="w-full p-2 border rounded" placeholder="Es. Sportler SpA" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Referente</label>
                  <input type="text" required value={newCustomer.contact_name} onChange={e => setNewCustomer({...newCustomer, contact_name: e.target.value})} className="w-full p-2 border rounded" placeholder="Es. Mario Rossi" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">E-mail di Login</label>
                  <input type="email" required value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full p-2 border rounded" placeholder="cliente@azienda.it" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Indirizzo</label>
                  <input type="text" required value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border rounded" placeholder="Via Roma 12" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">CAP</label>
                    <input type="text" required value={newCustomer.zip_code} onChange={e => setNewCustomer({...newCustomer, zip_code: e.target.value})} className="w-full p-2 border rounded" placeholder="39100" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Città</label>
                    <input type="text" required value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} className="w-full p-2 border rounded" placeholder="Bolzano" />
                  </div>
                </div>

                {/* CHECKBOX ADMIN */}
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCustomer.is_admin}
                      onChange={e => setNewCustomer({...newCustomer, is_admin: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-gray-700">Imposta come Utente Admin (Sì / No)</span>
                  </label>
                </div>

                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-sm mt-4">
                  Registra e Abilita Cliente
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border overflow-x-auto">
              <h2 className="font-bold text-lg mb-4 text-gray-800">Clienti B2B Abilitati</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2">Azienda</th>
                    <th className="p-2">Contatto</th>
                    <th className="p-2">E-mail</th>
                    <th className="p-2">Città</th>
                    <th className="p-2">Ruolo (Admin)</th>
                    <th className="p-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-bold">{c.company_name}</td>
                      <td className="p-2">{c.contact_name}</td>
                      <td className="p-2 font-mono">{c.email}</td>
                      <td className="p-2">{c.zip_code} {c.city}</td>
                      <td className="p-2">
                        <button
                          onClick={() => handleToggleAdmin(c)}
                          title="Clicca per cambiare stato"
                          className="cursor-pointer"
                        >
                          {c.is_admin ? (
                            <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold hover:bg-purple-200">
                              👑 Admin (Sì)
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold hover:bg-gray-200">
                              👤 Cliente (No)
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold">Attivo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: UPLOAD EXCEL / CSV CON ANTEPRIMA */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-lg text-gray-800">Importazione Excel / CSV</h2>
                <p className="text-xs text-gray-500">Carica nuovi elenchi prodotti o aggiorna le giacenze in pochi secondi.</p>
              </div>

              {/* PULSANTE DOWNLOAD MODELLO */}
              <button
                onClick={downloadTemplate}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition"
              >
                📥 Scarica Modello Excel
              </button>
            </div>

            {/* DROPZONE FILE */}
            <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
              <div className="border-2 dashed border-blue-200 bg-blue-50/50 p-8 rounded-lg flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">📁</span>
                <p className="text-sm font-semibold text-gray-700 mb-2">Seleziona qui un file Excel (.xlsx) o CSV</p>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileSelect}
                  className="block text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              {uploadStatus && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded text-xs font-semibold border border-blue-200">
                  {uploadStatus}
                </div>
              )}
            </div>

            {/* TABELLA ANTEPRIMA PRIMA DELL'UPLOAD FINALE */}
            {previewData.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-md text-gray-800">
                    Anteprima Importazione ({previewData.length} articoli)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewData([])}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:underline"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleConfirmUpload}
                      disabled={isUploading}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded transition disabled:opacity-50"
                    >
                      {isUploading ? 'Importazione...' : '✅ Conferma e Importa Ora'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b text-gray-600">
                        <th className="p-2">Azione</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Marca & Titolo</th>
                        <th className="p-2">Lunghezza</th>
                        <th className="p-2">Prezzo VK (€)</th>
                        <th className="p-2">Mag. Principale</th>
                        <th className="p-2">Mag. Esterno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            {item.isUpdate ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">Aggiorna</span>
                            ) : (
                              <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold">Nuovo</span>
                            )}
                          </td>
                          <td className="p-2 font-mono font-bold">{item.sku}</td>
                          <td className="p-2"><strong>{item.brand}</strong> {item.title}</td>
                          <td className="p-2">{item.length || '-'}</td>
                          <td className="p-2 font-bold">{item.price_vk.toFixed(2)} €</td>
                          <td className="p-2 text-emerald-700 font-bold">{item.stock_main} pz.</td>
                          <td className="p-2 text-amber-700 font-bold">{item.stock_external} pz.</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}