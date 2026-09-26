export default function manifest() {
  return {
    name: 'Campifai',
    short_name: 'Campifai',
    description: 'Music straight from the artist to you',
    start_url: '/',
    display: 'standalone',
    background_color: '#161310',
    theme_color: '#161310',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
