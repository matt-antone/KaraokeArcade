import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { describe, it, expect } from 'vitest'
import PlayerTextOverlay from './PlayerTextOverlay'
import type { QueueItem } from 'shared/types'

globalThis.document = { baseURI: 'http://localhost/' } as Document

// just enough store for the connected component's hooks
const store = {
  getState: () => ({}),
  subscribe: () => () => {},
  dispatch: () => {},
} as never

const nextQueueItem = {
  queueId: 2,
  userId: 42,
  userDisplayName: 'Dot Matrix',
  userAvatarId: 'halloween/hex',
} as QueueItem

const comingUpQueueItems = [
  { queueId: 3, userId: 43, userDisplayName: 'Barf' },
  { queueId: 4, userId: 44, userDisplayName: 'Lone Starr' },
  { queueId: 5, userId: 45, userDisplayName: 'Vespa' },
] as QueueItem[]

const render = (props = {}) => renderToStaticMarkup(
  <Provider store={store}>
    <PlayerTextOverlay
      queueItem={{ queueId: 1 } as QueueItem}
      nextQueueItem={nextQueueItem}
      comingUpQueueItems={comingUpQueueItems}
      isAtQueueEnd={false}
      isQueueEmpty={false}
      isErrored={false}
      intermissionEndsAt={Date.now() + 10000}
      nextSongTitle='Spaceballs the Song'
      nextSongArtist='Winnebago'
      width={1280}
      height={720}
      {...props}
    />
  </Provider>,
)

describe('PlayerTextOverlay intermission', () => {
  it('draws the next singer as their own fighter, dancing on their own stage', () => {
    // the live account id, not a snapshot and not an upload: the overlay names
    // whoever is up next, and who they are is an account-level fact
    const html = render()
    expect(html).toContain('assets/battle/fighters/halloween/hex/dance-sheet.png')
    expect(html).toContain('assets/battle/fighters/halloween/hex/location.png')
  })

  it('bills the next singer under "On stage next", with nothing before the name', () => {
    const text = render().replace(/<[^>]+>/g, '')
    expect(text).toContain('On stage nextDot Matrix')
  })

  it('bills the singer, then their song and artist', () => {
    // 11a · on stage next: the name is the headline, the song sits under it
    const text = render().replace(/<[^>]+>/g, '')
    expect(text.indexOf('Dot Matrix')).toBeLessThan(text.indexOf('Spaceballs the Song'))
    expect(text).toContain('Winnebago')
  })

  it('lists the three singers and their songs after the next one under "Up next"', () => {
    const text = render({
      comingUpSongTitles: ['Ludicrous Speed', 'Combing the Desert', 'Schwartz'],
    }).replace(/<[^>]+>/g, '')

    // one card each: the singer, then their song
    expect(text).toContain('Up next')
    expect(text).toContain('BarfLudicrous Speed')
    expect(text).toContain('Lone StarrCombing the Desert')
    expect(text).toContain('VespaSchwartz')
  })

  it('draws the idle meter under the billing', () => {
    expect(render()).toContain('role="meter"')
  })

  // The splash is drawn behind this overlay and already says a round is
  // coming, with its own clock. It is one handover, and it used to be two
  // screens.
  it('draws nothing when a trivia round is next', () => {
    const html = render({
      nextQueueItem: { queueId: 2, userId: 0, userDisplayName: 'Trivia', type: 'trivia' } as QueueItem,
      nextSongTitle: undefined,
      nextSongArtist: undefined,
      comingUpSongTitles: ['Ludicrous Speed', 'Combing the Desert'],
    })
    const text = html.replace(/<[^>]+>/g, '')

    expect(text).toBe('')
    // no face: a trivia row is nobody's
    expect(html).not.toContain('portrait')
  })

  // Same reasoning, stronger: the battle's own `versus` beat names both
  // fighters and both songs, and this page can only name one of the two — so
  // running it first announces a duel as though it were a solo.
  it('keeps only the clock when a battle is next', () => {
    const html = render({
      nextQueueItem: {
        queueId: 2, userId: 42, userDisplayName: 'Dot Matrix', type: 'battle',
      } as QueueItem,
      nextSongTitle: 'Barracuda',
      nextSongArtist: 'Heart',
      comingUpSongTitles: ['Ludicrous Speed', 'Combing the Desert'],
    })
    const text = html.replace(/<[^>]+>/g, '')

    expect(text).toMatch(/^\d+$/)
    expect(text).not.toContain('Dot Matrix')
    expect(text).not.toContain('Barracuda')
    expect(text).not.toContain('Up next')
  })
})

describe('PlayerTextOverlay playing bar', () => {
  const playing = {
    queueItem: { queueId: 1, userDisplayName: 'Lone Starr', userAvatarId: 'p1' } as QueueItem,
    intermissionEndsAt: null as number | null,
    songTitle: 'Ludicrous Speed',
    songArtist: 'Winnebago',
    position: 72,
    duration: 189,
  }
  const text = (props = {}) => render({ ...playing, ...props }).replace(/<[^>]+>/g, '')

  // 11b: up for the whole song, not only its first and last seconds
  it('names the singer, the song and the next singer for the whole song', () => {
    for (const position of [0, 72, 180]) {
      const bar = text({ position })

      expect(bar).toContain('Lone Starr')
      expect(bar).toContain('Ludicrous Speed · Winnebago')
      expect(bar).toContain('NextDot Matrix')
    }
  })

  it('reads the elapsed and total time', () => {
    expect(text()).toContain('1:12 / 3:09')
  })

  it('draws the level meter and the singer singing', () => {
    const html = render(playing)

    expect(html).toContain('role="meter"')
    expect(html).toContain('assets/battle/fighters/default/belter/sing-sheet.png')
  })

  // The bar names one singer next. A battle is two of them, and the stage is
  // about to draw the pair properly.
  it('never names a battle as next', () => {
    const bar = text({
      nextQueueItem: {
        queueId: 2, userId: 42, userDisplayName: 'Dot Matrix', type: 'battle',
      } as QueueItem,
    })

    expect(bar).not.toContain('Next')
    expect(bar).not.toContain('Dot Matrix')
  })
})

describe('PlayerTextOverlay fault', () => {
  it('reports a fault instead of joking about it', () => {
    // "The player states what happened." Where the old brand said OOPS...,
    // the TV reports: a Fault over what broke and where to look.
    const html = render({ isErrored: true })

    expect(html).toContain('Fault')
    expect(html).toContain('Media failed')
    expect(html).toContain('See the queue for details.')
  })

  it('shows the fault alone — the five states are mutually exclusive', () => {
    // errored outranks the intermission and the playing bar
    const html = render({
      isErrored: true,
      intermissionEndsAt: Date.now() + 10000,
    })

    expect(html).toContain('Media failed')
    expect(html).not.toContain('Up next')
    expect(html).not.toContain('On stage next')
    expect(html).not.toContain('role="meter"')
  })

  it('yields to an empty queue, which is not a fault', () => {
    // a queue that ran out is not broken media, and must not read as one
    const html = render({ isErrored: true, isQueueEmpty: true })

    expect(html).not.toContain('Media failed')
  })
})
