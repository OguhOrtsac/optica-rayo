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
    background_color: '#ffffff', // blanco: el logo oficial va sobre fondo blanco
    theme_color: '#00357f', // azul de marca Óptica Rayo (antes un cyan genérico)
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
  }
}
