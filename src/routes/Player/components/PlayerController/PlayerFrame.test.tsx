// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import PlayerFrame from './PlayerFrame'

afterEach(cleanup)

/* The media element must survive a battle.
 *
 * PlayerFrame sizes the video into the bezel's cut-out on the two singing
 * beats and leaves it full-screen everywhere else, so `rect` flips between an
 * object and null five times in one battle. What it must never do is change
 * the shape of the tree while doing it: its child is Player, which opens an
 * AudioContext in componentDidMount, keeps it in an instance field and never
 * closes it. Remounting Player therefore leaks a context per flip, and after a
 * battle or two the browser's cap is reached, `new AudioContext()` throws, and
 * the room gets a black screen for the rest of the night.
 *
 * A class component is the probe on purpose: this asserts mount count, which
 * is the thing that actually went wrong, rather than asserting the styles that
 * happen to achieve it. */
let mounts = 0

class MountCounter extends React.Component {
  componentDidMount () {
    mounts++
  }

  render () {
    return <div data-testid='child' />
  }
}

const RECT = { left: 100, top: 40, width: 320, height: 180 }
const DISPLAY = { width: 1280, height: 720 }

describe('PlayerFrame', () => {
  afterEach(() => {
    mounts = 0
  })

  it('keeps its child mounted across every rect flip a battle makes', () => {
    const { rerender, getByTestId } = render(
      <PlayerFrame rect={null} {...DISPLAY}><MountCounter /></PlayerFrame>,
    )

    const child = getByTestId('child')

    // versus -> sing1 -> intro2 -> sing2 -> judge
    for (const rect of [RECT, null, RECT, null]) {
      rerender(<PlayerFrame rect={rect} {...DISPLAY}><MountCounter /></PlayerFrame>)
    }

    expect(mounts).toBe(1)
    // the very same node, not an equal one: a replaced element is a replaced
    // <video>, which is the whole failure even when the count survives
    expect(getByTestId('child')).toBe(child)
  })

  /* The box has to keep existing, not just the element.
   *
   * `display: contents` kept one element and still broke the video: it
   * destroys the box, and Chromium never gives a <video> its compositing layer
   * back afterwards. The element goes on decoding — frames advance, none drop,
   * drawImage returns real pixels — and never paints again. So the assertion
   * is that both states are ordinary positioned boxes differing only in
   * numbers, and `display` is never touched at all. */
  it('fills the display when there is no rect', () => {
    const { container } = render(<PlayerFrame rect={null} {...DISPLAY}><MountCounter /></PlayerFrame>)
    const { style } = container.firstChild as HTMLElement

    expect(style.position).toBe('absolute')
    expect(style.left).toBe('0px')
    expect(style.top).toBe('0px')
    expect(style.width).toBe('1280px')
    expect(style.height).toBe('720px')
    expect(style.display).toBe('')
  })

  it('is placed and sized to the cut-out when there is one', () => {
    const { container } = render(<PlayerFrame rect={RECT} {...DISPLAY}><MountCounter /></PlayerFrame>)
    const { style } = container.firstChild as HTMLElement

    expect(style.position).toBe('absolute')
    expect(style.left).toBe('100px')
    expect(style.top).toBe('40px')
    expect(style.width).toBe('320px')
    expect(style.height).toBe('180px')
    expect(style.display).toBe('')
  })

  it('never changes box type across a flip', () => {
    const { container, rerender } = render(
      <PlayerFrame rect={RECT} {...DISPLAY}><MountCounter /></PlayerFrame>,
    )
    const el = container.firstChild as HTMLElement

    for (const rect of [null, RECT, null]) {
      rerender(<PlayerFrame rect={rect} {...DISPLAY}><MountCounter /></PlayerFrame>)
      expect(el.style.position).toBe('absolute')
      expect(el.style.display).toBe('')
    }
  })
})
