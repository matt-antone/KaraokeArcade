import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Modal from 'components/Modal/Modal'
import UserImage from 'components/UserImage/UserImage'
import alertCue from 'lib/alertCue'
import useBattleStage from 'lib/useBattleStage'
import { castBattleVote } from 'store/modules/battle'
import type { BattleSide, BattleTurn } from 'shared/types'
import styles from './BattleBallot.css'

/**
 * The ballot, on a phone.
 *
 * A room decides a battle one of two ways. The microphone can only be heard by
 * the machine the player is open on, which in most rooms is nobody's — so the
 * default is this: everybody votes on the thing already in their hand.
 *
 * Silent in both directions. Nobody is told who voted for whom, and nobody —
 * including the room, on the TV — sees the count until the verdict. A tally
 * that fills in public collects the undecided behind whoever is ahead, which
 * is a vote about who was quickest rather than about who sang. The only
 * confirmation a voter gets is their own key, which is confirmation enough.
 *
 * The two fighters get the panel too, and no keys. They are in the room with
 * their phones like everybody else, and a silent ballot is exactly where
 * voting for yourself would never be seen.
 */

const side = (turn: BattleTurn, at: BattleSide) => (at === 1
  ? { userId: turn.challengerUserId, dateUpdated: turn.challengerDateUpdated, name: turn.challengerName, song: turn.challengerSong }
  : { userId: turn.opponentUserId, dateUpdated: turn.opponentDateUpdated, name: turn.opponentName, song: turn.opponentSong })

const BattleBallot = () => {
  const dispatch = useAppDispatch()
  const { turn, phase, msLeft } = useBattleStage()
  const userId = useAppSelector(state => state.user.userId)
  const vote = useAppSelector(state => state.battle.vote)
  const [dismissedQueueId, setDismissedQueueId] = useState<number | null>(null)

  const isOpen = phase === 'ballot' && !!turn && dismissedQueueId !== turn.queueId

  // the panel arriving is the only notice a guest gets, and it arrives on a
  // phone that is face down as often as not
  useEffect(() => {
    if (isOpen) alertCue()
  }, [isOpen])

  if (!turn || !isOpen) return null

  const isFighting = userId === turn.challengerUserId || userId === turn.opponentUserId
  const chosen = vote?.queueId === turn.queueId ? vote.side : null

  return (
    <Modal
      className={styles.modal}
      title='Who wins'
      onClose={() => setDismissedQueueId(turn.queueId)}
    >
      <div className={styles.clock}>{Math.ceil(msLeft / 1000)}</div>

      {isFighting
        ? <p className={styles.fine}>You&rsquo;re in this one. The room decides it.</p>
        : (
            <>
              <div className={styles.keys}>
                {([1, 2] as BattleSide[]).map((at) => {
                  const fighter = side(turn, at)

                  return (
                    <button
                      key={at}
                      type='button'
                      className={clsx(styles.key, at === 1 ? styles.sideOne : styles.sideTwo, chosen === at && styles.chosen)}
                      aria-pressed={chosen === at}
                      onClick={() => dispatch(castBattleVote(turn.queueId, at))}
                    >
                      <UserImage
                        className={styles.avatar}
                        userId={fighter.userId}
                        dateUpdated={fighter.dateUpdated}
                      />
                      <span className={styles.who}>
                        <span className={styles.name} translate='no'>{fighter.name}</span>
                        <span className={styles.song} translate='no'>{fighter.song.title}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <p className={styles.fine}>
                {chosen
                  // changing your mind is a tap, because the alternative is a
                  // dead panel for the rest of the beat and a fat thumb is not
                  // a decision
                  ? 'Counted. Tap the other to change it.'
                  : 'Nobody sees this but the scoreboard.'}
              </p>
            </>
          )}
    </Modal>
  )
}

export default BattleBallot
