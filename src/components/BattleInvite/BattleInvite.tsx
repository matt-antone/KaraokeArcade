import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import alertCue from 'lib/alertCue'
import useNow from 'lib/useNow'
import BattleFrame from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import BattleSingerSelect from 'components/BattleStage/BattleSingerSelect'
import BattleSprite from 'components/BattleStage/BattleSprite'
import BattleVersus, { BattleSummary } from 'components/BattleStage/BattleVersus'
import useBattleIris, { BATTLE_TONE } from 'components/BattleStage/useBattleIris'
import { readLastBattleSinger, writeLastBattleSinger } from 'components/BattleStage/lastBattleSinger'
import {
  BATTLE_LOCKUP,
  BATTLE_SINGERS,
  battleSingerOrDefault,
} from 'lib/battleSingers'
import { acceptBattle, declineBattle } from 'store/modules/battle'
import type { BattleInvite as Invite } from 'shared/types'
import styles from './BattleInvite.css'

/**
 * The opponent's phone: somebody has picked you, and the offer has a clock on
 * it.
 *
 *     INVITE -> SINGER -> CONFIRM -> HANDOFF, off to pick their song
 *        |  \
 *        |   -> DECLINED
 *        -> TOO SLOW, on its own, at the expiry the server set
 *
 * There is no cancel in the header and no way to put this down half-answered.
 * Declining is a decision — the challenger is told, and their turn goes back
 * to them — where a dismissal would leave somebody waiting on an answer that
 * is never coming. The only thing that ends this screen without an answer is
 * the clock, and that is the point of the clock.
 *
 * The song arrives with the invite because it is half of what is being agreed
 * to: "do you want to battle" and "singing this" are one decision, and asking
 * the first without showing the second is asking somebody to sign a blank.
 */

type Step = 'invite' | 'singer' | 'confirm' | 'handoff' | 'declined' | 'timeout'

/** Whoever the challenger is singing as is spoken for, so a phone whose last
 *  singer was that one opens on somebody else rather than on a tile it is not
 *  allowed to keep. */
const openingSinger = (takenId: string): string => {
  const want = battleSingerOrDefault(readLastBattleSinger())
  if (want.id !== takenId) return want.id

  return BATTLE_SINGERS.find(s => s.id !== takenId)?.id ?? want.id
}

