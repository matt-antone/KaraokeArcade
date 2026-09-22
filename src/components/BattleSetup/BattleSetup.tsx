import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import BattleFrame from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import BattleSprite from 'components/BattleStage/BattleSprite'
import BattleVersus, { BattleSummary } from 'components/BattleStage/BattleVersus'
import useBattleIris, { BATTLE_TONE } from 'components/BattleStage/useBattleIris'
import type { BattleRect } from 'components/BattleStage/useBattleIris'
import {
  BATTLE_LOCKUP,
  battleSingerOrDefault,
  battleSingerPortrait,
} from 'lib/battleSingers'
import { startBattlePick } from 'store/modules/battle'
import styles from './BattleSetup.css'

/**
 * The challenger's phone, from pressing the Battle key to the answer coming
 * back.
 *
 * Arcade, not deck, and that is the reversal this redesign is: the old panel
 * argued that a phone is asked for a decision rather than a spectacle and so
 * should stay in the app's own language. What that produced was a negotiation
 * that looked like nothing the room was watching on the television, and two
 * people arranging a fight in a service dialog. The fight is the product. This
 * screen is the same cabinet the TV is running, and the decision is made
 * inside it.
 *
 *     SINGER -> SELECTED -> OPPONENT -> CONFIRM -> the library, in battle mode
 *                                                      |
 *                                     accepted <-------+-------> declined / no answer
 *
 * Cancel is on every step and is terminal: nothing has been sent until
 * CONFIRM, and until then backing out costs the room nothing.
 *
 * Two things here are load-bearing and neither is decoration. The iris grows
 * out of the exact point the thumb just left, so every step change is the
 * consequence of a touch rather than a cut. And the chosen singer is ONE
 * object for the whole flow: on each step change its sprite is lifted out of
 * the layout and flown to the slot the next screen puts it in — tile, footer
 * chip, header chip, versus plate — because a fighter that blinks out here and
 * reappears there is a different fighter as far as anybody watching can tell.
 */

interface BattleSetupProps {
  /** The Battle key has been pressed and this has not been dismissed. */
  isOpen: boolean
  /** What came back from the other phone, once it has. Server-driven and
   *  passed in rather than read here: a lapsed invite and a declined one are
   *  the same absence in this component and are told apart upstream. */
  outcome?: 'accepted' | 'declined' | 'timeout' | null
  /** Dismissed, or handed off to the library. */
  onClose: () => void
}

type Step = 'selected' | 'opponent' | 'confirm' | 'set' | 'cancelled'

/** How long MATCH SET and CANCELLED hold before the screen gets out of the
 *  way. Long enough to read four words, short enough that nobody waits. */
const CLOSE_MS = 1100
/** The flight, plus a frame either side of the 420ms transition. */
const FLIGHT_MS = 440

