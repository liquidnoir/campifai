import './globals.css'
import { Fraunces, Space_Grotesk } from 'next/font/google'
import Nav from '../components/Nav'
import AuthGate from '../components/AuthGate'
import Footer from '../components/Footer'
import TabBar from '../components/TabBar'
import MiniPlayer from '../components/MiniPlayer'
import { PlayerProvider } from '../components/PlayerProvider'
import { STANDALONE_SCRIPT } from '../lib/tabs'
import { LanguageProvider } from '../components/LanguageProvider'
import { ConfirmProvider } from '../components/ConfirmProvider'
import SkipLink from '../components/SkipLink'

// Skrifttyperne hentes, når siden bygges, og leveres derefter fra vores egen server —
// ikke fra Google. Så sendes besøgendes IP-adresser ikke til Google.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], display: 'swap', variable: '--font-fraunces' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

export const metadata = {
  title: 'We Built Other',
  description: 'Music straight from the artist to you',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'We Built Other',
  },
}

export const viewport = {
  themeColor: '#161310',
  // Siden bruger hele skærmen (også under statuslinjen og hjemmeindikatoren). Stilarket holder
  // indholdet fri af dem med env(safe-area-inset-*). Uden dette er alle de værdier 0.
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Sætter klassen "standalone" på <html>, når siden kører som installeret app */}
        <script dangerouslySetInnerHTML={{ __html: STANDALONE_SCRIPT }} />
      </head>
      <body>
        <LanguageProvider>
          <ConfirmProvider>
            {/* Afspilleren ligger her, uden for siderne, så musikken fortsætter, når man skifter side */}
            <PlayerProvider>
              <SkipLink />
              <Nav />
              <main className="wrap" id="main" tabIndex={-1}>
                <AuthGate>{children}</AuthGate>
              </main>
              <Footer />
              <MiniPlayer />
              <TabBar />
            </PlayerProvider>
          </ConfirmProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
