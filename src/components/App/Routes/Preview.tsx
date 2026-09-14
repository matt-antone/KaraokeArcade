// TEMPORARY screenshot harness for README art. Not part of the app; delete
// with the `/preview` route in Routes.tsx once the images are captured.
import React, { useEffect } from 'react'
import { useAppDispatch } from 'store/hooks'
import PlayerBattle from 'routes/Player/components/PlayerBattle/PlayerBattle'
import PlayerTrivia from 'routes/Player/components/PlayerTrivia/PlayerTrivia'
import * as battleFixtures from 'lib/battleFixtures'
import * as triviaFixtures from 'lib/triviaFixtures'
import type { BattlePhase, BattleTurn } from 'shared/types'

const round = () => triviaFixtures.triviaRound({
  questionNumber: 3,
  questionCount: 5,
  question: 'Which band released the album "Rumours" in 1977?',
  answers: ['Fleetwood Mac', 'The Eagles', 'Steely Dan', 'Boston'],
  difficulty: 'easy',
  endsAt: Date.now() + 14000,
  sentAt: Date.now(),
})

const result = () => triviaFixtures.triviaResult({
  questionNumber: 3,
  correctIdx: 0,
  numCorrect: 4,
  scores: [
    { userId: 1, name: 'Dot Matrix', score: 3, numAnswered: 3 },
    { userId: 2, name: 'Barf', score: 2, numAnswered: 3 },
    { userId: 3, name: 'Vespa', score: 2, numAnswered: 2 },
    { userId: 4, name: 'Lone Starr', score: 1, numAnswered: 3 },
  ],
  scoresFrom: Date.now() - 1000,
  endsAt: Date.now() + 4000,
  sentAt: Date.now(),
})

const turn = (phase: BattlePhase, over: Partial<BattleTurn> = {}) => battleFixtures.battleTurn({
  phase,
  endsAt: Date.now() + 30000,
  sentAt: Date.now(),
  ...over,
})

const Preview = ({ scene }: { scene: string }) => {
  const dispatch = useAppDispatch()
  const params = new URLSearchParams(window.location.search)
  const w = Number(params.get('w') ?? 1280)
  const h = Number(params.get('h') ?? 720)

  useEffect(() => {
    if (scene === 'trivia-phone') {
      dispatch({ type: 'trivia/ROUND', payload: round() })
    } else if (scene === 'trivia-phone-reveal') {
      dispatch({ type: 'trivia/ROUND', payload: round() })
      dispatch({ type: 'trivia/RESULT', payload: result() })
    } else if (scene === 'battle-versus') {
      dispatch({ type: 'battle/TURN', payload: turn('versus') })
    } else if (scene === 'battle-ballot') {
      // There is no 'ballot' phase. The phone draws the ballot during `judge`,
      // and only when the turn says the room settles fights by ballot — the
      // fixture default is 'crowd', which is graded by the player's own
      // microphone and puts no ballot on a phone at all.
      dispatch({ type: 'battle/TURN', payload: turn('judge', { judging: 'ballot' }) })
    } else if (scene === 'battle-winner') {
      dispatch({
        type: 'battle/TURN',
        payload: turn('winner', { challengerScore: 71, opponentScore: 88 }),
      })
    } else if (scene === 'battle-intro') {
      dispatch({ type: 'battle/TURN', payload: turn('intro2') })
    }
  }, [dispatch, scene])

  if (scene === 'trivia-tv') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999 }}>
        <PlayerTrivia round={round()} width={w} height={h} />
      </div>
    )
  }

  if (scene === 'trivia-tv-reveal') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999 }}>
        <PlayerTrivia round={round()} result={result()} width={w} height={h} />
      </div>
    )
  }

  if (scene.startsWith('battle-') && !scene.endsWith('ballot')) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999 }}>
        <PlayerBattle queueId={7} getAudioCtx={() => null} width={w} height={h} />
      </div>
    )
  }

  // phone scenes: the dialogs CoreLayout already mounts draw themselves. The
  // black sheet hides the signed-out header behind them.
  return <div style={{ position: 'fixed', inset: 0, background: '#0b0b0d', zIndex: 5 }} />
}

export default Preview
