import { ImageResponse } from 'next/og'

// Configuration for size and type of the generated dynamic PNG
export const size = {
  width: 192,
  height: 192,
}
export const contentType = 'image/png'

/**
 * Renders a 192x192 PNG brand icon on the fly.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: '100px',
          background: 'linear-gradient(to bottom right, #020617, #0f172a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '42px',
          border: '4px solid #22d3ee', // Cyan border matching Rayo vibe
        }}
      >
        ⚡
      </div>
    ),
    {
      ...size,
    }
  )
}
