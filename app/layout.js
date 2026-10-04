import './globals.css'
import { Fraunces, Space_Grotesk } from 'next/font/google'
import Nav from '../components/Nav'
import AuthGate from '../components/AuthGate'
import Footer from '../components/Footer'
import { LanguageProvider } from '../components/LanguageProvider'

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
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <LanguageProvider>
          <Nav />
          <main className="wrap">
            <AuthGate>{children}</AuthGate>
          </main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  )
}
