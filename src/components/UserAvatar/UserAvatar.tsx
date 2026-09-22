import React, { useState } from 'react'
import clsx from 'clsx'
import Icon from 'components/Icon/Icon'
import { battleSingerOrDefault, battleSingerPortrait } from 'lib/battleSingers'
import styles from './UserAvatar.css'

/**
 * Somebody's face, anywhere in the app that names a person.
 *
 * The avatar is a fighter from the Singer Battle roster, so this takes a
 * roster id and nothing else: the id is the whole contract on the wire, the
 * art is client-side, and every surface that knows who somebody is already has
 * the id on the payload it is rendering.
 *
 * An id that is missing, empty or unknown is not an error state. A client can
 * hold an id for a group it has no art for — a room switching a group off
 * affects picking, never drawing — and an account that predates the column has
 * no id at all. battleSingerOrDefault answers both with the first playable
 * fighter, and a 404 on the portrait itself falls back to the glyph, which is
 * the same bargain the uploaded photo made.
 */
interface UserAvatarProps {
  className?: string
  /** A roster id: a legacy `p1`–`p8`, or `group/slug`. */
  avatarId: string | null | undefined
  /** Which cut of the head crop to draw. 34 for a row or a grid tile, 80 for a
   *  hero slot or a versus plate; asking for the small one where the big one
   *  belongs is a blurry fighter, not a broken one. */
  size?: 34 | 80
}

const UserAvatarContent = ({ avatarId, size }: { avatarId: string | null | undefined, size: 34 | 80 }) => {
  const [isErrored, setIsErrored] = useState(false)
  const singer = battleSingerOrDefault(avatarId)

  if (isErrored) return <Icon icon='PERSON' />

  return (
    <img
      src={battleSingerPortrait(singer, size)}
      alt=''
      onError={() => setIsErrored(true)}
    />
  )
}

const UserAvatar = ({ className, avatarId, size = 34 }: UserAvatarProps) => (
  <div className={clsx(styles.container, className)}>
    {/* keyed so a changed avatar re-tries a portrait the last one 404'd on */}
    <UserAvatarContent key={avatarId ?? ''} avatarId={avatarId} size={size} />
  </div>
)

export default UserAvatar
