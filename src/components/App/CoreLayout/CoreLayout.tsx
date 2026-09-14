import React, { useEffect, useRef, useState } from 'react'
import { useMatch } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import useResizeObserver from 'use-resize-observer'
// global stylesheets should be imported before any
// components that will import their own modular css
import '../../../styles/global.css'
import BattleInvite from 'components/BattleInvite/BattleInvite'
import BattleSetup from 'components/BattleSetup/BattleSetup'
import BattleVote from 'components/BattleVote/BattleVote'
import Button from 'components/Button/Button'
import Header from 'components/Header/Header'
import InstallHint from 'components/InstallHint/InstallHint'
import Navigation from 'components/Navigation/Navigation'
import Modal from 'components/Modal/Modal'
import TriviaDialog from 'components/TriviaDialog/TriviaDialog'
import Routes from '../Routes/Routes'
import { requestBattleSingers } from 'store/modules/battle'
import { fetchCurrentRoom } from 'store/modules/rooms'
import { clearErrorMessage, setFooterHeight, setHeaderHeight } from 'store/modules/ui'
import styles from './CoreLayout.css'

const CoreLayout = () => {
  const isPlayerRoute = useMatch('/player')
  const dispatch = useAppDispatch()
  const headerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  // Published as CSS vars as well as to the store: routes that are plain
  // document flow (Account, Settings) clear the fixed chrome in CSS, so they
  // never size themselves in JS and stay correct at any viewport. The store
  // copies remain for the virtualized lists, which need real pixel heights.
  useResizeObserver({
    onResize: ({ height }) => {
      dispatch(setHeaderHeight(height))
      document.documentElement.style.setProperty('--header-h', `${height ?? 0}px`)
    },
    ref: headerRef,
  })

  useResizeObserver({
    onResize: ({ height }) => {
      dispatch(setFooterHeight(height))
      document.documentElement.style.setProperty('--nav-h', `${height ?? 0}px`)
    },
    ref: navRef,
  })

  const ui = useAppSelector(state => state.ui)
  const closeError = () => dispatch(clearErrorMessage())

  /* The room this phone is in, fetched here because the chrome needs it and
     the chrome is on every screen.

     Until now only PlayerView and the Account and Settings routes ever asked
     for a room, so on the Library and Queue tabs state.rooms was simply empty —
     and anything in the header reading a room pref got undefined and drew
     itself as switched off. That is what kept the Battle key dead: not the
     pref, which was on, but a room that had never been fetched on the tab the
     key is actually looked at from.

     Keyed on roomId so switching rooms re-reads the new room's prefs rather
     than leaving the last one's chrome in place. */
  const userRoomId = useAppSelector(state => state.user.roomId)

  useEffect(() => {
    if (typeof userRoomId === 'number') dispatch(fetchCurrentRoom())
  }, [dispatch, userRoomId])

  // The Battle key is in the header and the panel it opens is mounted down
  // here beside the trivia pad, so the one boolean joining them lives at their
  // nearest common parent. Not in the store: nobody else can act on it, it must
  // not survive a reload, and the roster it shows is re-asked for every time
  // anyway — an open panel is a fact about this render, not about the party.
  const [isBattleRosterOpen, setIsBattleRosterOpen] = useState(false)

  /* How the challenge this phone threw ended, in the three words the setup
     screen has a screen for.

     The store keeps four. `cancelled` is this phone backing out, which it
     already knows about and has nothing to be told; `matched` is the happy
     ending, and by then the library is open on the song being picked and a
     panel over it would be in the way. The two that survive are the two the
     challenger is actually waiting on — and `expired` becomes `timeout`
     because "nobody answered" and "they said no" are the pair the design draws
     differently, and what the challenger needs is the kinder of the two when
     it is true. */
  const battleOutcome = useAppSelector((state) => {
    const ended = state.battle.inviteEnded

    if (ended === 'declined') return 'declined'
    if (ended === 'expired') return 'timeout'

    return state.battle.invite?.isAccepted ? 'accepted' : null
  })

  const openBattleRoster = () => {
    // asked fresh on every press: people arrive and leave all night, and a
    // roster from ten minutes ago offers a fight to somebody who went home
    dispatch(requestBattleSingers())
    setIsBattleRosterOpen(true)
  }

  return (
    <>
      <Header ref={headerRef} onBattle={openBattleRoster} />

      <Routes />

      {!isPlayerRoute && (
        <div className={styles.footer} ref={navRef}>
          <InstallHint />
          <Navigation />
        </div>
      )}

      {/* the answer pad follows the guest across every tab, and never opens on
          the player itself — that screen is showing the question */}
      {!isPlayerRoute && <TriviaDialog />}

      {/* and the challenge follows them the same way — a fight is arranged
          between two phones, and the television has no part in it.

          Two screens rather than one panel with faces, because they are two
          different conversations: one phone is building a challenge and the
          other is answering one, and only one of them can ever be true of the
          device you are holding. */}
      {!isPlayerRoute && (
        <BattleSetup
          isOpen={isBattleRosterOpen}
          outcome={battleOutcome}
          onClose={() => setIsBattleRosterOpen(false)}
        />
      )}

      {!isPlayerRoute && <BattleInvite />}

      {/* and the ballot the same way again — the vote is cast on the phone,
          and the television is showing the two people it is about */}
      {!isPlayerRoute && <BattleVote />}

      {ui.isErrored && (
        <Modal
          title='Fault'
          onClose={closeError}
          buttons={<Button variant='primary' onClick={closeError}>OK</Button>}
        >
          <p style={{ WebkitUserSelect: 'text', userSelect: 'text' }}>
            {ui.errorMessage}
          </p>
        </Modal>
      )}
    </>
  )
}

export default CoreLayout
