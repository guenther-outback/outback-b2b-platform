'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import de from '@/locales/de.json'
import it from '@/locales/it.json'
import en from '@/locales/en.json'

const translations: Record<string, any> = { de, it, en }

type Language = 'de' | 'it' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('it')

  useEffect(() => {
    const savedLanguage = localStorage.getItem('app_language') as Language | null

    if (savedLanguage && ['de', 'it', 'en'].includes(savedLanguage)) {
      setLanguageState(savedLanguage)
    } else {
      const browserLang = navigator.language || (navigator as any).userLanguage || ''
      const langCode = browserLang.toLowerCase().slice(0, 2)

      if (langCode === 'de') setLanguageState('de')
      else if (langCode === 'it') setLanguageState('it')
      else setLanguageState('en')
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
  }

  // ROBUSTER KEY-RESOLVER FÜR NESTED KEYS (z.B. "shop.tab_catalog")
  const t = (key: string): string => {
    const langDict = translations[language] || translations['it']
    
    // 1. Erster Versuch: Direkter Key-Lookup
    if (langDict[key]) return langDict[key]

    // 2. Zweiter Versuch: Verschachtelte Pfade auflösen (z.B. "shop.tab_catalog" -> langDict.shop.tab_catalog)
    const keys = key.split('.')
    let current = langDict

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        // Fallback, falls der Key in der gewählten Sprache fehlt
        return key
      }
    }

    return typeof current === 'string' ? current : key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}