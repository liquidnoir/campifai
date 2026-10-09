'use client'

// Rolige pladsholdere med samme størrelse som indholdet, så siden ikke hopper, når data kommer.
// Skjult for skærmlæsere (aria-hidden); siden har selv en synlig tekst, når noget fejler.
export function SkeletonBlock({ width = '100%', height = 14, radius = 3, style }) {
  return <div className="skel" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />
}

// Forsidens rist af udgivelser
export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skel cover-skel" aria-hidden="true" />
          <SkeletonBlock width="70%" style={{ marginTop: 10 }} />
          <SkeletonBlock width="45%" height={11} style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  )
}

// Rækker som numre og kunstnere
export function ListSkeleton({ count = 5 }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="track-row" aria-hidden="true">
          <div className="skel" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SkeletonBlock width={`${50 + ((i * 17) % 35)}%`} />
            <SkeletonBlock width="30%" height={11} style={{ marginTop: 7 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Udgivelses- og kunstnersiden: cover + overskrift + numre
export function PageSkeleton({ rows = 5 }) {
  return (
    <section aria-busy="true">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="skel" aria-hidden="true" style={{ width: 200, height: 200, borderRadius: 3, flexShrink: 0 }} />
        <div style={{ flex: '1 1 200px' }}>
          <SkeletonBlock width={60} height={12} />
          <SkeletonBlock width="60%" height={26} style={{ marginTop: 10 }} />
          <SkeletonBlock width="35%" style={{ marginTop: 12 }} />
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <ListSkeleton count={rows} />
      </div>
    </section>
  )
}

// Kunstnersiden: rund avatar + navn + rist af udgivelser
export function ArtistSkeleton() {
  return (
    <section aria-busy="true">
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="skel" aria-hidden="true" style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: '1 1 200px' }}>
          <SkeletonBlock width="45%" height={26} />
          <SkeletonBlock width="30%" style={{ marginTop: 12 }} />
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <GridSkeleton count={3} />
      </div>
    </section>
  )
}
