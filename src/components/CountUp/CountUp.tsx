import React, { useEffect, useState } from 'react'

interface CountUpProps {
  from: number
  to: number
  /** ms before the count starts. */
  delay?: number
  /** ms the count takes. */
  duration?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * A number rolling from `from` to `to`, ease-out cubic, printed as a raw
 * integer (the design's CountUp: 12d, 13i). Reduced motion lands on `to`.
 */
const CountUp = ({ from, to, delay = 1300, duration = 1400, className, style }: CountUpProps) => {
  const [count, setCount] = useState({ from, to, value: from })

  // a new pair starts over from its own `from`
  if (count.from !== from || count.to !== to) setCount({ from, to, value: from })

  useEffect(() => {
    const set = (value: number) => setCount({ from, to, value })
    let raf = 0

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      raf = requestAnimationFrame(() => set(to))
      return () => cancelAnimationFrame(raf)
    }

    const timer = setTimeout(() => {
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / duration)
        set(Math.round(from + (to - from) * (1 - (1 - k) ** 3)))
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [from, to, delay, duration])

  return <span className={className} style={style}>{count.value}</span>
}

export default CountUp
