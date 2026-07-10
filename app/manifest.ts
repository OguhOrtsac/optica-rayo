import { MetadataRoute } from 'next'

/**
 * Web App Manifest.
 * Native Next.js App Router solution to serve a PWA manifest.json dynamically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Óptica Rayo',
    short_name: 'OpticaRayo',
    description: 'Sistema inteligente de óptica, inventario y fidelización de clientes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617', // slate-950
    theme_color: '#06b6d4', // cyan-500
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ],
  }
}
