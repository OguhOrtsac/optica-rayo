import { ImageResponse } from 'next/og'

// Configuration for size and type of the generated dynamic PNG
export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

/**
 * Renders a 512x512 PNG Apple Home Screen icon on the fly.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: '260px',
          background: 'linear-gradient(to bottom right, #020617, #0f172a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '110px',
          border: '10px solid #22d3ee', // Cyan border
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
