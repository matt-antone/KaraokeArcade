// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as mount } from '@testing-library/react'
import { Provider } from 'react-redux'
import PlayerTrivia from './PlayerTrivia'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'

/**
 * The count lands with a noise on the TV. What is worth pinning is not which
 * file plays but that it plays *once*: the tally is on screen for three
 * seconds and the component re-renders on every tick of the clock behind it.
 */
const played: string[] = []
const loaded: string[] = []

class FakeAudio {
  currentTime = 0
  preload = ''
  constructor (readonly src: string) {}
  load () { loaded.push(this.src) }
  play () {
    played.push(this.src)
    return Promise.resolve()
  }
}

vi.stubGlobal('Audio', FakeAudio)

// the winner reads the night's board; one state, so every read is the same
const state = { points: { leaderboard: [] as never[] } }
const store = {
  getState: () => state,
  subscribe: () => () => {},
  dispatch: () => {},
} as never

const render = (ui: React.ReactElement) => mount(ui, { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })

const stage = (numCorrect: number, boardFrom: number | null = null) => (
  <PlayerTrivia
    round={triviaRound()}
    result={triviaResult({ numCorrect, isFinal: boardFrom !== null, boardFrom })}
    width={1280}
    height={720}
  />
)

afterEach(() => {
  cleanup()
  played.length = 0
  loaded.length = 0
})

describe('the tally cue', () => {
  /** Both files are pulled while the question is still being answered: a
   *  party's wifi is the wrong thing to be waiting on when the count lands,
   *  and which one plays is not known until then. */
  it('fetches both cues while the question is up', () => {
    render(<PlayerTrivia round={triviaRound()} width={1280} height={720} />)

    expect(loaded).toEqual(['assets/audience-applause.mp3', 'assets/losing-horns-1.mp3'])
    expect(played).toEqual([])
  })

  it('cheers when the room got it', () => {
    render(stage(3))
    expect(played).toEqual(['assets/audience-applause.mp3'])
  })

  it('groans when nobody did', () => {
    render(stage(0))
    expect(played).toEqual(['assets/losing-horns-1.mp3'])
  })

  it('plays once, however many times the clock ticks', () => {
    const { rerender } = render(stage(3))

    for (let i = 0; i < 3; i++) rerender(stage(3))

    expect(played).toHaveLength(1)
  })

  it('cheers the last question too — its count is a beat like any other', () => {
    render(stage(3, Date.now() + 2000))
    expect(played).toEqual(['assets/audience-applause.mp3'])
  })

  /** A player that reloads onto the winner should not applaud a beat that
   *  has already been and gone. */
  it('stays quiet once the winner has taken over', () => {
    render(stage(3, Date.now() - 500))
    expect(played).toEqual([])
  })
})