const BattleInvite = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const now = useNow()
  const userId = useAppSelector(state => state.user.userId)
  const handle = useAppSelector(state => state.user.name) ?? ''
  const invite = useAppSelector(state => state.battle.invite)

  /* The offer, kept after the store lets go of it.

     Declining clears the invite, and the screen that says it was declined has
     to outlive it: without a copy the answer replaces itself with nothing, and
     the phone appears to have dropped the challenge on the floor. Adjusted
     during render rather than in an effect, which is React's own pattern for
     this — an effect would paint the empty frame first. */
  const [offer, setOffer] = useState<Invite | null>(invite)
  const [step, setStep] = useState<Step>('invite')
  const [singerId, setSingerId] = useState(() => openingSinger(invite?.challengerSingerId ?? ''))
  const [isHandedOff, setIsHandedOff] = useState(false)
  /* Set on the tap that answers. Declining clears the invite from the store
     before the screen reporting it is up, and without this the frame reads as
     lapsed for the 170ms the iris is meant to be covering. */
  const [isAnswering, setIsAnswering] = useState(false)
  const { frameRef, iris, burst } = useBattleIris()

  if (invite && invite !== offer) {
    setOffer(invite)
    /* A second challenge is not the first one continuing: whoever this
       challenger is singing as may be somebody else entirely, and a selection
       left over from the last invite can be the tile this one has taken. */
    if (invite.challengerUserId !== offer?.challengerUserId) {
      setSingerId(openingSinger(invite.challengerSingerId))
      setStep('invite')
      setIsAnswering(false)
      setIsHandedOff(false)
    }
  }

  const isMine = !!offer && offer.opponentUserId === userId
  const isAsking = isMine && !!invite && !invite.isAccepted && step === 'invite'

  // A challenge arrives on a phone that is face down as often as not, and it
  // is the only thing in this feature with a clock somebody else started.
  useEffect(() => {
    if (isAsking) alertCue()
  }, [isAsking])

  const msLeft = Math.max(0, (offer?.expiresAt ?? 0) - now)

  if (!offer || !isMine) return null
  // Accepted and already handed over to the library, whose banner is the
  // surface from here. Also the reload case: an accepted invite must not put
  // the ask back up.
  if (offer.isAccepted && (step !== 'handoff' || isHandedOff)) return null

  /* The offer is off, either because its clock ran out or because the server
     took it back. Derived rather than stepped into: the clock is the server's
     and this only draws it, so there is no timer here to get out of step with
     the one that actually ends the invite. A challenge withdrawn by the
     challenger reads as the same thing from this side — the phone is not told
     which, and either way there is nothing left to answer. */
  const isPending = step === 'invite' || step === 'singer' || step === 'confirm'
  const shown: Step = isPending && !isAnswering && (msLeft === 0 || !invite) ? 'timeout' : step

  const challenger = offer.challengerName
  const theirs = battleSingerOrDefault(offer.challengerSingerId)
  const mine = battleSingerOrDefault(singerId)
  const song = `${offer.title} — ${offer.artist}`
  const seconds = Math.ceil(msLeft / 1000)
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} LEFT`

  const handleDecline = (e: React.MouseEvent<HTMLElement>) => {
    // Sent on the tap, not under the iris: the challenger is standing there
    // waiting, and an answer held for an animation timer is an answer a phone
    // that backgrounds itself never gives.
    setIsAnswering(true)
    dispatch(declineBattle())
    burst(e, BATTLE_TONE.quiet, () => setStep('declined'))
  }

  const handleConfirm = (e: React.MouseEvent<HTMLElement>) => {
    setIsAnswering(true)
    writeLastBattleSinger(singerId)
    // ASSUMED SIGNATURE: acceptBattle(singerId) — picking who you sing as is
    // part of accepting, and this is the only screen that knows it.
    dispatch(acceptBattle(singerId))
    burst(e, BATTLE_TONE.two, () => setStep('handoff'))
  }

  const handleBack = (e: React.MouseEvent<HTMLElement>) => burst(e, BATTLE_TONE.quiet, () => (
    setStep(was => (was === 'confirm' ? 'singer' : 'invite'))
  ))

  const done = shown === 'handoff' ? 3 : shown === 'confirm' ? 2 : shown === 'singer' ? 1 : 0

  /** INVITE · who it is from, what it would cost you, and how long you have. */
  const ask = (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.glow} />
      <div className={styles.hero}>
        <BattleSprite singer={theirs} className={styles.heroArt} />
      </div>

      <div className={styles.topRow}>
        <div className={styles.incomingDot} />
        <div className={styles.incoming}>INCOMING</div>
        <div className={clsx(styles.clock, seconds <= 10 && styles.clockUrgent)}>{clock}</div>
      </div>

      <img className={styles.lockup} src={BATTLE_LOCKUP} alt='Singer Battle' />

      <div className={styles.gap} />

      <div className={styles.challenger} translate='no'>{challenger}</div>

      <div className={styles.card}>
        <div className={styles.cardLegend}>YOU SING</div>
        <div className={styles.cardTitle} translate='no'>{song}</div>
        <div className={styles.cardMeta}>
          <div className={styles.cardBy} translate='no'>
            PICKED BY
            {challenger}
          </div>
          <div>2 MINUTE FORMAT</div>
        </div>
      </div>

      <div className={clsx(styles.footer, styles.footerStack)}>
        <div className={styles.terms}>ACCEPT AND YOU EACH PICK THE OTHER&rsquo;S SONG</div>
        <BattleKey onClick={e => burst(e, BATTLE_TONE.two, () => setStep('singer'))}>ACCEPT</BattleKey>
        <BattleKey variant='ghost' onClick={handleDecline}>DECLINE</BattleKey>
      </div>
    </div>
  )

  /** CONFIRM · the last look. Structurally the challenger's confirm, with the
   *  sides the other way round and their song in the list, because on this
   *  phone that is a fact rather than a choice. */
  const confirm = (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.masthead}>
        <div className={styles.title}>
          TAKE THE
          <br />
          BATTLE
        </div>
        <div className={styles.lede}>CONFIRM AND THE ROOM SEES IT</div>
      </div>

      <div className={styles.scroller}>
        <BattleVersus
          you={{
            label: 'YOU',
            handle,
            tint: 'two',
            plate: <BattleSprite singer={mine} isFlipped />,
          }}
          them={{
            label: 'CHALLENGER',
            handle: challenger,
            tint: 'one',
            plate: <BattleSprite singer={theirs} />,
          }}
        />

        <BattleSummary
          isWide
          rows={[
            {
              label: 'YOUR SINGER',
              value: mine.name,
              tint: 'two',
              onEdit: e => burst(e, BATTLE_TONE.quiet, () => setStep('singer')),
            },
            { label: 'THEIR SINGER', value: theirs.name, tint: 'one' },
            { label: 'YOU SING', value: song, tint: 'gold' },
            { label: 'FORMAT', value: '2 MINUTE FORMAT' },
          ]}
        />

        <div className={styles.closing}>
          NEXT UP &middot; YOU PICK THE SONG
          {' '}
          {challenger}
          {' '}
          HAS TO SING
        </div>
      </div>

      <div className={clsx(styles.footer, styles.footerStack)}>
        <BattleKey onClick={handleConfirm}>CONFIRM</BattleKey>
        <div className={styles.footerPair}>
          <BattleKey variant='ghost' onClick={handleBack}>BACK</BattleKey>
          <BattleKey variant='ghost' onClick={handleDecline}>DECLINE</BattleKey>
        </div>
      </div>
    </div>
  )

  /** HANDOFF · in, and owed a song. The key is gold rather than this phone's
   *  green because it is the product's own colour and what it opens is the
   *  library, which belongs to neither side of the fight. */
  const handoff = (
    <div className={styles.body}>
      <div className={styles.inHead}>YOU&rsquo;RE IN</div>
      <div className={styles.inPair} translate='no'>
        {handle}
        {' '}
        vs
        {' '}
        {challenger}
      </div>

      <div className={styles.inLockup}>
        <img className={styles.lockupLarge} src={BATTLE_LOCKUP} alt='Singer Battle' />
      </div>

      <div className={styles.footer}>
        <BattleKey
          tone='gold'
          onClick={e => burst(e, BATTLE_TONE.gold, () => {
            // the library is the next step of the same tap: its header is
            // already wearing the banner saying who this browse is for
            navigate('/library')
            setIsHandedOff(true)
          })}
        >
          PICK THEIR SONG
        </BattleKey>
      </div>
    </div>
  )

  /** DECLINED and TOO SLOW · one layout, because the difference between them
   *  is what happened to the other side, and that is the line underneath. */
  const ended = (
    <div className={styles.ended}>
      <img className={clsx(styles.lockup, styles.lockupSpent)} src={BATTLE_LOCKUP} alt='Singer Battle' />
      <div className={styles.endedTitle}>{shown === 'timeout' ? 'TOO SLOW' : 'DECLINED'}</div>
      <div className={styles.endedNote} translate='no'>
        {shown === 'timeout'
          ? `THE INVITE RAN OUT · ${challenger} MOVED ON`
          : `NO BATTLE SET · ${challenger} WAS TOLD`}
      </div>
    </div>
  )

  return (
    <BattleFrame
      variant='invite'
      title={shown === 'invite' ? 'CHALLENGE' : shown === 'singer' ? 'YOUR SINGER' : 'SINGER BATTLE'}
      pips={[done > 0, done > 1, done > 2]}
      iris={iris}
      frameRef={frameRef}
      onBack={shown === 'singer' || shown === 'confirm' ? handleBack : undefined}
    >
      {shown === 'invite' && ask}
      {shown === 'singer' && (
        <BattleSingerSelect
          selectedId={singerId}
          takenId={offer.challengerSingerId}
          onPick={id => setSingerId(id)}
          onNext={e => burst(e, BATTLE_TONE.two, () => setStep('confirm'))}
        />
      )}
      {shown === 'confirm' && confirm}
      {shown === 'handoff' && handoff}
      {(shown === 'declined' || shown === 'timeout') && ended}
    </BattleFrame>
  )
}

export default BattleInvite
