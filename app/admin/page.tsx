'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'customers' | 'upload'>('products')
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // State für manuelle Produktanlage / Bearbeitung
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

  // State für Kunden
  const [newCustomer, setNewCustomer] = useState({
    company_name: '', contact_name: '', email: '', address: '', zip_code: '', city: ''
  })

  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)

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

  // BILD UPLOAD ZU SUPABASE STORAGE
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
        alert('Fehler beim Bild-Upload: ' + uploadError.message)
        setUploadingImage(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      setProductForm(prev => ({ ...prev, image_url: urlData.publicUrl }))
    } catch (err: any) {
      alert('Upload fehlgeschlagen: ' + err.message)
    }
    setUploadingImage(false)
  }

  // Produkt Erstellen ODER Aktualisieren
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingId) {
      const { error } = await supabase.from('products').update(productForm).eq('id', editingId)
      if (error) alert('Fehler beim Aktualisieren: ' + error.message)
      else alert('Produkt erfolgreich aktualisiert!')
    } else {
      const { error } = await supabase.from('products').insert([productForm])
      if (error) alert('Fehler beim Erstellen: ' + error.message)
      else alert('Produkt neu angelegt!')
    }

    resetForm()
    loadData()
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
    if (!confirm('Artikel wirklich löschen?')) return
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

  // Kunden freischalten
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('customers').insert([{
      ...newCustomer,
      email: newCustomer.email.trim().toLowerCase(),
      is_active: true
    }])
    if (!error) {
      alert('Kunde freigeschaltet!')
      setNewCustomer({ company_name: '', contact_name: '', email: '', address: '', zip_code: '', city: '' })
      loadData()
    }
  }

  // Excel Bulk Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus('Lese Datei ein...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)

        const formattedData = data.map((row: any) => ({
          sku: String(row.SKU || row.sku || '').trim(),
          brand: String(row.Marke || row.brand || '').trim(),
          category: String(row.Kategorie || row.category || 'Skis').trim(),
          title: String(row.Titel || row.title || '').trim(),
          length: String(row.Länge || row.length || '').trim(),
          color: String(row.Farbe || row.color || '').trim(),
          price_ek: parseFloat(row.EK || row.price_ek || 0),
          price_vk: parseFloat(row.VK || row.price_vk || 0),
          stock_main: parseInt(row.BestandHauptlager || row.stock_main || 0),
          stock_external: parseInt(row.BestandAussenlager || row.stock_external || 0),
          image_url: row.Bild || row.image_url || null,
        }))

        const { error } = await supabase.from('products').upsert(formattedData, { onConflict: 'sku,length' })

        if (error) setUploadStatus('Fehler: ' + error.message)
        else {
          setUploadStatus(`✅ ${formattedData.length} Produkte aktualisiert!`)
          loadData()
        }
      } catch (err: any) {
        setUploadStatus('Fehler: ' + err.message)
      }
      setIsUploading(false)
    }
    reader.readAsBinaryString(file)
  }

  // Excel Preview & Upload States
  const [previewData, setPreviewData] = useState<any[]>([])

  // 1. MUSTER-EXCEL-VORLAGE GENERIEREN & HERUNTERLADEN
  const downloadTemplate = () => {
    const templateData = [
      {
        SKU: 'SK-AT-G9',
        Marke: 'Atomic',
        Kategorie: 'Skis',
        Titel: 'Redster G9 Revoshock S',
        Länge: '173cm',
        Farbe: 'Rot',
        EK: 380.00,
        VK: 580.00,
        BestandHauptlager: 10,
        BestandAussenlager: 5,
        Bild: 'https://...'
      },
      {
        SKU: 'ST-LK-SP3D',
        Marke: 'Leki',
        Kategorie: 'Stöcke',
        Titel: 'Spitfire 3D Freeride',
        Länge: '125cm',
        Farbe: 'Gelb',
        EK: 32.00,
        VK: 55.00,
        BestandHauptlager: 25,
        BestandAussenlager: 0,
        Bild: ''
      }
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produkte_Vorlage')
    XLSX.writeFile(wb, 'Outback_B2B_Produkt_Vorlage.xlsx')
  }

  // 2. EXCEL DATEI LESEN & VORSCHAU ERZEUGEN
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('Lese Datei ein...')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(ws)

        // Flexible Zuordnung der Spaltenbezeichnungen
        const parsed = rawData.map((row: any) => {
          const sku = String(row.SKU || row.sku || row.Artikelnummer || '').trim()
          const length = String(row.Länge || row.length || row.Laenge || '').trim()
          const exists = products.some(p => p.sku === sku && (p.length || '') === length)

          return {
            sku,
            brand: String(row.Marke || row.brand || row.Hersteller || '').trim(),
            category: String(row.Kategorie || row.category || 'Skis').trim(),
            title: String(row.Titel || row.title || row.Bezeichnung || '').trim(),
            length,
            color: String(row.Farbe || row.color || '').trim(),
            price_ek: parseFloat(row.EK || row.price_ek || row.Einkaufspreis || 0),
            price_vk: parseFloat(row.VK || row.price_vk || row.Verkaufspreis || row.B2BPreis || 0),
            stock_main: parseInt(row.BestandHauptlager || row.stock_main || row.Hauptlager || 0),
            stock_external: parseInt(row.BestandAussenlager || row.stock_external || row.Aussenlager || 0),
            image_url: row.Bild || row.image_url || row.BildURL || null,
            isUpdate: exists
          }
        }).filter(item => item.sku !== '')

        setPreviewData(parsed)
        setUploadStatus(`${parsed.length} gültige Produkte zur Vorschau geladen.`)
      } catch (err: any) {
        setUploadStatus('Fehler beim Einlesen: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  // 3. VORSCHAU IN DATENBANK SPEICHERN (UPSERT)
    const handleConfirmUpload = async () => {
        if (previewData.length === 0) return

        setIsUploading(true)
        setUploadStatus('Lade Daten in die Datenbank...')

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
            setUploadStatus(`Fehler (${res.status}): API-Route nicht gefunden oder Server-Crash. Bitte Terminal log prüfen.`)
            setIsUploading(false)
            return
        }

        const result = await res.json()

        if (!res.ok) {
            setUploadStatus('Fehler beim Import: ' + result.error)
        } else {
            setUploadStatus(`🎉 Erfolgreich ${dataToUpload.length} Produkte verarbeitet!`)
            setPreviewData([])
            loadData()
        }
        } catch (err: any) {
        setUploadStatus('Netzwerkfehler: ' + err.message)
        }

        setIsUploading(false)
    }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">OUTBACK Admin-Dashboard</h1>
          <a href="/shop" className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-600">Zum Shop →</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex border-b border-gray-300 mb-6 gap-4">
          <button onClick={() => setActiveTab('products')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📦 Produkte ({products.length})</button>
          <button onClick={() => setActiveTab('customers')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>👥 Kunden-Whitelist ({customers.length})</button>
          <button onClick={() => setActiveTab('upload')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📊 Excel / CSV Bulk-Upload</button>
        </div>

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formular für Neu anlegen ODER Bearbeiten */}
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg text-gray-800">{editingId ? 'Produkt Bearbeiten' : 'Neues Produkt anlegen'}</h2>
                {editingId && <button onClick={resetForm} className="text-xs text-red-500 underline">Abbrechen</button>}
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">SKU (Artikelnummer)</label>
                  <input type="text" required value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} className="w-full p-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Marke</label>
                    <input type="text" required value={productForm.brand} onChange={e => setProductForm({...productForm, brand: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Kategorie</label>
                    <input type="text" required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Produktbezeichnung</label>
                  <input type="text" required value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} className="w-full p-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Länge</label>
                    <input type="text" value={productForm.length} onChange={e => setProductForm({...productForm, length: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">VK / B2B Preis (€)</label>
                    <input type="number" step="0.01" required value={productForm.price_vk} onChange={e => setProductForm({...productForm, price_vk: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" />
                  </div>
                </div>

                {/* Bestände für beide Lager */}
                <div className="p-3 bg-slate-50 rounded border space-y-2">
                  <div className="font-semibold text-xs text-slate-700">Lagerbestände anpassen:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-emerald-700 font-medium">Hauptlager</label>
                      <input type="number" value={productForm.stock_main} onChange={e => setProductForm({...productForm, stock_main: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-amber-700 font-medium">Außenlager</label>
                      <input type="number" value={productForm.stock_external} onChange={e => setProductForm({...productForm, stock_external: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded bg-white" />
                    </div>
                  </div>
                </div>

                {/* BILD UPLOAD BEREICH */}
                <div className="p-3 bg-gray-50 rounded border space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">Produktbild (Upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadingImage && <p className="text-xs text-blue-600 font-medium">Bild wird hochgeladen...</p>}
                  
                  {/* Bild-Vorschau */}
                  {productForm.image_url && (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={productForm.image_url} alt="Vorschau" className="w-12 h-12 object-contain border rounded bg-white" />
                      <span className="text-[10px] text-green-600 font-bold">✅ Bild vorhanden</span>
                    </div>
                  )}
                </div>

                <button type="submit" className={`w-full text-white font-bold py-2 rounded text-sm mt-4 ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {editingId ? 'Änderungen Speichern' : 'Artikel Anlegen'}
                </button>
              </form>
            </div>

            {/* Produkt-Tabelle mit Bleistift-Icon */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border overflow-x-auto">
              <h2 className="font-bold text-lg mb-4 text-gray-800">Katalog & Bestände</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2">Bild</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Marke & Artikel</th>
                    <th className="p-2">Länge</th>
                    <th className="p-2">B2B Preis</th>
                    <th className="p-2 text-emerald-700">Hauptlager</th>
                    <th className="p-2 text-amber-700">Außenlager</th>
                    <th className="p-2 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className={`border-b hover:bg-gray-50 ${editingId === p.id ? 'bg-amber-50' : ''}`}>
                      <td className="p-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title} className="w-8 h-8 object-contain rounded bg-gray-50" />
                        ) : (
                          <span className="text-[10px] text-gray-400">Kein Bild</span>
                        )}
                      </td>
                      <td className="p-2 font-mono font-bold">{p.sku}</td>
                      <td className="p-2"><strong>{p.brand}</strong> {p.title}</td>
                      <td className="p-2">{p.length || '-'}</td>
                      <td className="p-2 font-bold">{p.price_vk.toFixed(2)} €</td>
                      <td className="p-2 font-bold text-emerald-600">{p.stock_main || 0} Stk.</td>
                      <td className="p-2 font-bold text-amber-600">{p.stock_external || 0} Stk.</td>
                      <td className="p-2 text-right space-x-2">
                        <button onClick={() => handleEditClick(p)} className="p-1 text-slate-600 hover:text-blue-600 text-sm" title="Artikel bearbeiten">✏️</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-1 text-red-500 hover:text-red-700 text-sm" title="Artikel löschen">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: KUNDEN WHITELIST */}
        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
              <h2 className="font-bold text-lg mb-4 text-gray-800">B2B Kunde Freischalten</h2>
              <form onSubmit={handleCreateCustomer} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Firmenname</label>
                  <input type="text" required value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} className="w-full p-2 border rounded" placeholder="z.B. Sportler AG" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Ansprechpartner</label>
                  <input type="text" required value={newCustomer.contact_name} onChange={e => setNewCustomer({...newCustomer, contact_name: e.target.value})} className="w-full p-2 border rounded" placeholder="z.B. Max Mustermann" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Login E-Mail</label>
                  <input type="email" required value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full p-2 border rounded" placeholder="kunde@firma.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Adresse</label>
                  <input type="text" required value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border rounded" placeholder="Hauptstraße 12" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">PLZ</label>
                    <input type="text" required value={newCustomer.zip_code} onChange={e => setNewCustomer({...newCustomer, zip_code: e.target.value})} className="w-full p-2 border rounded" placeholder="39100" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Ort</label>
                    <input type="text" required value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} className="w-full p-2 border rounded" placeholder="Bozen" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-sm mt-4">
                  Kunde Registrieren & Freischalten
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border overflow-x-auto">
              <h2 className="font-bold text-lg mb-4 text-gray-800">Freigeschaltete B2B Kunden</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2">Firma</th>
                    <th className="p-2">Kontakt</th>
                    <th className="p-2">E-Mail</th>
                    <th className="p-2">Ort</th>
                    <th className="p-2">Status</th>
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
                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold">Aktiv</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EXCEL UPLOAD */}
{/* TAB 3: OPTIMIERTER EXCEL UPLOAD MIT VORSCHAU */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-lg text-gray-800">Excel / CSV Import</h2>
                <p className="text-xs text-gray-500">Lade neue Produktlisten hoch oder aktualisiere Bestände in Sekunden.</p>
              </div>

              {/* DOWNLOAD-BUTTON FÜR DIE PROFI-VORLAGE */}
              <button
                onClick={downloadTemplate}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition"
              >
                📥 Muster-Excel Herunterladen
              </button>
            </div>

            {/* DATEI DROPZONE */}
            <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
              <div className="border-2 dashed border-blue-200 bg-blue-50/50 p-8 rounded-lg flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">📁</span>
                <p className="text-sm font-semibold text-gray-700 mb-2">Excel-Datei (.xlsx) oder CSV hier auswählen</p>
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

            {/* VORSCHAU-TABELLE VOR DEM FINALE UPLOAD */}
            {previewData.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-md text-gray-800">
                    Import-Vorschau ({previewData.length} Artikel)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewData([])}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:underline"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleConfirmUpload}
                      disabled={isUploading}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded transition disabled:opacity-50"
                    >
                      {isUploading ? 'Importiere...' : '✅ Import Jetzt Bestätigen'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b text-gray-600">
                        <th className="p-2">Aktion</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Marke & Titel</th>
                        <th className="p-2">Länge</th>
                        <th className="p-2">VK (€)</th>
                        <th className="p-2">Hauptlager</th>
                        <th className="p-2">Außenlager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            {item.isUpdate ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">Update</span>
                            ) : (
                              <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold">Neu</span>
                            )}
                          </td>
                          <td className="p-2 font-mono font-bold">{item.sku}</td>
                          <td className="p-2"><strong>{item.brand}</strong> {item.title}</td>
                          <td className="p-2">{item.length || '-'}</td>
                          <td className="p-2 font-bold">{item.price_vk.toFixed(2)} €</td>
                          <td className="p-2 text-emerald-700 font-bold">{item.stock_main} Stk.</td>
                          <td className="p-2 text-amber-700 font-bold">{item.stock_external} Stk.</td>
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