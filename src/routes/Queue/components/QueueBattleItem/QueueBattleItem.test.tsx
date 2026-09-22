// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import QueueBattleItem from './QueueBattleItem'

/**
 * The one row in the queue that does not follow the account.
 *
 * A battle snapshots both fighters onto the row when the match is made, and
 * that snapshot is what every screen draws for the rest of the night. So the
 * moment somebody changes their character, this row and their ordinary song
 * rows disagree — on purpose. A fight that silently re-cast itself between
 * being queued and being sung is the thing this prevents.
 *
 * The live id is a fallback and only a fallback: a battle queued before the
 * snapshot columns existed has none, and drawing the account's character beats
 * drawing a hole.
 */

afterEach(cleanup)

const fighter = (over = {}) => ({
  userId: 1,
  name: 'Dot Matrix',
  dateUpdated: 0,
  singerId: 'p1',
  avatarId: 'p1',
  title: 'Barracuda',
  artist: 'Heart',
  ...over,
})

const srcs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img')).map(img => img.getAttribute('src'))

describe('QueueBattleItem', () => {
  it('draws the fight as it was fought, not as the account now stands', () => {
    const { container } = render(
      <QueueBattleItem
        isCurrent={false}
        isPlayed={false}
        challenger={fighter({ singerId: 'p1', avatarId: 'halloween/hex' })}
        opponent={fighter({ userId: 2, name: 'Barf', singerId: 'p2', avatarId: 'p8' })}
      />,
    )

    expect(srcs(container)).toEqual([
      'assets/battle/fighters/default/belter/views/portrait-34.png',
      'assets/battle/fighters/default/crooner/views/portrait-34.png',
    ])
  })

  it('falls back to the account for a battle queued before the snapshot existed', () => {
    const { container } = render(
      <QueueBattleItem
        isCurrent={false}
        isPlayed={false}
        challenger={fighter({ singerId: null, avatarId: 'halloween/hex' })}
        opponent={fighter({ userId: 2, name: 'Barf', singerId: '', avatarId: null })}
      />,
    )

    expect(srcs(container)).toEqual([
      'assets/battle/fighters/halloween/hex/views/portrait-34.png',
      // nothing to go on at all, which is the first playable fighter
      'assets/battle/fighters/default/belter/views/portrait-34.png',
    ])
  })
})
