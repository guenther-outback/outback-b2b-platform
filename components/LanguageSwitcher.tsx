'use client'

import { useLanguage } from '@/context/LanguageContext'

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700 text-xs text-white">
      <button
        onClick={() => setLang('de')}
        className={`px-2 py-0.5 rounded font-bold transition ${lang === 'de' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'}`}
      >
        DE
      </button>
      <button
        onClick={() => setLang('it')}
        className={`px-2 py-0.5 rounded font-bold transition ${lang === 'it' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'}`}
      >
        IT
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-0.5 rounded font-bold transition ${lang === 'en' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'}`}
      >
        EN
      </button>
    </div>
  )
}