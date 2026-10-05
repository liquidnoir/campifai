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
//   renderActions: valgfri, ekstra knapper i hver rækkes højre side (klik her skifter ikke nummer)
export default function TrackList({
  tracks,
  startIndex = 0,
  sourceKey = '',
  loop = false,
  onNeedMore,
  autoStart = false,
  emptyMessage,
  renderActions,
}) {
  const { t } = useLanguage()
  const player = usePlayer()
  const startRowRef = useRef(null)
  const autoStartedRef = useRef('')

  // Er det netop denne liste, der spiller?
  const active = Boolean(sourceKey) && player.sourceKey === sourceKey && player.queue.length > 0
  const rows = active ? player.queue : tracks
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

  function handleRow(i) {
    if (active) player.playIndex(i)
    else player.playQueue(tracks, i, options)
  }

  if (rows.length === 0) return <p className="notice">{emptyMessage || t('player.empty')}</p>

  return (
    <div>
      {!active && (
        <button className="btn" type="button" style={{ marginBottom: 14 }} onClick={() => handleRow(startIndex)}>
          {t('common.play')}
        </button>
      )}
      {active && player.needsTap && (
        <button className="btn" type="button" style={{ marginBottom: 14, display: 'block' }} onClick={player.play}>
          {t('player.tapToStart')}
        </button>
      )}
      <div>
        {rows.map((row, i) => {
          const isCurrent = active && i === player.index
          return (
            <div
              key={`${row.id}-${i}`}
              className="track-row"
              style={{
                cursor: 'pointer',
                background: isCurrent ? 'var(--surface)' : undefined,
                borderRadius: 4,
              }}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => handleRow(i)}
              ref={i === startIndex ? startRowRef : null}
            >
              <div className="ttitle" style={isCurrent ? { color: 'var(--accent)' } : undefined}>
                {row.title}
                {row.artistName && <div className="notice">{row.artistName}</div>}
              </div>
              {renderActions && (
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
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
