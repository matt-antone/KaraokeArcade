// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import NowSinging from './NowSinging'

// no server here: every fighter plays on the default grid
vi.mock('lib/fighterSets', () => ({ useFighterSet: (_g: string, _s: string, _l: string, fallback: unknown) => fallback }))

afterEach(cleanup)

describe('NowSinging', () => {
  it('says the stage is open when nobody is on', () => {
    render(<NowSinging isEmpty />)

    expect(screen.getByText('Stage is open')).toBeTruthy()
  })

  it('names the singer and the song, on their own location', () => {
    const { container } = render(
      <NowSinging singer='loudlucy' title='Boulevard of Broken Dreams' artist='Green Day' avatarId='halloween/deb' />,
    )

    expect(screen.getByText('loudlucy')).toBeTruthy()
    expect(screen.getByText('Boulevard of Broken Dreams')).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toContain('halloween/deb/location.png')
  })

  it('draws the singer singing: their sing sheet at 168px, not a still (07)', () => {
    const { container } = render(<NowSinging singer='loudlucy' avatarId='halloween/deb' />)
    const figure = container.querySelector<HTMLElement>('[style*="168px"]')

    expect(figure?.style.width).toBe('168px')
    expect(figure?.innerHTML).toContain('halloween/deb/sing-sheet.png')
  })
})
