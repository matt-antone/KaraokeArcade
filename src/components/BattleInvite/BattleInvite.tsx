import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import alertCue from 'lib/alertCue'
import useNow from 'lib/useNow'
import { formatDuration } from 'lib/dateTime'
import BattleFrame from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import {
  BATTLE_STAGE_PLATE,
  battleSingerKeyArt,
  battleSingerOrDefault,
  battleSingerStage,
} from 'lib/battleSingers'
import { acceptBattle, declineBattle } from 'store/modules/battle'
import type { BattleInvite as Invite } from 'shared/types'
import styles from './BattleInvite.css'

/**
 * The opponent's phone: somebody has picked you, and the offer has a clock on
 * it. Arcade Flow v2 13b.
 *
 * One screen. Accept goes straight to the library to pick the song the
 * challenger sings; Decline goes back to songs and the challenger is told.
 * There is no way to put this down unanswered: the clock is the only thing
 * that ends it without an answer, and when it runs out the ask simply goes.
 *
 * The song arrives with the invite because it is half of what is being agreed
 * to — "do you want to battle" and "singing this" are one decision.
 */

/** The challenger's own room behind them. Most fighters ship no
 *  location.png, so the 404 is the ordinary path to the dive bar. */
const StageArt = ({ src, className }: { src: string, className: string }) => {
  const [isMissing, setIsMissing] = useState(false)

  return (
    <img
      key={src}
      className={className}
      src={isMissing ? BATTLE_STAGE_PLATE : src}
      alt=''
      onError={() => setIsMissing(true)}
    />
  )
}

const BattleInvite = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const now = useNow()
  const userId = useAppSelector(state => state.user.userId)
  const invite = useAppSelector(state => state.battle.invite)
  const avatarId = useAppSelector(state => state.user.avatarId)
  const duration = useAppSelector(state => (invite ? state.songs.entities[invite.songId]?.duration : undefined))
  /* The invite this phone has already answered. Accepting is not applied
     locally (see the battle reducer), so the ask would otherwise sit there
     until the server's reply lands. */
  const [answered, setAnswered] = useState<Invite | null>(null)

  const msLeft = Math.max(0, (invite?.expiresAt ?? 0) - now)
  const isAsking = !!invite && invite.opponentUserId === userId && !invite.isAccepted
    && answered !== invite && msLeft > 0

  // A challenge arrives on a phone that is face down as often as not.
  useEffect(() => {
    if (isAsking) alertCue()
  }, [isAsking])

  if (!isAsking) return null

  const challenger = invite.challengerName
  const theirs = battleSingerOrDefault(invite.challengerSingerId)

  const handleAccept = () => {
    // the fighter rides the acceptance, off the account
    dispatch(acceptBattle(battleSingerOrDefault(avatarId).id))
    setAnswered(invite)
    navigate('/library')
  }

  const handleDecline = () => {
    dispatch(declineBattle())
    navigate('/library')
  }

  return (
    <BattleFrame bar='green'>
      <div className={styles.topRow}>
        <div className={styles.incoming}>
          <i className={styles.incomingDot} />
          <span>Incoming</span>
        </div>
        <span className={styles.clock}>{formatDuration(Math.ceil(msLeft / 1000))}</span>
      </div>

      <div className={styles.hero}>
        <StageArt className={styles.heroRoom} src={battleSingerStage(theirs)} />
        <img className={styles.heroArt} src={battleSingerKeyArt(theirs).url} alt='' />
        <div className={styles.heroFade} />
        <div className={styles.heroText}>
          <span className={styles.chip}>Challenger</span>
          <span className={styles.challenger} translate='no'>{challenger}</span>
          <span className={styles.wants}>wants a battle</span>
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.legend}>{'You\'ll sing'}</span>
        <span className={styles.title} translate='no'>{invite.title}</span>
        <span className={styles.meta} translate='no'>
          {duration ? `${invite.artist} · ${formatDuration(Math.round(duration))}` : invite.artist}
        </span>
        <span className={styles.pickedBy} translate='no'>{`Picked by ${challenger}`}</span>
      </div>

      <div className={styles.stakes}>
        <span className={styles.stakeWin}>Win +1000</span>
        <span className={styles.stakePlay}>Play +250</span>
      </div>

      <div className={styles.gap} />

      <div className={styles.footer}>
        <div className={styles.keys}>
          <BattleKey tone='green' className={styles.accept} onClick={handleAccept}>Accept</BattleKey>
          <BattleKey variant='ghost' className={styles.decline} onClick={handleDecline}>Decline</BattleKey>
        </div>
        <span className={styles.caption} translate='no'>{`Next · you pick the song ${challenger} sings`}</span>
      </div>
    </BattleFrame>
  )
}

export default BattleInvite
