'use client'

import { useLanguage } from '@/context/LanguageContext'

export default function LanguageSwitcher() {
  // Destrukturiere 'setLanguage' anstelle von 'setLang' (oder 'language' als 'lang')
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700 text-xs text-white">
      <button
        type="button"
        onClick={() => setLanguage('de')}
        className={`px-2 py-0.5 rounded font-bold transition ${
          language === 'de' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'
        }`}
      >
        DE
      </button>

      <button
        type="button"
        onClick={() => setLanguage('it')}
        className={`px-2 py-0.5 rounded font-bold transition ${
          language === 'it' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'
        }`}
      >
        IT
      </button>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 rounded font-bold transition ${
          language === 'en' ? 'bg-blue-600 text-white' : 'hover:text-gray-300'
        }`}
      >
        EN
      </button>
    </div>
  )
}