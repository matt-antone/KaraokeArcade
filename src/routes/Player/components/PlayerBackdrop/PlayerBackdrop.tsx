import React, { useEffect, useRef } from 'react'
import { BATTLE_STAGE_PLATE } from 'lib/battleSingers'
import createThreadField from './threadField'
import styles from './PlayerBackdrop.css'

interface PlayerBackdropProps {
  /** True while something opaque is drawn over the field. The field is *not*
   *  hidden when covered — it stops drawing entirely, which is most of a night. */
  isCovered: boolean
  /** 11b · the singer's own location, dimmed, behind the framed video. */
  stage?: string
}

const PlayerBackdrop = ({ isCovered, stage }: PlayerBackdropProps) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isCovered || !ref.current) return

    const field = createThreadField(ref.current)
    return () => field.stop()
  }, [isCovered])

  return (
    <>
      <canvas ref={ref} className={styles.threads} aria-hidden />
      {stage && (
        <>
          {/* the shared plate under the location, for a fighter with no art */}
          <div className={styles.stage} style={{ backgroundImage: `url('${stage}'), url('${BATTLE_STAGE_PLATE}')` }} />
          <div className={styles.dim} />
        </>
      )}
    </>
  )
}

export default PlayerBackdrop
