'use client'

import { useState } from 'react'
import ExcelJS from 'exceljs'

interface UploadTabProps {
  products: any[]
  loadData: () => void
}

export default function UploadTab({ products, loadData }: UploadTabProps) {
  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

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

  const downloadTemplate = async () => {
    const templateData = [
      {
        SKU: 'SK-AT-G9-173',
        Marca: 'Atomic',
        Categoria: 'Skis',
        Titolo: 'Redster G9 Revoshock S',
        Lunghezza: '173cm',
        Colore: 'Rosso',
        PrezzoEK: 380.00,
        PrezzoVK: 580.00,
        GiacenzaPrincipale: 10,
        GiacenzaEsterna: 5,
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
      { header: 'Colore', key: 'Colore', width: 12 },
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
        if (!worksheet) throw new Error('Nessun foglio trovato.')

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
                }
                rowObj[header] = val
              }
            })
            if (Object.keys(rowObj).length > 0) rawData.push(rowObj)
          }
        })
      }

      const parsed = rawData.map((row: any) => {
        const sku = String(row.SKU || row.sku || '').trim()
        const length = String(row.Lunghezza || row.Länge || row.length || '').trim()
        const exists = products.some(p => p.sku === sku && (p.length || '') === length)

        return {
          sku,
          brand: String(row.Marca || row.Marke || row.brand || '').trim(),
          category: String(row.Categoria || row.Kategorie || 'Skis').trim(),
          title: String(row.Titolo || row.Titel || row.title || '').trim(),
          length,
          color: String(row.Colore || row.Farbe || row.color || '').trim(),
          price_ek: parseFloat(row.PrezzoEK || row.EK || 0) || 0,
          price_vk: parseFloat(row.PrezzoVK || row.VK || 0) || 0,
          stock_main: parseInt(row.GiacenzaPrincipale || row.BestandHauptlager || 0) || 0,
          stock_external: parseInt(row.GiacenzaEsterna || row.BestandAussenlager || 0) || 0,
          image_url: row.Immagine || row.Bild || null,
          isUpdate: exists
        }
      }).filter(item => item.sku !== '')

      setPreviewData(parsed)
      setUploadStatus(`${parsed.length} prodotti pronti per l'anteprima.`)
    } catch (err: any) {
      setUploadStatus('Errore: ' + err.message)
    }
  }

  const handleConfirmUpload = async () => {
    if (previewData.length === 0) return

    setIsUploading(true)
    setUploadStatus('Caricamento nel database...')

    const dataToUpload = previewData.map(({ isUpdate, ...item }) => item)

    try {
      const res = await fetch('/api/admin/upload-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: dataToUpload }),
      })

      const result = await res.json()

      if (!res.ok) {
        setUploadStatus('Errore: ' + result.error)
      } else {
        setUploadStatus(`🎉 Importati ${dataToUpload.length} prodotti!`)
        setPreviewData([])
        loadData()
      }
    } catch (err: any) {
      setUploadStatus('Errore di rete: ' + err.message)
    }

    setIsUploading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="font-bold text-lg text-gray-800">Importazione Excel / CSV</h2>
          <p className="text-xs text-gray-500">Carica nuovi elenchi prodotti o aggiorna le giacenze in pochi secondi.</p>
        </div>

        <button
          onClick={downloadTemplate}
          className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition"
        >
          📥 Scarica Modello Excel
        </button>
      </div>

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
                  <th className="p-2">Colore</th>
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
                    <td className="p-2">{item.color || '-'}</td>
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
  )
}