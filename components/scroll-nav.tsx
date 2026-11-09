'use client'

import { useEffect } from 'react'

/**
 * Toggles `data-nav-scrolled` on <html> so the sticky navigation
 * (.site-nav in globals.css) gains a deeper shadow once the visitor
 * scrolls past a few pixels. Renders nothing.
 */
export default function ScrollNavEffect() {
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.dataset.navScrolled =
        window.scrollY > 8 ? 'true' : 'false'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      delete document.documentElement.dataset.navScrolled
    }
  }, [])

  return null
}
