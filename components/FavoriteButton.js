'use client'
import { useLanguage } from './LanguageProvider'
import { useFavorites } from './FavoritesProvider'

// Hjerte ved et nummer. Vises kun, når man er logget ind. Et tryk her skifter ikke nummer eller afspilning.
export default function FavoriteButton({ trackId, title, className = '' }) {
  const { t } = useLanguage()
  const { loggedIn, isFavorite, toggle } = useFavorites()
  if (!loggedIn || !trackId) return null
  const on = isFavorite(trackId)
  return (
    <button
      type="button"
      className={`fav-btn${on ? ' on' : ''} ${className}`.trim()}
      aria-pressed={on}
      aria-label={t(on ? 'favorites.remove' : 'favorites.add', { title })}
      title={t(on ? 'favorites.removeShort' : 'favorites.addShort')}
      onClick={(event) => {
        event.stopPropagation()
        toggle(trackId)
      }}
    >
      <svg viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.3 3.3 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
      </svg>
    </button>
  )
}
