import React, { useState } from 'react'
import clsx from 'clsx'
import SpriteLoop from 'components/SpriteLoop/SpriteLoop'
import { BATTLE_STAGE_PLATE, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import styles from './QueueHeader.css'

export interface NowSingingProps {
  /** Nothing on stage: the empty banner. */
  isEmpty?: boolean
  /** Roster id of whoever is on, for their location and their figure. */
  avatarId?: string | null
  singer?: string
  title?: string
  artist?: string
}

/**
 * The stage, at a glance: whoever is singing, singing on their own location
 * with the song beside them. An empty stage says so instead of vanishing, so
 * the header keeps its height and the list under it does not jump when the
 * first song starts.
 */
const NowSinging = ({ isEmpty, avatarId, singer, title, artist }: NowSingingProps) => {
  const who = battleSingerOrDefault(avatarId)
  const [isPlateMissing, setPlateMissing] = useState(false)

  if (isEmpty) {
    return (
      <div className={clsx(styles.banner, styles.bannerEmpty)}>
        <span className={styles.emptyLegend}>Now singing</span>
        <span className={styles.stageOpen}>Stage is open</span>
      </div>
    )
  }

  return (
    <div className={styles.banner}>
      {/* keyed so the next singer re-tries a location the last one 404'd on */}
      <img
        key={who.id}
        className={styles.location}
        src={isPlateMissing ? BATTLE_STAGE_PLATE : battleSingerStage(who)}
        onError={() => setPlateMissing(true)}
        alt=''
      />
      <div className={styles.scrim} />
      <SpriteLoop singer={who} loop='sing' size='168px' facing='left' className={styles.figure} />
      <div className={styles.now} translate='no'>
        <span className={styles.nowLegend}>Now singing</span>
        <span className={styles.nowName}>{singer}</span>
        {title && <span className={styles.nowTitle}>{title}</span>}
        {artist && <span className={styles.nowArtist}>{artist}</span>}
      </div>
    </div>
  )
}

export default NowSinging
