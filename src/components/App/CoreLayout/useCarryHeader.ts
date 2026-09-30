import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Marks the element a route scrolls as its page, when that is not the
 *  document itself (a virtualized list, a view that sizes itself in JS). */
export const PAGE_SCROLL = { 'data-page-scroll': '' }

const setCarry = (y: number, header: HTMLElement | null) => {
  document.documentElement.style.setProperty('--header-scroll', `${Math.min(y, header?.offsetHeight ?? 0)}px`)
}

/**
 * Every route scrolls as one page. The phone is where this app lives, and on
 * one the HUD, the card under it and a route's tabs take most of the screen: a
 * list that scrolled in a window beneath them showed three rows at a time.
 *
 * The header stays position: fixed (the popovers, the up-next alert and the
 * measured --header-h all depend on it) and is carried up by exactly what the
 * page has scrolled, via --header-scroll, so the two move as one. The page is
 * the document, or an element marked PAGE_SCROLL; any other scroller (a modal's
 * list, a picker) leaves the header where it is. Listened for in the capture
 * phase because scroll does not bubble.
 */
export default function useCarryHeader (headerRef: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()

  useEffect(() => {
    const carry = (e: Event) => {
      const target = e.target

      if (target === document) setCarry(window.scrollY, headerRef.current)
      else if (target instanceof HTMLElement && target.dataset.pageScroll !== undefined) setCarry(target.scrollTop, headerRef.current)
    }

    document.addEventListener('scroll', carry, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', carry, { capture: true })
  }, [headerRef])

  // a new route arrives wherever the document already is; its own scroller
  // reports in as soon as it moves
  useEffect(() => {
    setCarry(window.scrollY, headerRef.current)
  }, [pathname, headerRef])
}
