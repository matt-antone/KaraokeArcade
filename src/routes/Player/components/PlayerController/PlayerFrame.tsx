import React from 'react'
import type { BattleVideoRect } from '../PlayerBattle/battleVideoRect'

/**
 * The box the media plays in.
 *
 * On a singing beat of a battle the stage above is a bezel with a hole cut in
 * it and the media has to be the size of the hole. Everywhere else — every
 * other beat, every ordinary song — it is the whole screen. Inline styles
 * because these are measured pixels off the display, which is the one thing a
 * stylesheet cannot hold.
 *
 * Always one <div>, and always a real positioned box. Both halves of that are
 * bugs that have already been shipped here, in opposite directions.
 *
 * Returning `<>{children}</>` for the no-rect case reads like the tidier thing
 * and is the first one. React matches by position and type, so a slot holding
 * a fragment on one beat and a div on the next is a slot whose subtree is
 * thrown away and rebuilt on every flip — and the child is Player, which
 * builds its AudioContext in componentDidMount, holds it in an instance field
 * and never closes it, because unmounting was never part of its life. One
 * battle flips this five times; browsers cap contexts around six, and the next
 * `new AudioContext()` throws and takes the sound out with it.
 *
 * `display: contents` for that case is the second, and worse for being subtle.
 * It keeps one element, which fixes the remount — but it destroys the box, and
 * a <video> whose box is destroyed and rebuilt does not get its compositing
 * layer back in Chromium. The element keeps decoding: frames advance, none are
 * dropped, drawImage on it returns real pixels. It simply never reaches the
 * screen again, so a battle is followed by a song you can hear and cannot see,
 * until some unrelated repaint happens to revive it.
 *
 * So the box always exists and only its numbers change: the bezel's cut-out on
 * a singing beat, the whole display the rest of the time. Nothing about Player
 * or the video element is torn down between them.
 */
const PlayerFrame = ({ rect, width, height, children }: {
  rect: BattleVideoRect | null
  width: number
  height: number
  children: React.ReactNode
}) => (
  <div
    style={{
      position: 'absolute',
      left: rect ? rect.left : 0,
      top: rect ? rect.top : 0,
      width: rect ? rect.width : width,
      height: rect ? rect.height : height,
    }}
  >
    {children}
  </div>
)

export default PlayerFrame
