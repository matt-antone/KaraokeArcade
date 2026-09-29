import { describe, expect, it } from 'vitest'
import { BATTLE_SINGERS } from 'lib/battleSingers'
import { CROWD_MAX, crowdOf, joinCountOf } from './crowd'

const seeds = (n: number) => Array.from({ length: n }, (_, i) => (i * 0.137) % 1)

describe('crowdOf', () => {
  it('never draws more than forty, however many seeds it is handed', () => {
    expect(CROWD_MAX).toBe(40)
    expect(crowdOf(seeds(500), BATTLE_SINGERS)).toHaveLength(40)
    expect(crowdOf(seeds(12), BATTLE_SINGERS)).toHaveLength(12)
  })

  it('stands ten rows of four, front to back', () => {
    const crowd = crowdOf(seeds(40), BATTLE_SINGERS)
    const perRow = crowd.reduce<Record<number, number>>((acc, m) => ({ ...acc, [m.row]: (acc[m.row] ?? 0) + 1 }), {})

    expect(Object.keys(perRow)).toHaveLength(10)
    expect(Object.values(perRow).every(n => n === 4)).toBe(true)
  })

  it('is the same crowd for the same seeds', () => {
    const a = crowdOf(seeds(40), BATTLE_SINGERS).map(m => m.singer.id)
    const b = crowdOf(seeds(40), BATTLE_SINGERS).map(m => m.singer.id)

    expect(a).toEqual(b)
  })

  it('picks only from the roster, and draws nobody from an empty one', () => {
    const ids = new Set(BATTLE_SINGERS.map(s => s.id))

    expect(crowdOf([0, 0.5, 0.999999], BATTLE_SINGERS).every(m => ids.has(m.singer.id))).toBe(true)
    expect(crowdOf(seeds(40), [])).toEqual([])
  })
})

describe('joinCountOf', () => {
  it('says the room in the design\'s words, capped at forty like the crowd', () => {
    expect(joinCountOf(0)).toBe('Waiting for singers')
    expect(joinCountOf(1)).toBe('1 singer in')
    expect(joinCountOf(39)).toBe('39 singers in')
    expect(joinCountOf(46)).toBe('40 singers in')
  })
})
