'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import de from '@/locales/de.json'
import it from '@/locales/it.json'
import en from '@/locales/en.json'

type Language = 'de' | 'it' | 'en'
const dictionaries = { de, it, en }

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (path: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('de')

  useEffect(() => {
    const savedLang = localStorage.getItem('outback_lang') as Language
    if (savedLang && ['de', 'it', 'en'].includes(savedLang)) {
      setLangState(savedLang)
    }
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem('outback_lang', newLang)
  }

  const t = (path: string): string => {
    const keys = path.split('.')
    let result: any = dictionaries[lang]
    for (const key of keys) {
      if (result && result[key]) {
        result = result[key]
      } else {
        return path
      }
    }
    return result
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage muss innerhalb von LanguageProvider verwendet werden')
  return context
}