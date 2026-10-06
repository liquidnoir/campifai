'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from './LanguageProvider'
import { usePlayer } from './PlayerProvider'

// Nummerlisten på en side (udgivelse, playliste, radio). Den ejer ikke lyden — et tryk på en række
// giver den fælles afspiller listen, og musikken fortsætter, også når man skifter side.
//
//   tracks:        listens numre (se PlayerProvider for felterne)
//   sourceKey:     navn på kilden (fx "release:abc"). Spiller listen allerede, vises afspillerens egen kø
//                  (så en radio, der vokser undervejs, og det nummer, der spiller, ses her)
//   startIndex:    hvilket nummer der starter, når man trykker "Afspil" (fx fra et delt link)
//   loop, onNeedMore: se PlayerProvider (bruges af radio)
//   autoStart:     start listen af sig selv, når siden vises (radio) — medmindre den allerede spiller
//   followQueue:   spiller listen, vises selve køen i stedet for listens egne numre (radio, hvor køen vokser
//                  undervejs). Ellers vises altid listens egne numre — også selv om man har fjernet eller
//                  flyttet numre i køen, så en udgivelse aldrig ser ud til at have mistet et nummer
//   renderActions: valgfri, ekstra knapper i hver rækkes højre side (klik her skifter ikke nummer)
export default function TrackList({
  tracks,
  startIndex = 0,
  sourceKey = '',
  loop = false,
  onNeedMore,
  autoStart = false,
  followQueue = false,
  emptyMessage,
  renderActions,
}) {
  const { t } = useLanguage()
  const player = usePlayer()
  const startRowRef = useRef(null)
  const autoStartedRef = useRef('')

  // Er det netop denne liste, der spiller?
  const active = Boolean(sourceKey) && player.sourceKey === sourceKey && player.queue.length > 0
  // Radio: listen er selve køen (uden de numre, brugeren selv har lagt i køen). Alle andre lister viser
  // deres egne numre. Hver række husker sin plads (i køen for radioen, ellers i listen).
  const live = active && followQueue
  const entries = live
    ? player.queue.map((track, queueIndex) => ({ track, queueIndex })).filter((entry) => !entry.track.queued)
    : tracks.map((track, queueIndex) => ({ track, queueIndex }))
  const options = { sourceKey, loop, onNeedMore }

  // Radio: start af sig selv, én gang pr. kilde — og lad en liste, der allerede spiller, være i fred
  useEffect(() => {
    if (!autoStart || !sourceKey || tracks.length === 0 || active) return
    if (autoStartedRef.current === sourceKey) return
    autoStartedRef.current = sourceKey
    player.playQueue(tracks, startIndex, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, sourceKey, tracks.length, active])

  // Rul den valgte række i syne, én gang ved indlæsning (fx når man åbner et delt link til et nummer)
  useEffect(() => {
    startRowRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Et tryk på en række. Følger listen køen (radio), springes der til rækkens plads i køen. Ellers springes
  // der til nummeret i køen, hvis det stadig ligger der; er det fjernet, startes listen forfra herfra.
  function handleRow(entry) {
    if (live) {
      player.playIndex(entry.queueIndex)
      return
    }
    if (active) {
      const inQueue = player.queue.findIndex((item) => item.id === entry.track.id && !item.queued)
      if (inQueue >= 0) {
        player.playIndex(inQueue)
        return
      }
    }
    player.playQueue(tracks, entry.queueIndex, options)
  }

  if (entries.length === 0) return <p className="notice">{emptyMessage || t('player.empty')}</p>

  return (
    <div>
      {!active && (
        <button className="btn" type="button" style={{ marginBottom: 14 }} onClick={() => handleRow({ track: tracks[startIndex], queueIndex: startIndex })}>
          {t('common.play')}
        </button>
      )}
      {active && player.needsTap && (
        <button className="btn" type="button" style={{ marginBottom: 14, display: 'block' }} onClick={player.play}>
          {t('player.tapToStart')}
        </button>
      )}
      <div>
        {entries.map((entry) => {
          const { track: row, queueIndex } = entry
          // Radio: det nummer, køen er nået til. Ellers: nummeret, hvis det er det, der spiller
          const isCurrent = live ? queueIndex === player.index : Boolean(player.current) && player.current.id === row.id
          return (
            <div
              key={`${row.id}-${queueIndex}`}
              className="track-row tl-row"
              style={{
                cursor: 'pointer',
                background: isCurrent ? 'var(--surface)' : undefined,
                borderRadius: 4,
              }}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => handleRow(entry)}
              ref={queueIndex === startIndex ? startRowRef : null}
            >
              <div className="ttitle" style={isCurrent ? { color: 'var(--accent)' } : undefined}>
                {row.title}
                {row.artistName && <div className="notice">{row.artistName}</div>}
              </div>
              {renderActions && (
                <div className="tl-actions" onClick={(e) => e.stopPropagation()}>
                  {renderActions(row)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