const BattleSetup = ({ isOpen, outcome = null, onClose }: BattleSetupProps) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const handle = useAppSelector(state => state.user.name) ?? ''
  const room = useAppSelector(state => state.battle.singers)
  const invite = useAppSelector(state => state.battle.invite)
  const avatarId = useAppSelector(state => state.user.avatarId)

  const [step, setStep] = useState<Step>('selected')
  const [query, setQuery] = useState('')
  const [oppUserId, setOppUserId] = useState<number | null>(null)
  const [isOutcomeSeen, setIsOutcomeSeen] = useState(false)
  /* PICK SOMEONE ELSE goes back into a flow the Battle key is no longer
     holding open — the answer arrived long after the dialog closed. Without
     this the screen dismisses itself the moment the outcome is acknowledged
     and the offer to try again does nothing. */
  const [isRetrying, setIsRetrying] = useState(false)

  const { frameRef, iris, burst, rectIn } = useBattleIris()
  const slotRef = useRef<HTMLDivElement>(null)
  /** Where the sprite currently lives, in frame coordinates. Remembered across
   *  the step change that destroys the element it was measured from. */
  const homeRect = useRef<BattleRect | null>(null)
  const isFlipped = useRef(false)
  const [flyer, setFlyer] = useState<{ rect: BattleRect, isFlipped: boolean } | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /* Both of these are React's own "adjust state when a prop changes" pattern,
     done during render rather than in an effect: an effect would paint the
     stale screen first, which here means a flash of the answer the challenger
     already dismissed, or of the step a cancelled negotiation ended on.

     A fresh answer is a fresh screen. And pressing the Battle key starts a new
     negotiation, not the one abandoned three songs ago — reopening on the
     confirm step of a cancelled match is offering to send something nobody is
     thinking about any more. */
  const [seen, setSeen] = useState({ outcome, isOpen })

  if (seen.outcome !== outcome || seen.isOpen !== isOpen) {
    setSeen({ outcome, isOpen })
    if (seen.outcome !== outcome) setIsOutcomeSeen(false)

    if (seen.isOpen !== isOpen && isOpen) {
      setStep('selected')
      setQuery('')
      setOppUserId(null)
      setIsRetrying(false)
    }
  }

  const singer = battleSingerOrDefault(avatarId)
  const opponent = room.find(s => s.userId === oppUserId) ?? null
  const needle = query.trim().toLowerCase()
  const results = needle ? room.filter(s => s.name.toLowerCase().includes(needle)) : room

  /**
   * A step change that carries the singer with it.
   *
   * The patch is applied on the tap rather than mid-iris, unlike every other
   * transition here: the flyer's destination is a slot on the screen that does
   * not exist yet, and it can only be measured once the new layout has been
   * laid out. Source and destination are both read relative to the frame, and
   * the destination after a double rAF — one frame to commit the state, one
   * for the browser to lay it out. Read it any earlier and the flyer animates
   * to wherever the slot was on the screen being left.
   */
  const carry = (
    e: React.MouseEvent<HTMLElement>,
    tone: string,
    apply: () => void,
    isFlippedNext = false,
  ) => {
    const from = homeRect.current ?? rectIn(slotRef.current)

    timers.current.forEach(clearTimeout)
    timers.current = []
    burst(e, tone)
    apply()

    if (from) setFlyer({ rect: from, isFlipped: isFlipped.current })

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const to = rectIn(slotRef.current)
      if (!to) return setFlyer(null)

      homeRect.current = to
      isFlipped.current = isFlippedNext
      setFlyer({ rect: to, isFlipped: isFlippedNext })
      timers.current.push(window.setTimeout(() => setFlyer(null), FLIGHT_MS))
    }))
  }

  const handleBack = (e: React.MouseEvent<HTMLElement>) => carry(e, BATTLE_TONE.quiet, () => (
    setStep(was => (was === 'confirm' ? 'opponent' : 'selected'))
  ))

  /** Out, from anywhere: the flow is over and the Battle key owns whether
   *  there is a next one. */
  const close = () => {
    setIsRetrying(false)
    setIsOutcomeSeen(true)
    onClose()
  }

  const handleCancel = (e: React.MouseEvent<HTMLElement>) => {
    burst(e, BATTLE_TONE.quiet, () => setStep('cancelled'))
    timers.current.push(window.setTimeout(close, CLOSE_MS))
  }

  /* The only thing on this screen the room ever hears about. Sent on the tap
     rather than under the iris, because a dispatch waiting on an animation
     timer is a dispatch a backgrounded phone eats — the screens after it are
     cosmetic, this is not. */
  const handleConfirm = (e: React.MouseEvent<HTMLElement>) => {
    if (!opponent) return

    // The challenger's fighter still has to reach the BATTLE_CHALLENGE the
    // library sends after the song is picked, and the queue row still
    // snapshots it (017). What has changed is where it comes from: the
    // account, rather than a pick made three screens ago and remembered in
    // this phone's localStorage.
    dispatch(startBattlePick(opponent, singer.id))
    burst(e, BATTLE_TONE.gold, () => setStep('set'))
    timers.current.push(window.setTimeout(() => {
      // the library is the next step of the same tap, not a place to be sent
      // and left to work it out: its header is already wearing the banner
      // saying who this browse is for by the time the screen arrives
      navigate('/library')
      close()
    }, CLOSE_MS))
  }

  const ending = outcome && !isOutcomeSeen ? outcome : null
  if (!isOpen && !ending && !isRetrying) return null

  const isPast = step === 'opponent' || step === 'confirm'
  const canGoBack = !ending && (step === 'opponent' || step === 'confirm')
  const isLive = !ending && step !== 'set' && step !== 'cancelled'

  /** SELECTED · the opening beat, and the one screen in the flow that is only
   *  about who you are. It used to follow a pick made here; the pick moved to
   *  sign-in, so this states the fighter rather than confirming a choice. */
  const selected = (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.glowGold} />

      <div className={styles.selectedHead}>YOU SING AS</div>

      <div className={styles.hero}>
        <BattleSprite singer={singer} className={styles.heroArt} />
      </div>

      <div className={styles.selectedName} translate='no'>{singer.name}</div>
      <div className={styles.selectedTag}>
        SINGS FOR
        {' '}
        {handle}
      </div>

      <div className={clsx(styles.footer, styles.footerStack)}>
        <BattleKey onClick={e => carry(e, BATTLE_TONE.gold, () => setStep('opponent'))}>
          PICK OPPONENT
        </BattleKey>
      </div>
    </div>
  )

  /** OPPONENT · everyone checked into the venue tonight, and nothing else.
   *  Search filters this list; it cannot reach past it. Somebody who is not in
   *  the room cannot be fought, so there is no invite-by-handle and no open
   *  challenge to fall back to. */
  const opponents = (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.masthead}>
        <div className={styles.title}>
          PICK WHO
          <br />
          YOU BATTLE
        </div>
      </div>

      <div className={styles.carried}>
        <div className={styles.carriedChip} ref={slotRef}>
          {!flyer && <BattleSprite singer={singer} />}
        </div>
        <div className={styles.carriedName} translate='no'>{singer.name}</div>
      </div>

      <div className={styles.search}>
        <div className={styles.searchGlyph}>&#8981;</div>
        <input
          type='text'
          className={styles.searchInput}
          value={query}
          placeholder='SEARCH THE ROOM'
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            type='button'
            className={styles.searchClear}
            onClick={() => setQuery('')}
            aria-label='Clear search'
          >
            &times;
          </button>
        )}
      </div>

      <div className={styles.hereRow}>
        <div className={styles.hereDot} />
        <div className={styles.here}>HERE TONIGHT</div>
        <div className={styles.hereCount}>
          {results.length}
          {' '}
          OF
          {' '}
          {room.length}
        </div>
      </div>

      <div className={styles.rows}>
        {results.map(person => (
          <button
            key={person.userId}
            type='button'
            className={clsx(styles.row, person.userId === oppUserId && styles.rowOn)}
            onClick={() => setOppUserId(person.userId)}
          >
            <UserAvatar
              className={styles.avatar}
              avatarId={person.avatarId}
            />
            <span className={styles.rowName} translate='no'>{person.name}</span>
            {person.userId === oppUserId && <span className={styles.rowMark}>&#9654; PICKED</span>}
            <span className={styles.rowBar} />
          </button>
        ))}

        {results.length === 0 && (
          <div className={styles.empty}>
            {room.length === 0
              ? (
                  <>
                    NOBODY ELSE IS HERE YET
                    <br />
                    A BATTLE NEEDS TWO
                  </>
                )
              : (
                  <>
                    NOBODY HERE BY THAT NAME
                    <br />
                    THEY HAVE TO BE IN THE ROOM
                  </>
                )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <BattleKey
          tone='one'
          disabled={!opponent}
          onClick={e => carry(e, BATTLE_TONE.two, () => setStep('confirm'), true)}
        >
          {opponent ? `BATTLE ${opponent.name}` : 'PICK SOMEONE IN THE ROOM'}
        </BattleKey>
      </div>
    </div>
  )

  /** CONFIRM · the whole deal on one screen, with a way back into either half
   *  of it that does not walk through the other. */
  const confirm = opponent && (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.masthead}>
        <div className={styles.title}>
          CONFIRM
          <br />
          THE MATCH
        </div>
        <div className={styles.lede}>LOCKED IN FOR BOTH OF YOU ONCE YOU CONFIRM</div>
      </div>

      <div className={styles.scroller}>
        <BattleVersus
          youRef={slotRef}
          you={{
            label: 'YOU',
            handle,
            tint: 'one',
            plate: !flyer && <BattleSprite singer={singer} isFlipped />,
          }}
          them={{
            label: 'OPPONENT',
            handle: opponent.name,
            tint: 'two',
            plate: (
              <UserAvatar
                className={styles.plateImage}
                avatarId={opponent.avatarId}
                size={80}
              />
            ),
          }}
        />

        <BattleSummary
          rows={[
            // no onEdit: who you sing as is your account now, and changing it
            // is an Account-page decision rather than a step of one challenge
            { label: 'YOUR SINGER', value: singer.name, tint: 'gold' },
            {
              label: 'OPPONENT',
              value: opponent.name,
              onEdit: e => burst(e, BATTLE_TONE.quiet, () => setStep('opponent')),
            },
            { label: 'FORMAT', value: '2 MINUTE FORMAT' },
          ]}
        />

        <div className={styles.closing}>
          NEXT UP &middot; YOU PICK THE SONG
          {' '}
          {opponent.name}
          {' '}
          HAS TO SING
        </div>
      </div>

      <div className={clsx(styles.footer, styles.footerStack)}>
        <BattleKey onClick={handleConfirm}>CONFIRM</BattleKey>
        <div className={styles.footerPair}>
          <BattleKey variant='ghost' onClick={handleBack}>BACK</BattleKey>
          <BattleKey variant='ghost' onClick={handleCancel}>CANCEL</BattleKey>
        </div>
      </div>
    </div>
  )

  /** ACCEPTED · they took it, and are off picking what you sing. The invite is
   *  still in flight at this point, which is where the song and their singer
   *  come from. */
  const accepted = (
    <div className={styles.body}>
      <div className={styles.glowGreen} />

      {invite && (
        <div className={styles.answerHero}>
          <BattleSprite
            singer={battleSingerOrDefault(invite.opponentSingerId)}
            className={styles.answerHeroArt}
          />
        </div>
      )}

      <div className={styles.answerRow}>
        <div className={styles.answerDot} />
        <div className={styles.answerTag}>THEY ANSWERED</div>
      </div>

      <img className={styles.lockup} src={BATTLE_LOCKUP} alt='Singer Battle' />

      <div className={styles.gap} />

      <div className={styles.endHead}>ACCEPTED</div>
      <div className={styles.endName} translate='no'>{invite?.opponentName}</div>

      {invite && (
        <div className={styles.songCard}>
          <img
            className={styles.songArt}
            src={battleSingerPortrait(battleSingerOrDefault(invite.opponentSingerId))}
            alt=''
          />
          <div className={styles.songText}>
            <div className={styles.songTitle} translate='no'>
              {invite.title}
              {' '}
              &mdash;
              {' '}
              {invite.artist}
            </div>
            <div className={styles.songMeta}>PICKED BY YOU &middot; 2 MINUTE FORMAT</div>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.endNote}>THEY ARE PICKING WHAT YOU SING</div>
        <BattleKey className={styles.endKey} onClick={close}>DONE</BattleKey>
      </div>
    </div>
  )

  /** DECLINED and NO ANSWER · one layout, because from here they are the same
   *  news: nothing is in the queue and the turn is still yours. */
  const refused = (
    <div className={styles.body}>
      <div className={styles.glowRed} />

      <div className={styles.answerRow}>
        <div className={clsx(styles.answerDot, styles.answerDotRed)} />
        <div className={clsx(styles.answerTag, styles.answerTagRed)}>
          {outcome === 'timeout' ? 'NO ANSWER' : 'DECLINED'}
        </div>
        <div className={styles.answerWhen}>
          {outcome === 'timeout' ? 'INVITE EXPIRED' : 'JUST NOW'}
        </div>
      </div>

      <img className={clsx(styles.lockup, styles.lockupSpent)} src={BATTLE_LOCKUP} alt='Singer Battle' />

      <div className={styles.gap} />

      <div className={styles.endName} translate='no'>
        {outcome === 'timeout' ? 'NO ANSWER' : `${invite?.opponentName ?? 'THEY'} PASSED`}
      </div>

      <div className={styles.endCard}>
        {outcome === 'timeout'
          ? 'THE INVITE RAN OUT BEFORE THEY OPENED IT'
          : 'NO BATTLE SET · NOTHING IS IN THE QUEUE'}
      </div>

      {/* The declined screen has no fighter to draw — the other side never
          picked one — so the news sits between two gaps rather than above a
          hole where a figure would have been. */}
      <div className={styles.gap} />

      <div className={clsx(styles.footer, styles.footerStack)}>
        <BattleKey
          onClick={e => burst(e, BATTLE_TONE.gold, () => {
            setIsOutcomeSeen(true)
            setIsRetrying(true)
            setOppUserId(null)
            setQuery('')
            setStep('opponent')
          })}
        >
          PICK SOMEONE ELSE
        </BattleKey>
        <BattleKey variant='ghost' onClick={close}>LEAVE IT</BattleKey>
      </div>
    </div>
  )

  /** MATCH SET and CANCELLED · both terminal, both here to say what just
   *  happened to the room before the screen goes away. */
  const closing = (
    <div className={styles.closingBeat}>
      <div className={clsx(styles.closingTitle, step === 'set' && styles.closingTitleSet)}>
        {step === 'set' ? 'MATCH SET' : 'CANCELLED'}
      </div>
      {step === 'set'
        ? (
            <>
              <div className={styles.closingPair} translate='no'>
                {handle}
                {' '}
                vs
                {' '}
                {opponent?.name}
              </div>
              <div className={styles.closingNote}>NEXT &middot; YOU PICK THEIR SONG</div>
            </>
          )
        : <div className={styles.closingQuiet}>NO BATTLE SET &middot; NOTHING SENT</div>}
    </div>
  )

  return (
    <BattleFrame
      variant='setup'
      title='SINGER BATTLE'
      pips={[true, isPast]}
      iris={iris}
      frameRef={frameRef}
      onBack={canGoBack ? handleBack : undefined}
      onCancel={isLive ? handleCancel : undefined}
      overlay={flyer && (
        <div
          className={styles.flyer}
          style={{
            left: `${flyer.rect.left}px`,
            top: `${flyer.rect.top}px`,
            width: `${flyer.rect.width}px`,
            height: `${flyer.rect.height}px`,
          }}
        >
          <BattleSprite singer={singer} isFlipped={flyer.isFlipped} />
        </div>
      )}
    >
      {ending === 'accepted' && accepted}
      {(ending === 'declined' || ending === 'timeout') && refused}

      {!ending && step === 'selected' && selected}
      {!ending && step === 'opponent' && opponents}
      {!ending && step === 'confirm' && confirm}
      {!ending && (step === 'set' || step === 'cancelled') && closing}
    </BattleFrame>
  )
}

export default BattleSetup
