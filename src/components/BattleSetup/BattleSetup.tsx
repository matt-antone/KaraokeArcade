import React, { useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import BattleFrame, { BattleClock } from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import { battleSingerOrDefault, battleSingerPortrait } from 'lib/battleSingers'
import { nightPointsByUser } from 'store/selectors/points'
import { cancelBattle, requestBattleSingers, startBattlePick } from 'store/modules/battle'
import type { BattleInvite } from 'shared/types'
import styles from './BattleSetup.css'

/**
 * The challenger's phone, from pressing the Battle key to the answer coming
 * back. Arcade Flow v2 2d:
 *
 *     13a  pick your opponent -> the library, to pick their song
 *     13a2 challenge sent, waiting on them (the invite is in the store)
 *     13a3 no contest: they passed, or the clock ran out
 *
 * Nothing leaves this device on 13a: the opponent and the fighter ride into
 * the library's pick mode, and the challenge is thrown there, with the song.
 * An accepted challenge needs no screen of its own — the challenger goes back
 * to their songs and the battle comes to the TV.
 */

interface BattleSetupProps {
  /** The Battle key has been pressed and this has not been dismissed. */
  isOpen: boolean
  /** What came back from the other phone, once it has. A lapsed invite and a
   *  declined one draw the same 13a3. */
  outcome?: 'accepted' | 'declined' | 'timeout' | null
  /** Dismissed, or handed off to the library. */
  onClose: () => void
}

const BattleSetup = ({ isOpen, outcome = null, onClose }: BattleSetupProps) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const userId = useAppSelector(state => state.user.userId)
  const avatarId = useAppSelector(state => state.user.avatarId)
  const room = useAppSelector(state => state.battle.singers)
  const invite = useAppSelector(state => state.battle.invite)
  const nightPoints = useAppSelector(nightPointsByUser)

  const [oppUserId, setOppUserId] = useState<number | null>(null)
  const [isOutcomeSeen, setIsOutcomeSeen] = useState(false)
  /* Pick someone else reopens 13a after the Battle key has long let go of it. */
  const [isRetrying, setIsRetrying] = useState(false)

  /* The challenge this phone threw, kept past the store letting go of it:
     13a3 names who passed, and by then the invite is gone. Adjusted during
     render, React's own pattern for this. */
  const thrown = invite && invite.challengerUserId === userId ? invite : null
  const [sent, setSent] = useState<BattleInvite | null>(thrown)
  if (thrown && thrown !== sent) setSent(thrown)

  /* A fresh answer is a fresh screen, and pressing the Battle key starts a
     new pick rather than the one abandoned three songs ago. */
  const [seen, setSeen] = useState({ outcome, isOpen })
  if (seen.outcome !== outcome || seen.isOpen !== isOpen) {
    setSeen({ outcome, isOpen })
    if (seen.outcome !== outcome) setIsOutcomeSeen(false)
    if (seen.isOpen !== isOpen && isOpen) {
      setOppUserId(null)
      setIsRetrying(false)
    }
  }

  const singer = battleSingerOrDefault(avatarId)
  const opponent = room.find(s => s.userId === oppUserId) ?? null

  const close = () => {
    setIsRetrying(false)
    setIsOutcomeSeen(true)
    onClose()
  }

  const backToSongs = () => {
    close()
    navigate('/library')
  }

  const handleNext = () => {
    if (!opponent) return
    // The fighter still has to reach the BATTLE_CHALLENGE the library sends
    // after the song is picked; it comes off the account.
    dispatch(startBattlePick(opponent, singer.id))
    navigate('/library')
    close()
  }

  const handleRetry = () => {
    dispatch(requestBattleSingers())
    setIsOutcomeSeen(true)
    setIsRetrying(true)
    setOppUserId(null)
  }

  const handleCancel = () => {
    dispatch(cancelBattle())
    navigate('/library')
  }

  const ending = (outcome === 'declined' || outcome === 'timeout') && !isOutcomeSeen
  const isWaiting = !!thrown && !thrown.isAccepted

  /* 13a3 · no contest. One screen for a no and for no answer: the copy
     covers both. */
  if (ending) {
    return (
      <BattleFrame bar='grey' status='Declined' statusTone='red'>
        <div className={styles.centre}>
          <span className={clsx(styles.headline, styles.noContest)}>
            NO
            <br />
            CONTEST
          </span>
          <span className={styles.body}>
            <span translate='no'>{sent?.opponentName ?? 'They'}</span>
            {' passed on this one. Challenges expire after 30 seconds without an answer.'}
          </span>
        </div>
        <div className={styles.footer}>
          <BattleKey onClick={handleRetry}>Pick someone else</BattleKey>
          <BattleKey variant='ghost' onClick={backToSongs}>Back to songs</BattleKey>
        </div>
      </BattleFrame>
    )
  }

  /* 13a2 · challenge sent, the other phone is being asked. */
  if (isWaiting) {
    return (
      <BattleFrame bar='gold' status='Sent' statusTone='mint'>
        <div className={styles.centre}>
          <span className={clsx(styles.headline, styles.sent)}>
            CHALLENGE
            <br />
            SENT
          </span>
          <div className={styles.vsRow}>
            <div className={clsx(styles.plate, styles.plateOne)}>
              <img src={battleSingerPortrait(battleSingerOrDefault(thrown.challengerSingerId), 80)} alt='' />
            </div>
            <span className={styles.vs}>VS</span>
            <div className={clsx(styles.plate, styles.plateTwo)}>
              <img
                className={styles.plateWaiting}
                src={battleSingerPortrait(battleSingerOrDefault(thrown.opponentAvatarId), 80)}
                alt=''
              />
            </div>
          </div>
          <span className={styles.waiting} translate='no'>{`Waiting for ${thrown.opponentName}`}</span>
          <BattleClock className={styles.clock} endsAt={thrown.expiresAt} />
        </div>
        <div className={styles.footer}>
          <BattleKey variant='ghost' onClick={handleCancel}>Cancel challenge</BattleKey>
        </div>
      </BattleFrame>
    )
  }

  if (!isOpen && !isRetrying) return null

  /* 13a · everyone checked into the venue tonight, and nothing else. */
  return (
    <BattleFrame bar='gold'>
      <div className={styles.header}>
        <div className={styles.wordmarks}>
          <span className={styles.eyebrow}>Singer battle</span>
          <span className={styles.wordmark}>BATTLE</span>
        </div>
        <div className={styles.pips}>
          <i className={clsx(styles.pip, styles.pipOn)} />
          <i className={styles.pip} />
          <i className={styles.pip} />
        </div>
      </div>

      <div className={styles.titleBlock}>
        <span className={styles.title}>Pick your opponent</span>
        <span className={styles.lede}>You pick the song they sing. They pick yours.</span>
      </div>

      <div className={styles.hereRow}>
        <i className={styles.hereDot} />
        <span className={styles.here}>Here now</span>
        <span className={styles.hereCount}>{room.length}</span>
      </div>

      <div className={styles.rows}>
        {room.map(person => (
          <button
            key={person.userId}
            type='button'
            aria-pressed={person.userId === oppUserId}
            className={clsx(styles.row, person.userId === oppUserId && styles.rowOn)}
            onClick={() => setOppUserId(person.userId)}
          >
            <span className={styles.avatar}>
              <img src={battleSingerPortrait(battleSingerOrDefault(person.avatarId), 80)} alt='' />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowName} translate='no'>{person.name}</span>
              <span className={styles.rowPoints}>{`Tonight ${nightPoints[person.userId] ?? 0}`}</span>
            </span>
            <span className={styles.rowMark}>{person.userId === oppUserId ? '✓' : ''}</span>
          </button>
        ))}

        {/* undesigned: an empty room still has to say why nothing is here */}
        {room.length === 0 && (
          <span className={styles.empty}>Nobody else is here yet. A battle needs two.</span>
        )}
      </div>

      {/* One key, as 13a draws it. An empty room (undesigned) has nobody to
          pick, so its one key is the way back out instead. */}
      <div className={clsx(styles.footer, styles.footerPick)}>
        {room.length === 0
          ? <BattleKey onClick={backToSongs}>Back to songs</BattleKey>
          : <BattleKey disabled={!opponent} onClick={handleNext}>Next · pick their song</BattleKey>}
      </div>
    </BattleFrame>
  )
}

export default BattleSetup
