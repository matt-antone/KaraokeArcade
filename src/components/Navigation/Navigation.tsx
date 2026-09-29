import React from 'react'
import clsx from 'clsx'
import { NavLink } from 'react-router'
import { useAppSelector } from 'store/hooks'
import styles from './Navigation.css'

/**
 * The bottom tab bar. There is no Player entry: the player is a room fixture
 * the host sets up once, and everything about it lives in Settings > Player.
 * Icons are the arcade pixel glyphs, painted through a mask so they take the
 * tab's colour.
 */
const NAV = [
  { to: '/library', icon: 'songs', label: 'Songs', adminOnly: false },
  { to: '/queue', icon: 'queue', label: 'Queue', adminOnly: false },
  { to: '/account', icon: 'me', label: 'Me', adminOnly: false },
  { to: '/leaderboard', icon: 'scores', label: 'Scores', adminOnly: false },
  { to: '/settings', icon: 'admin', label: 'Admin', adminOnly: true },
] as const

const Navigation = () => {
  const isAdmin = useAppSelector(state => state.user.isAdmin)

  return (
    <div className={styles.container}>
      {NAV.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ to, icon, label }) => {
        // relative, so it follows <base href> like every other asset URL
        const mask = `url(assets/arcade/icons/${icon}.svg)`

        return (
          <NavLink
            key={to}
            to={to}
            replace
            aria-label={label}
            className={({ isActive }) => clsx(isActive && styles.active)}
          >
            <span className={styles.icon} style={{ maskImage: mask, WebkitMaskImage: mask }} />
          </NavLink>
        )
      })}
    </div>
  )
}

export default Navigation
