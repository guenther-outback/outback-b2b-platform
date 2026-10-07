'use client'

import { useState } from 'react'
import QuantityInput from '@/components/QuantityInput'

interface ProductCatalogProps {
  products: any[]
  loading: boolean
  allowedBrands: string[] | null
  cart: any[]
  addToCart: (item: any, quantity: number) => void
  t: (key: string) => string
}

export default function ProductCatalog({
  products,
  loading,
  allowedBrands,
  cart,
  addToCart,
  t,
}: ProductCatalogProps) {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedColors, setSelectedColors] = useState<{ [groupKey: string]: string }>({})
  const [selectedLengths, setSelectedLengths] = useState<{ [groupKey: string]: string }>({})
  const [selectedQuantities, setSelectedQuantities] = useState<{ [groupKey: string]: number }>({})

  // Berechnet den virtuellen Restbestand im Shop (Originalbestand minus Warenkorb)
  const getEffectiveStock = (product: any) => {
    if (!product) return { stockMain: 0, stockExt: 0, total: 0 }

    const cartItem = cart.find((item) => item.id === product.id)
    const qtyInCart = Number(cartItem?.quantity) || 0

    const rawMain = Number(product.stock_main) || 0
    const rawExt = Number(product.stock_external) || 0

    const deductMain = Math.min(rawMain, qtyInCart)
    const remQty = qtyInCart - deductMain
    const deductExt = Math.min(rawExt, remQty)

    const stockMain = Math.max(0, rawMain - deductMain)
    const stockExt = Math.max(0, rawExt - deductExt)
    const total = stockMain + stockExt

    return { stockMain, stockExt, total }
  }

  // 1. Nur Produkte mit Bestand & erlaubter Marke berücksichtigen
  const availableProducts = products.filter((p) => {
    const hasStock = getEffectiveStock(p).total > 0
    const isBrandAllowed = !allowedBrands || (p.brand && allowedBrands.includes(p.brand))
    return hasStock && isBrandAllowed
  })

  // 2. Gruppierung streng nach Titel/Beschreibung (sowie Marke)
  const getGroupKey = (product: any) => {
    return `${(product.brand || '').trim().toUpperCase()}_${(product.title || '').trim().toLowerCase()}`
  }

  const groupedProducts = availableProducts.reduce((acc: { [key: string]: any[] }, product) => {
    const key = getGroupKey(product)
    if (!acc[key]) acc[key] = []
    acc[key].push(product)
    return acc
  }, {})

  const brands = Array.from(new Set(availableProducts.map((p) => p.brand).filter(Boolean)))

  // 3. Filtern nach Suche und Marke
  const groupedKeys = Object.keys(groupedProducts).filter((groupKey) => {
    const group = groupedProducts[groupKey]
    const mainItem = group[0]

    const matchesSearch =
      mainItem.title.toLowerCase().includes(search.toLowerCase()) ||
      group.some((p: any) => p.sku.toLowerCase().includes(search.toLowerCase()))

    const matchesBrand = selectedBrand === '' || mainItem.brand === selectedBrand

    return matchesSearch && matchesBrand
  })

  const handleAddToCart = (groupKey: string) => {
    const group = groupedProducts[groupKey]
    if (!group) return

    const selectedColor = selectedColors[groupKey]
    const selectedLength = selectedLengths[groupKey]
    const quantityToAdd = selectedQuantities[groupKey] || 1

    const productVariant =
      group.find(
        (p) =>
          (selectedColor ? p.color === selectedColor : true) &&
          (selectedLength ? p.length === selectedLength : true)
      ) || group[0]

    if (productVariant) {
      const { total: effectiveTotal } = getEffectiveStock(productVariant)

      if (effectiveTotal <= 0) {
        alert('Dieser Artikel ist leider ausverkauft.')
        return
      }

      const safeQuantity = Math.min(quantityToAdd, effectiveTotal)

      const ekPrice =
        Number(productVariant.price_ek) > 0
          ? Number(productVariant.price_ek)
          : Number(productVariant.price_vk)

      const itemForCart = {
        ...productVariant,
        price_ek: ekPrice,
      }

      addToCart(itemForCart, safeQuantity)
      setSelectedQuantities((prev) => ({ ...prev, [groupKey]: 1 }))
    }
  }

  return (
    <div>
      {/* Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center border border-gray-200">
        <input
          type="text"
          placeholder={t('shop.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full md:w-1/4 p-2 border border-gray-300 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('shop.all_brands')}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Produkte Grid */}
      {loading ? (
        <p className="text-center py-12 text-gray-600 font-medium">Lade Produkte...</p>
      ) : groupedKeys.length === 0 ? (
        <p className="text-center py-12 text-gray-600 font-medium">
          Keine verfügbaren Artikel gefunden.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedKeys.map((groupKey) => {
            const group = groupedProducts[groupKey]
            const mainItem = group[0]

            const availableColors = Array.from(
              new Set(group.map((p) => p.color).filter(Boolean))
            ) as string[]

            const currentColor = selectedColors[groupKey] || availableColors[0] || ''

            const colorFilteredGroup = group.filter(
              (p) => !currentColor || p.color === currentColor
            )

            const availableLengths = Array.from(
              new Set(
                colorFilteredGroup
                  .filter((p) => getEffectiveStock(p).total > 0)
                  .map((p) => p.length)
                  .filter(Boolean)
              )
            ) as string[]

            const currentLength = selectedLengths[groupKey] || availableLengths[0] || ''

            const activeVariant =
              group.find(
                (p) =>
                  (currentColor ? p.color === currentColor : true) &&
                  (currentLength ? p.length === currentLength : true)
              ) || group[0]

            const effectiveStock = getEffectiveStock(activeVariant)

            return (
              <div
                key={groupKey}
                className="group relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible flex flex-col justify-between hover:shadow-md transition z-10 hover:z-30"
              >
                {/* Produktbild mit Hover-Zoom Vorschau */}
                <div className="h-48 bg-gray-100 flex items-center justify-center border-b border-gray-100 relative rounded-t-lg">
                  {activeVariant.image_url ? (
                    <>
                      {/* Normales Kartenbild */}
                      <img
                        src={activeVariant.image_url}
                        alt={`${mainItem.title} ${currentColor}`}
                        className="w-full h-full object-contain p-4 cursor-pointer transition-transform duration-200 group-hover:scale-105"
                      />

                      {/* Große Hover-Vorschau (Nur auf Desktop `md:`, zentriert und schwebend) */}
                      <div className="hidden md:group-hover:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-white p-6 rounded-2xl shadow-2xl border border-gray-300 z-50 pointer-events-none items-center justify-center transition-all animate-in fade-in zoom-in-95 duration-150">
                        <img
                          src={activeVariant.image_url}
                          alt={`${mainItem.title} preview`}
                          className="max-w-full max-h-full object-contain drop-shadow-md"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-600 text-xs font-semibold flex flex-col items-center gap-1">
                      <span>📷 Kein Bild für diese Farbe</span>
                    </div>
                  )}
                </div>

                {/* Produktdetails */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                        {mainItem.brand}
                      </span>
                      <span className="text-xs text-gray-600 font-medium">
                        SKU: {activeVariant.sku}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-3">{mainItem.title}</h3>

                    {/* VARIANTEN AUSWAHL: FARBE & LÄNGE */}
                    <div className="space-y-3 mb-4">
                      {(() => {
                        const hasValidLengths =
                          availableLengths.length > 0 && availableLengths.some((l) => l !== '')

                        return (
                          <>
                            {/* FARBAUSWAHL */}
                            {availableColors.length > 1 ? (
                              <div>
                                <label className="block text-xs font-bold text-gray-800 mb-1">
                                  {t('shop.select_color') || 'Farbe wählen:'}
                                </label>
                                <select
                                  value={currentColor}
                                  onChange={(e) => {
                                    const newColor = e.target.value
                                    setSelectedColors({ ...selectedColors, [groupKey]: newColor })

                                    const nextGroup = group.filter(
                                      (p) => p.color === newColor && getEffectiveStock(p).total > 0
                                    )
                                    if (nextGroup.length > 0) {
                                      setSelectedLengths({
                                        ...selectedLengths,
                                        [groupKey]: nextGroup[0].length,
                                      })
                                    }
                                  }}
                                  className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:bg-white font-medium text-gray-800"
                                >
                                  {availableColors.map((color) => {
                                    const variant = colorFilteredGroup.find((p) => p.color === color)
                                    const stockInfo =
                                      !hasValidLengths && variant
                                        ? ` (${t('shop.stock')}: ${getEffectiveStock(variant).total})`
                                        : ''

                                    return (
                                      <option key={color} value={color}>
                                        {color}
                                        {stockInfo}
                                      </option>
                                    )
                                  })}
                                </select>
                              </div>
                            ) : availableColors.length === 1 && availableColors[0] !== '' ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-gray-700">
                                  {t('shop.select_color') || 'Farbe:'}
                                </span>
                                <span className="bg-gray-100 border border-gray-200 text-gray-800 font-semibold px-2.5 py-1 rounded-md">
                                  {availableColors[0]}
                                  {!hasValidLengths && activeVariant && (
                                    <span className="ml-1 text-gray-600 font-normal">
                                      ({t('shop.stock')}: {getEffectiveStock(activeVariant).total})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {/* LÄNGENAUSWAHL */}
                            {availableLengths.length > 1 ? (
                              <div>
                                <label className="block text-xs font-bold text-gray-800 mb-1">
                                  {t('shop.select_length')}:
                                </label>
                                <select
                                  value={currentLength}
                                  onChange={(e) =>
                                    setSelectedLengths({ ...selectedLengths, [groupKey]: e.target.value })
                                  }
                                  className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:bg-white font-medium text-gray-800"
                                >
                                  {availableLengths.map((len) => {
                                    const variant = colorFilteredGroup.find((p) => p.length === len)
                                    if (!variant) return null
                                    const { total: stock } = getEffectiveStock(variant)

                                    return (
                                      <option key={len} value={len}>
                                        {len} ({t('shop.stock')}: {stock})
                                      </option>
                                    )
                                  })}
                                </select>
                              </div>
                            ) : availableLengths.length === 1 && availableLengths[0] !== '' ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-gray-700">{t('shop.select_length')}:</span>
                                <span className="bg-gray-100 border border-gray-200 text-gray-800 font-semibold px-2.5 py-1 rounded-md">
                                  {availableLengths[0]}
                                  <span className="ml-1 text-gray-600 font-normal">
                                    ({t('shop.stock')}: {effectiveStock.total})
                                  </span>
                                </span>
                              </div>
                            ) : null}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Lieferzeit-Status */}
                  <div className="mb-4 text-xs">
                    {effectiveStock.stockMain > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        <span>🟢</span> {t('shop.warehouse_main')} ({effectiveStock.stockMain} Stk.)
                      </span>
                    ) : effectiveStock.stockExt > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        <span>🟠</span> {t('shop.warehouse_external')} ({effectiveStock.stockExt} Stk.)
                      </span>
                    ) : null}
                  </div>

                  <div className="border-t pt-4 flex justify-between items-end gap-2 mt-2">
                    <div>
                      {activeVariant.price_vk > 0 && (
                        <div className="text-[11px] font-semibold text-gray-700">
                          {t('shop.price_uvp') || 'UVP'}: {activeVariant.price_vk.toFixed(2)} €
                        </div>
                      )}

                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mt-0.5">
                        {t('shop.price_b2b') || 'Ihr B2B Preis'}
                      </div>
                      <div className="text-2xl font-black text-gray-900 leading-tight">
                        {(activeVariant.price_ek || activeVariant.price_vk).toFixed(2)} €
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <QuantityInput
                        value={selectedQuantities[groupKey] || 1}
                        min={1}
                        max={effectiveStock.total}
                        disabled={effectiveStock.total <= 0}
                        onChange={(newQty) => {
                          setSelectedQuantities({
                            ...selectedQuantities,
                            [groupKey]: newQty,
                          })
                        }}
                      />

                      <button
                        onClick={() => handleAddToCart(groupKey)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium transition shrink-0"
                      >
                        {t('shop.add_to_cart')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}