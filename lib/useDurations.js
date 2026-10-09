'use client'
import { useEffect, useState } from 'react'

// Længder på numre (sekunder), læst fra lydfilernes metadata i browseren — der gemmes ikke noget i databasen.
// Hentes få ad gangen og kun metadata. Kan en browser ikke (fx iOS uden tryk), vises der bare ingen længde.
const cache = new Map() // nummerets id -> sekunder
const CONCURRENCY = 3
const TIMEOUT_MS = 8000

export function useDurations(tracks) {
  const [durations, setDurations] = useState({})
  const signature = (tracks || []).map((x) => `${x.id}:${x.url ? 1 : 0}`).join('|')

  useEffect(() => {
    const list = tracks || []
    const known = {}
    for (const item of list) if (cache.has(item.id)) known[item.id] = cache.get(item.id)
    setDurations(known)

    const queue = list.filter((item) => item.url && !cache.has(item.id))
    let stopped = false
    const active = new Set()

    function finish(audio, timer) {
      clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
      active.delete(audio)
      pump()
    }

    function start(item) {
      const audio = new Audio()
      active.add(audio)
      audio.preload = 'metadata'
      const timer = setTimeout(() => finish(audio, timer), TIMEOUT_MS)
      audio.onloadedmetadata = () => {
        const seconds = audio.duration
        if (!stopped && Number.isFinite(seconds) && seconds > 0) {
          cache.set(item.id, seconds)
          setDurations((prev) => ({ ...prev, [item.id]: seconds }))
        }
        finish(audio, timer)
      }
      audio.onerror = () => finish(audio, timer)
      audio.src = item.url
    }

    function pump() {
      while (!stopped && active.size < CONCURRENCY && queue.length > 0) start(queue.shift())
    }
    pump()

    return () => {
      stopped = true
      queue.length = 0
      for (const audio of active) {
        audio.onloadedmetadata = null
        audio.onerror = null
        audio.removeAttribute('src')
        audio.load()
      }
      active.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return durations
}

// Samlet spilletid i hele minutter, delt op i timer og minutter: { hours, minutes }
export function splitTotal(seconds) {
  const totalMinutes = Math.max(1, Math.round((Number(seconds) || 0) / 60))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}
