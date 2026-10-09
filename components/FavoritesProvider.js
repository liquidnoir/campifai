'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Brugerens favoritter (numre med hjerte). Hentes én gang, når man er logget ind, og holdes her,
// så hjerterne i alle lister og i afspilleren er i takt. Et tryk opdaterer med det samme og
// ruller tilbage, hvis det ikke lykkes at gemme.
const FavoritesContext = createContext({
  loggedIn: false,
  ready: false,
  count: 0,
  failed: false,
  isFavorite: () => false,
  toggle: async () => {},
})

export function useFavorites() {
  return useContext(FavoritesContext)
}

export function FavoritesProvider({ children }) {
  const [userId, setUserId] = useState(null)
  const [ids, setIds] = useState(() => new Set())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const idsRef = useRef(ids)
  idsRef.current = ids
  const failTimerRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })
    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(failTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setIds(new Set())
      setReady(false)
      return undefined
    }
    let active = true
    supabase
      .from('favorites')
      .select('track_id')
      .limit(5000)
      .then(({ data, error }) => {
        if (!active) return
        setIds(new Set(error ? [] : (data || []).map((row) => row.track_id)))
        setReady(true)
      })
    return () => {
      active = false
    }
  }, [userId])

  const toggle = useCallback(
    async (trackId) => {
      if (!userId || !trackId) return
      const adding = !idsRef.current.has(trackId)
      const apply = (add) =>
        setIds((prev) => {
          const next = new Set(prev)
          if (add) next.add(trackId)
          else next.delete(trackId)
          return next
        })
      apply(adding)
      const { error } = adding
        ? await supabase.from('favorites').insert({ track_id: trackId })
        : await supabase.from('favorites').delete().eq('track_id', trackId)
      // Findes den allerede (dobbelttryk), er det i orden — ellers rulles tilbage og der vises en fejl
      if (error && error.code !== '23505') {
        apply(!adding)
        setFailed(true)
        clearTimeout(failTimerRef.current)
        failTimerRef.current = setTimeout(() => setFailed(false), 3000)
      }
    },
    [userId]
  )

  const value = useMemo(
    () => ({
      loggedIn: Boolean(userId),
      ready,
      count: ids.size,
      failed,
      isFavorite: (trackId) => ids.has(trackId),
      toggle,
    }),
    [userId, ready, ids, failed, toggle]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
