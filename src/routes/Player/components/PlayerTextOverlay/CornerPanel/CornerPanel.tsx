import React, { useEffect, useState } from 'react'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import VuMeter from 'components/VuMeter/VuMeter'
import styles from './CornerPanel.css'

/** How often the meter re-reads the room's level. */
const LEVEL_MS = 100
/** RMS dBFS at which the meter is empty, and the headroom above it at which
 *  it is full. ponytail: calibrated by ear on a loud master (it touches the
 *  yellow at about -8 dB); nudge these if quiet rooms read as dead. */
const FLOOR_DB = -40
const RANGE_DB = 36

/** The room's level, 0-1, off the Player's analyser (the gain node's output). */
const useAudioLevel = (getAnalyser: () => AnalyserNode | null) => {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    let buf: Float32Array<ArrayBuffer> | null = null

    const intervalID = setInterval(() => {
      const analyser = getAnalyser()
      if (!analyser) return

      if (buf?.length !== analyser.fftSize) buf = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(buf)

      let sum = 0
      for (const v of buf) sum += v * v
      const db = 10 * Math.log10(sum / buf.length || 1e-12)

      setLevel(Math.round(Math.min(1, Math.max(0, (db - FLOOR_DB) / RANGE_DB)) * 32) / 32)
    }, LEVEL_MS)

    return () => clearInterval(intervalID)
  }, [getAnalyser])

  return level
}

/** Seconds as m:ss. */
const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface CornerPanelProps {
  /** Whoever is on stage now. */
  singer: string
  songTitle?: string
  songArtist?: string
  /** Seconds into the song, and its length. */
  position: number
  duration: number
  getAnalyser?: () => AnalyserNode | null
  /** Whoever sings after this song. Absent when nobody does, or when the next
   *  row is a battle or a round rather than a singer. */
  next?: { name: string, avatarId?: string | null }
}

const NO_ANALYSER = (): AnalyserNode | null => null

// 11b · the bar across the top for the whole of a playing song: who, what,
// how loud, how far in, and who is next.
const CornerPanel = ({ singer, songTitle, songArtist, position, duration, getAnalyser = NO_ANALYSER, next }: CornerPanelProps) => {
  const level = useAudioLevel(getAnalyser)

  return (
    <div className={styles.panel}>
      <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
      <span className={styles.rule} />
      <span className={styles.singer} translate='no'>{singer}</span>
      <span className={styles.song} translate='no'>
        {songTitle}
        {songArtist && <span className={styles.artist}>{` · ${songArtist}`}</span>}
      </span>
      <VuMeter
        className={styles.meter}
        value={level}
        segments={32}
        peakFrom={28 / 32}
        height='1.85vh'
        gap='0.185vh'
        label='Level'
      />
      <span className={styles.time}>{`${clock(position)} / ${clock(duration)}`}</span>
      {next && (
        <>
          <span className={styles.rule} />
          <span className={styles.nextLabel}>Next</span>
          <UserAvatar className={styles.nextAvatar} avatarId={next.avatarId} size={80} />
          <span className={styles.nextName} translate='no'>{next.name}</span>
        </>
      )}
    </div>
  )
}

export default CornerPanel
