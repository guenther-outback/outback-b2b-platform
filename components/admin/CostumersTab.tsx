'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

interface CustomersTabProps {
  customers: any[]
  loadData: () => void
}

export default function CustomersTab({ customers, loadData }: CustomersTabProps) {
  const [newCustomer, setNewCustomer] = useState({
    company_name: '', 
    contact_name: '', 
    email: '', 
    address: '', 
    zip_code: '', 
    city: '',
    is_admin: false
  })

  const supabase = createClient()

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
      alert('Errore registrazione: ' + error.message)
    }
  }

  const handleToggleAdmin = async (customer: any) => {
    const newStatus = !customer.is_admin
    const { error } = await supabase
      .from('customers')
      .update({ is_admin: newStatus })
      .eq('id', customer.id)

    if (!error) loadData()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
        <h2 className="font-bold text-lg mb-4 text-gray-800">Abilita Cliente B2B</h2>
        <form onSubmit={handleCreateCustomer} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600">Ragione Sociale</label>
            <input type="text" required value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Referente</label>
            <input type="text" required value={newCustomer.contact_name} onChange={e => setNewCustomer({...newCustomer, contact_name: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">E-mail di Login</label>
            <input type="email" required value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600">Indirizzo</label>
            <input type="text" required value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600">CAP</label>
              <input type="text" required value={newCustomer.zip_code} onChange={e => setNewCustomer({...newCustomer, zip_code: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Città</label>
              <input type="text" required value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} className="w-full p-2 border rounded" />
            </div>
          </div>

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
  )
}