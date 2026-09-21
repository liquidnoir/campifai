import './globals.css'
import Nav from '../components/Nav'
import AuthGate from '../components/AuthGate'

export const metadata = {
  title: 'Rille',
  description: 'Musik direkte fra kunstneren til dig',
}

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Space+Grotesk:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main className="wrap">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  )
}
