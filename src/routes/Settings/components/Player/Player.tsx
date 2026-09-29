import React, { useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setPref } from 'store/modules/prefs'
import { requestOptions } from 'store/modules/status'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import PlaybackCtrl from './PlaybackCtrl/PlaybackCtrl'
import DisplayCtrl from './DisplayCtrl/DisplayCtrl'
import JoinCode from './JoinCode/JoinCode'
import { HeadKey } from '../PanelHead/PanelHead'
import styles from './Player.css'
import { PlaybackOptions } from 'shared/types'

/**
 * Everything about the player lives here and nowhere else: its status, the key
 * that opens it, and — behind Manage — its display options and the room
 * transport. It is a room
 * fixture the host sets up once on the machine driving the audio, not a place
 * anyone navigates to — so there is no Player tab, no player entry in the
 * bottom nav, and no transport in the app header.
 */
const Player = () => {
  const [isManaging, setManaging] = useState(false)
  const [isDisplayCtrlVisible, setDisplayCtrlVisible] = useState(false)
  const [isJoinCodeVisible, setJoinCodeVisible] = useState(false)

  const status = useAppSelector(state => state.status)
  const isPlayerPresent = status.isPlayerPresent
  const isReplayGainEnabled = useAppSelector(state => state.prefs.isReplayGainEnabled)
  const serverUrl = useAppSelector(state => state.prefs.serverUrl)
  const roomId = useAppSelector(state => state.user.roomId)
  const room = useAppSelector(state => (roomId === null ? undefined : state.rooms.entities[roomId]))
  const roomName = room?.name

  const dispatch = useAppDispatch()
  const handleReplayGain = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: e.currentTarget.name, data: e.currentTarget.checked }))
  }
  const handleOptions = (opts: PlaybackOptions) => dispatch(requestOptions(opts))
  const toggleDisplayCtrl = () => setDisplayCtrlVisible(!isDisplayCtrlVisible)
  const toggleJoinCode = () => setJoinCodeVisible(!isJoinCodeVisible)

  return (
    <Panel
      title='Player'
      titleComponent={<HeadKey isOn={isManaging} onClick={() => setManaging(!isManaging)} />}
      contentClassName={styles.content}
    >
      <>
        <div className={styles.status}>
          <span className={clsx(styles.lamp, isPlayerPresent && styles.lit)} />
          <span className={styles.statusText} translate='no'>
            {isPlayerPresent ? 'connected' : 'no player in room'}
            {roomName && ` · ${roomName}`}
          </span>
        </div>

        <p className={styles.blurb}>
          Runs fullscreen on whatever machine drives the room&rsquo;s audio. Open it there, or
          scan the join code it shows.
        </p>

        <div className={styles.keys}>
          <Link to='/player' target='_blank' className={styles.openKey}>
            Open player here
          </Link>

          <Button className={styles.joinKey} variant='default' onClick={toggleJoinCode}>
            Show join code
          </Button>
        </div>

        {isJoinCodeVisible && roomId !== null && (
          <JoinCode
            roomId={roomId}
            serverUrl={serverUrl}
            qrPassword={room?.prefs?.qr?.password}
            onClose={toggleJoinCode}
          />
        )}

        {/* The admin extras the design leaves out, behind Manage: the room
            transport (only with a player to drive), ReplayGain, and the
            display options, which stay reachable with no player connected. */}
        {isManaging && (
          <>
            {isPlayerPresent && <PlaybackCtrl />}

            <InputCheckbox
              label='ReplayGain (clip-safe)'
              name='isReplayGainEnabled'
              checked={isReplayGainEnabled}
              onChange={handleReplayGain}
            />

            <Button variant='default' icon='TUNE' onClick={toggleDisplayCtrl}>
              Display
            </Button>
          </>
        )}

        {isDisplayCtrlVisible && (
          <DisplayCtrl
            cdgAlpha={status.cdgAlpha}
            cdgSize={status.cdgSize}
            isVideoKeyingEnabled={status.isVideoKeyingEnabled}
            isVisualizerEnabled={status.visualizer.isEnabled}
            isWebGLSupported={status.isWebGLSupported}
            mediaType={status.mediaType}
            mp4Alpha={status.mp4Alpha}
            onClose={toggleDisplayCtrl}
            onRequestOptions={handleOptions}
            sensitivity={status.visualizer.sensitivity}
            visualizerPresetName={status.visualizer.presetName}
          />
        )}
      </>
    </Panel>
  )
}

export default Player
