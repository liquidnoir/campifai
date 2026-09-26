'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../lib/translations'

const STORAGE_KEY = 'campifai_lang'

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en')

  useEffect(() => {
    let saved = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      // localStorage kan være utilgængelig (fx privat browsing) — ignorér stille
    }
    if (saved === 'da' || saved === 'en') {
      setLangState(saved)
      return
    }
    const browserLang = typeof navigator !== 'undefined' ? navigator.language || '' : ''
    setLangState(browserLang.toLowerCase().startsWith('da') ? 'da' : 'en')
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  function setLang(next) {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignorér stille, hvis localStorage ikke kan skrives
    }
  }

  function t(key, vars) {
    const dict = translations[lang] || translations.en
    let str = dict[key] ?? translations.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(String(v))
      }
    }
    return str
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
