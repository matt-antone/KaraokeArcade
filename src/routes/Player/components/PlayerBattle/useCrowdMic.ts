import { useEffect, useRef, useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import { reportBattleScore } from 'store/modules/battle'
import { frameLevel, gradeFromLevels } from './crowdScore'
import type { BattleSide } from 'shared/types'

/**
 * Listening to the room for one metering beat, and grading it when the beat
 * ends.
 *
 * Every line of this is a hazard, so they are all named where they happen. The
 * two that are not obvious from the code:
 *
 * The analyser is connected to the microphone and to nothing else. It is never
 * joined to audioCtx.destination or to Player's gain node, because the room's
 * microphone is a few feet from the PA the room's music is coming out of, and
 * a graph that reaches the destination is a feedback howl at the exact moment
 * a hundred people are shouting into it.
 *
 * The score always gets reported, including 0. A beat that heard nothing —
 * no permission, no secure context, no microphone, an exception halfway
 * through — grades 0, and 0 against 0 is a draw, which is the honest verdict
 * when nobody was listening. Reporting nothing would leave the server holding
 * a stale grade from the other fighter and calling that a win.
 */

/** How often the meter on screen is re-read. The capture loop runs at rAF; the
 *  React state behind the bar does not, because a 24-segment meter re-rendering
 *  60 times a second on the Pi-class box a player often is buys nothing the eye
 *  can see and costs frames the video cannot spare. */
const PAINT_MS = 100

export default function useCrowdMic (
  queueId: number,
  /** Which fighter is being judged, or null when no metering beat is up. */
  side: BattleSide | null,
  /** Player's own AudioContext. Reused rather than opened: Chrome caps a
   *  document at about six and never collects them, and alertCue.ts already
   *  owns a second one. A function rather than the context itself because
   *  Player builds it on mount and this hook must not read a ref in render. */
  getAudioCtx: () => AudioContext | null,
): { level: number, grade: number } {
  const dispatch = useAppDispatch()
  // The reading carries the side it was taken for, so the bar cannot show the
  // challenger's last frame for the first tenth of a second of the opponent's
  // beat — and so nothing has to be reset in a cleanup, which would be a
  // setState in an effect and is an error in this codebase.
  const [reading, setReading] = useState({ side: 0, level: 0, grade: 0 })
  /** Every frame's level for the beat in progress. A ref because the grade is
   *  read once at the end and nothing re-renders on it. */
  const levels = useRef<number[]>([])

  useEffect(() => {
    if (side === null) return

    let stream: MediaStream | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let req: number | null = null
    let isCancelled = false
    let lastPaint = 0

    levels.current = []

    // navigator.mediaDevices is UNDEFINED on an insecure origin rather than a
    // promise that rejects, so reaching for .getUserMedia throws a TypeError
    // and takes the whole player down. A player opened at a LAN address can
    // never do this; the host's own http://localhost can.
    const canCapture = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

    async function listen () {
      const granted = await navigator.mediaDevices.getUserMedia({
        audio: {
          // All three off, and all three only hints. Automatic gain control
          // normalises a quiet room up and a loud room down, which hands both
          // fighters the same grade; noise suppression hears a cheering crowd
          // as exactly the noise it was built to remove; echo cancellation
          // ducks the microphone against the PA, which is most of the sound in
          // the room. What the browser actually agreed to is logged, because
          // the browser is free to ignore any of it and a grade measured
          // through AGC is not a grade.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      // the beat may already have ended while the permission prompt sat there
      if (isCancelled) {
        granted.getTracks().forEach(t => t.stop())
        return
      }

      const audioCtx = getAudioCtx()
      if (!audioCtx) {
        granted.getTracks().forEach(t => t.stop())
        return
      }

      stream = granted
      console.info('crowd mic:', granted.getAudioTracks()[0]?.getSettings())

      // suspended until the first gesture, on a TV box nobody has touched
      await audioCtx.resume().catch(() => {})

      const analyser = audioCtx.createAnalyser()
      // 1024 samples is about 21ms at 48k — long enough that the RMS is not
      // decided by where in the waveform this frame happened to land.
      analyser.fftSize = 1024

      // Connected to the microphone and to nothing else, forever. See the
      // note at the top: a graph that reaches the destination is a howl.
      source = audioCtx.createMediaStreamSource(granted)
      source.connect(analyser)

      const buf = new Float32Array(analyser.fftSize)

      const read = (now: number) => {
        analyser.getFloatTimeDomainData(buf)
        const next = frameLevel(buf)
        levels.current.push(next)

        if (now - lastPaint >= PAINT_MS) {
          lastPaint = now
          // The grade so far, graded exactly the way the final one will be, so
          // the room is watching the number it is about to be judged on rather
          // than a bar with no arithmetic behind it. It can fall as well as
          // rise — the loudest quarter of a longer beat is a different quarter
          // — and that is the honest reading, not a bug to smooth out.
          setReading({ side, level: next, grade: gradeFromLevels(levels.current) })
        }

        req = requestAnimationFrame(read)
      }

      req = requestAnimationFrame(read)
    }

    // Denied, no microphone, an insecure origin: nothing is said to the room.
    // The meter stays empty and the grade below comes out 0, which against the
    // other fighter's 0 is a draw — the honest answer when nobody was listening.
    if (canCapture) void listen().catch(() => {})

    return () => {
      isCancelled = true
      if (req !== null) cancelAnimationFrame(req)

      // Both fighters' grades go out, always — see the note at the top.
      dispatch(reportBattleScore(queueId, side, gradeFromLevels(levels.current)))

      source?.disconnect()
      // Without this the browser keeps the recording indicator up and the
      // laptop's microphone LED lit for the rest of the night.
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [dispatch, getAudioCtx, queueId, side])

  const isMine = reading.side === side

  return { level: isMine ? reading.level : 0, grade: isMine ? reading.grade : 0 }
}
