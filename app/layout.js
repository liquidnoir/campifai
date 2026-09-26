import './globals.css'
import Nav from '../components/Nav'
import AuthGate from '../components/AuthGate'
import { LanguageProvider } from '../components/LanguageProvider'

export const metadata = {
  title: 'Campifai',
  description: 'Music straight from the artist to you',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Space+Grotesk:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>
          <Nav />
          <main className="wrap">
            <AuthGate>{children}</AuthGate>
          </main>
        </LanguageProvider>
      </body>
    </html>
  )
}
