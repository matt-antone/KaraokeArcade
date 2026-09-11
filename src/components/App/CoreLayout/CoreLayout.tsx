import React, { useRef, useState } from 'react'
import { useMatch } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import useResizeObserver from 'use-resize-observer'
// global stylesheets should be imported before any
// components that will import their own modular css
import '../../../styles/global.css'
import BattleBallot from 'components/BattleBallot/BattleBallot'
import BattleDialog from 'components/BattleDialog/BattleDialog'
import Button from 'components/Button/Button'
import Header from 'components/Header/Header'
import InstallHint from 'components/InstallHint/InstallHint'
import Navigation from 'components/Navigation/Navigation'
import Modal from 'components/Modal/Modal'
import TriviaDialog from 'components/TriviaDialog/TriviaDialog'
import Routes from '../Routes/Routes'
import { requestBattleSingers } from 'store/modules/battle'
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

  // The Battle key is in the header and the panel it opens is mounted down
  // here beside the trivia pad, so the one boolean joining them lives at their
  // nearest common parent. Not in the store: nobody else can act on it, it must
  // not survive a reload, and the roster it shows is re-asked for every time
  // anyway — an open panel is a fact about this render, not about the party.
  const [isBattleRosterOpen, setIsBattleRosterOpen] = useState(false)

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
          between two phones, and the television has no part in it */}
      {!isPlayerRoute && (
        <BattleDialog
          isRosterOpen={isBattleRosterOpen}
          onCloseRoster={() => setIsBattleRosterOpen(false)}
        />
      )}

      {/* and the ballot the same way again — the vote is cast on the phone,
          and the television is showing the two people it is about */}
      {!isPlayerRoute && <BattleBallot />}

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
