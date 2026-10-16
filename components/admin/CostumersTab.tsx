'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useLanguage } from '@/context/LanguageContext'

interface CustomersTabProps {
  customers: any[]
  availableBrands: string[]
  loadData: () => void
}

type UserRole = 'customer' | 'agent' | 'admin'

export default function CustomersTab({ customers, availableBrands, loadData }: CustomersTabProps) {
  const [editingCustomerId, setEditingEditingCustomerId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  
  const { t } = useLanguage()

  const [newCustomer, setNewCustomer] = useState({
    company_name: '', 
    contact_name: '', 
    email: '', 
    address: '', 
    zip_code: '', 
    city: '',
    role: 'customer' as UserRole,
    agent_email: '',
    allowed_brands: [] as string[]
  })

  const supabase = createClient()

  // Liste aller registrierten Agenten für das Dropdown im Admin-Formular
  const availableAgents = customers.filter(c => c.role === 'agent')

  const filteredCustomers = customers.filter(c => {
    const query = customerSearch.toLowerCase().trim()
    if (!query) return true

    const company = (c.company_name || '').toLowerCase()
    const contact = (c.contact_name || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const city = (c.city || '').toLowerCase()

    return company.includes(query) || contact.includes(query) || email.includes(query) || city.includes(query)
  })

  const handleBrandToggle = (brand: string) => {
    setNewCustomer(prev => {
      const exists = prev.allowed_brands.includes(brand)
      const updated = exists 
        ? prev.allowed_brands.filter(b => b !== brand)
        : [...prev.allowed_brands, brand]
      return { ...prev, allowed_brands: updated }
    })
  }

  const handleCreateOrUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = {
      ...newCustomer,
      email: newCustomer.email.trim().toLowerCase(),
      agent_email: newCustomer.role === 'customer' && newCustomer.agent_email ? newCustomer.agent_email.trim().toLowerCase() : null
    }

    if (editingCustomerId) {
      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', editingCustomerId)

      if (!error) {
        alert('Cliente aggiornato con successo!')
        resetForm()
        loadData()
      } else {
        alert('Errore aggiornamento: ' + error.message)
      }
    } else {
      const { error } = await supabase.from('customers').insert([{
        ...payload,
        is_active: true
      }])

      if (!error) {
        alert('Cliente abilitato con successo!')
        resetForm()
        loadData()
      } else {
        alert('Errore registrazione: ' + error.message)
      }
    }
  }

  const handleEditClick = (c: any) => {
    setEditingEditingCustomerId(c.id)
    setNewCustomer({
      company_name: c.company_name || '',
      contact_name: c.contact_name || '',
      email: c.email || '',
      address: c.address || '',
      zip_code: c.zip_code || '',
      city: c.city || '',
      role: (c.role as UserRole) || 'customer',
      agent_email: c.agent_email || '',
      allowed_brands: c.allowed_brands || []
    })
  }

  const resetForm = () => {
    setEditingEditingCustomerId(null)
    setNewCustomer({ 
      company_name: '', 
      contact_name: '', 
      email: '', 
      address: '', 
      zip_code: '', 
      city: '', 
      role: 'customer', 
      agent_email: '',
      allowed_brands: [] 
    })
  }

  const handleRoleChange = async (customer: any, newRole: UserRole) => {
    const { error } = await supabase
      .from('customers')
      .update({ role: newRole })
      .eq('id', customer.id)

    if (!error) loadData()
    else alert('Errore cambio ruolo: ' + error.message)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Formular */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-gray-800">
            {editingCustomerId ? 'Modifica Utente' : 'Abilita Nuovo Utente'}
          </h2>
          {editingCustomerId && (
            <button onClick={resetForm} className="text-xs text-red-500 underline font-semibold">
              Annulla
            </button>
          )}
        </div>

        <form onSubmit={handleCreateOrUpdateCustomer} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Ragione Sociale</label>
            <input type="text" required value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700">Referente</label>
            <input type="text" required value={newCustomer.contact_name} onChange={e => setNewCustomer({...newCustomer, contact_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700">E-mail di Login</label>
            <input type="email" required value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700">Indirizzo</label>
            <input type="text" required value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700">CAP</label>
              <input type="text" required value={newCustomer.zip_code} onChange={e => setNewCustomer({...newCustomer, zip_code: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Città</label>
              <input type="text" required value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} className="w-full p-2 border border-gray-300 rounded text-gray-800" />
            </div>
          </div>

          {/* RUOLO SELECTION */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs font-bold text-gray-800 mb-1">Ruolo Utente</label>
            <select
              value={newCustomer.role}
              onChange={e => setNewCustomer({ ...newCustomer, role: e.target.value as UserRole })}
              className="w-full p-2 border border-gray-300 rounded text-xs font-bold text-gray-800 bg-white"
            >
              <option value="customer">👤 {t('shop.roles.customer')}</option>
              <option value="agent">💼 {t('shop.roles.agent')}</option>
              <option value="admin">👑 {t('shop.roles.admin')}</option>
            </select>
          </div>

          {/* AGENTEN-ZUORDNUNG (NUR SICHTBAR WENN RUOLO = CUSTOMER) */}
          {newCustomer.role === 'customer' && (
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                💼 Agente Assegnato (Opzionale)
              </label>
              <select
                value={newCustomer.agent_email}
                onChange={e => setNewCustomer({ ...newCustomer, agent_email: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-xs text-gray-800 bg-white"
              >
                <option value="">-- Nessun agente assegnato --</option>
                {availableAgents.map(ag => (
                  <option key={ag.id} value={ag.email}>
                    {ag.company_name || ag.contact_name} ({ag.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MARKEN-ZUTEILUNG */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs font-bold text-gray-800 mb-1.5">
              Marchi Autorizzati (Vuoto = Tutti):
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-gray-50 rounded border border-gray-200">
              {availableBrands.map(brand => {
                const isSelected = newCustomer.allowed_brands.includes(brand)
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => handleBrandToggle(brand)}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition border ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{brand}
                  </button>
                )
              })}
            </div>
          </div>

          <button type="submit" className={`w-full text-white font-bold py-2 rounded text-sm mt-4 ${editingCustomerId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {editingCustomerId ? 'Salva Modifiche' : 'Registra e Abilita Utente'}
          </button>
        </form>
      </div>

      {/* Tabelle */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="font-bold text-lg text-gray-800 shrink-0">
            Utenti e Clienti B2B ({filteredCustomers.length})
          </h2>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Cerca cliente, e-mail, città..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute left-2.5 top-1.5 text-gray-400 text-xs">🔍</span>
          </div>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-gray-800 font-bold">
              <th className="p-2">Azienda / Referente</th>
              <th className="p-2">E-mail</th>
              <th className="p-2">Agente</th>
              <th className="p-2">Ruolo</th>
              <th className="p-2 text-right">Azione</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 font-bold text-gray-900">
                  {c.company_name}
                  <div className="text-[10px] font-normal text-gray-600">{c.contact_name} ({c.city})</div>
                </td>
                <td className="p-2 font-mono text-gray-700">{c.email}</td>
                <td className="p-2 text-gray-600">
                  {c.agent_email ? (
                    <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                      💼 {c.agent_email}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-[10px]">-</span>
                  )}
                </td>
                <td className="p-2">
                  <select
                    value={c.role || 'customer'}
                    onChange={(e) => handleRoleChange(c, e.target.value as UserRole)}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${
                      c.role === 'admin'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : c.role === 'agent'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300'
                    }`}
                  >
                    <option value="customer">👤 {t('shop.roles.customer')}</option>
                    <option value="agent">💼 {t('shop.roles.agent')}</option>
                    <option value="admin">👑 {t('shop.roles.admin')}</option>
                  </select>
                </td>
                <td className="p-2 text-right">
                  <button onClick={() => handleEditClick(c)} className="p-1 text-slate-600 hover:text-blue-600 text-sm font-bold" title="Modifica cliente">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}