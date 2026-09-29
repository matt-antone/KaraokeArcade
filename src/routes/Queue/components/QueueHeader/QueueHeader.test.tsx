// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import NowSinging from './NowSinging'

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
})
