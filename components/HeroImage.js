'use client'
import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { imagePublicUrl } from '../lib/shared'

const DEFAULT_IMAGE = '/hero-mushrooms.jpg'

// Forsidebilledet.
//
// Billedet vælges først, når indstillingerne er hentet (settings er null, mens de hentes). Ellers ville
// standardbilledet blive vist et øjeblik, før det billede, admin har uploadet, dukker op. Imens vises
// en rolig flade i samme format som standardbilledet (3:2), og billedet toner blødt ind, når det er indlæst.
//
//   settings: indstillingerne fra getAppSettings, eller null, mens de hentes
export default function HeroImage({ settings }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // Et billede, der allerede ligger i browserens hukommelse, er færdigt, før onLoad når at høre det
  const imageRef = useCallback((element) => {
    if (element && element.complete && element.naturalWidth > 0) setLoaded(true)
  }, [])

  const customUrl = settings?.heroImagePath ? imagePublicUrl(supabase, settings.heroImagePath) : null
  // Kan det uploadede billede ikke hentes (fx slettet), bruges standardbilledet
  const src = settings === null ? null : customUrl && !failed ? customUrl : DEFAULT_IMAGE

  return (
    <div className={`hero-art${loaded ? '' : ' hero-art-loading'}`}>
      {src && (
        <img
          key={src}
          ref={imageRef}
          src={src}
          alt=""
          fetchPriority="high"
          className={`hero-img${loaded ? ' loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (src !== DEFAULT_IMAGE) setFailed(true)
          }}
        />
      )}
    </div>
  )
}
