import React from 'react'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import CDGPlayer from './CDGPlayer/CDGPlayer'
import MP4Player from './MP4Player/MP4Player'
import MP4AlphaPlayer from './MP4Player/MP4AlphaPlayer'
import { type PlayerState } from '../../modules/player'
import { type PlayerVisualizerState } from '../../modules/playerVisualizer'

const PlayerVisualizer = React.lazy(() => import('./PlayerVisualizer/PlayerVisualizer'))

interface PlayerProps {
  cdgAlpha: number
  cdgSize: number
  /** Semitones to shift the current song; 0 plays the recording untouched. */
  keyChange: number
  isPlaying: boolean
  isVisible: boolean
  isReplayGainEnabled: boolean
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  mediaId: number
  mediaKey: number
  mediaReplayKey?: number
  mediaType?: string
  mp4Alpha: number
  rgTrackGain?: number
  rgTrackPeak?: number
  visualizer: PlayerVisualizerState
  volume: number
  width: number
  height: number
  // media events
  onEnd(): void
  onError(error: string): void
  onLoad(): void
  onPlay(): void
  onStatus(status: Partial<PlayerState>): void
}

interface State {
  visualizerAudioSourceNode: MediaElementAudioSourceNode | null
}

class Player extends React.Component<PlayerProps> {
  audioCtx: AudioContext | null = null
  audioGainNode: GainNode | null = null
  audioSourceNode: MediaElementAudioSourceNode | null = null
  isFetching = false // internal

  // Pitch shifting is opt-in per song, so none of this exists until a singer
  // actually asks for a key: the worklet module is fetched on first use and
  // the node is built after it lands.
  pitchNode: SoundTouchNode | null = null
  pitchModule: Promise<void> | null = null
  /** Which way audio currently reaches the gain node, so we can disconnect
   *  exactly what we connected. */
  route: 'direct' | 'pitch' | null = null

  state: State = {
    visualizerAudioSourceNode: null,
  }

  componentDidMount () {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      this.audioGainNode = this.audioCtx.createGain()
      this.audioGainNode.connect(this.audioCtx.destination)
    }

    this.updateVolume()
  }

  componentDidUpdate (prevProps: PlayerProps) {
    // may have been suspended by browser if no user interaction yet
    if (this.props.isPlaying && !prevProps.isPlaying) {
      this.audioCtx?.resume()
    }

    // prevent applying next song's RG vals prematurely
    if (this.props.mediaKey !== prevProps.mediaKey) {
      this.isFetching = true
    }

    // don't change volume if we know we're changing songs
    if (!this.isFetching && (prevProps.volume !== this.props.volume
      || prevProps.rgTrackGain !== this.props.rgTrackGain
      || prevProps.rgTrackPeak !== this.props.rgTrackPeak
      || prevProps.isReplayGainEnabled !== this.props.isReplayGainEnabled)) {
      this.updateVolume()
    }

    if (prevProps.keyChange !== this.props.keyChange) {
      this.applyKeyChange()
    }
  }

  componentWillUnmount () {
    this.pitchNode?.disconnect()
  }

  handleAudioElement = (el: HTMLVideoElement | HTMLAudioElement) => {
    if (!this.audioCtx || (this.audioSourceNode && this.audioSourceNode.mediaElement === el)) {
      return
    }

    // A fresh song gets a fresh pitch node: the old one still holds the tail of
    // the last song in its buffer, and reusing it would bleed those frames into
    // the first moments of this one. Building one is cheap once the worklet
    // module is registered, which it stays for the life of the context.
    this.pitchNode?.disconnect()
    this.pitchNode = null
    this.route = null

    this.audioSourceNode = this.audioCtx.createMediaElementSource(el)
    this.applyKeyChange()

    // hand back copy of original audio source
    const sourceNodeCopy = this.audioSourceNode
    this.setState({ visualizerAudioSourceNode: sourceNodeCopy })
  }

  /**
   * Point the source at the gain node, through the pitch node when a key is
   * set. Disconnects are targeted rather than blanket: the visualizer taps the
   * same source node, and a bare disconnect() would cut its feed too.
   */
  routeAudio = () => {
    const { audioCtx, audioGainNode, audioSourceNode, pitchNode } = this
    if (!audioCtx || !audioGainNode || !audioSourceNode) return

    const next = (pitchNode && this.props.keyChange !== 0) ? 'pitch' : 'direct'
    if (next === this.route) return

    if (this.route === 'pitch' && pitchNode) {
      audioSourceNode.disconnect(pitchNode)
      pitchNode.disconnect(audioGainNode)
    } else if (this.route === 'direct') {
      audioSourceNode.disconnect(audioGainNode)
    }

    if (next === 'pitch' && pitchNode) {
      audioSourceNode.connect(pitchNode)
      pitchNode.connect(audioGainNode)
    } else {
      audioSourceNode.connect(audioGainNode)
    }

    this.route = next
  }

  /**
   * A song in its own key stays on the direct path — no worklet, no added
   * latency, and audio that is bit-identical to before this feature existed.
   * That is the overwhelmingly common case, so it must cost nothing.
   *
   * ponytail: a shifted song picks up the phase vocoder's fixed buffering
   * latency against the CDG/video track. Constant, well under a frame at 48k,
   * and unmeasured on Pi-class hardware — if it ever reads as lip-sync drift,
   * the fix is to delay the graphics by the node's reported latency, not to
   * chase it here.
   */
  applyKeyChange = async () => {
    if (this.props.keyChange === 0) {
      this.routeAudio()
      return
    }

    try {
      await this.ensurePitchNode()
    } catch (err) {
      // stay on the direct path: the recording's key beats silence
      this.props.onError(`Could not change key: ${(err as Error).message}`)
      return
    }

    // the module fetch is async; the singer may have stepped again since
    if (this.pitchNode) this.pitchNode.pitchSemitones.value = this.props.keyChange
    this.routeAudio()
  }

  ensurePitchNode = async (): Promise<void> => {
    if (this.pitchNode || !this.audioCtx) return

    if (!this.audioCtx.audioWorklet) {
      throw new Error('this browser has no AudioWorklet')
    }

    // Loaded on demand: the package extends AudioWorkletNode at module scope,
    // which does not exist on insecure origins (a LAN IP over http), so a
    // static import would take the whole player down before playback starts.
    const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')

    // registered once per context, not once per song
    this.pitchModule ??= SoundTouchNode.register(
      this.audioCtx,
      new URL('@soundtouchjs/audio-worklet/processor', import.meta.url),
    )
    await this.pitchModule

    // handleAudioElement may have torn things down while the module loaded
    if (this.pitchNode || !this.audioCtx) return
    this.pitchNode = new SoundTouchNode({ context: this.audioCtx })
  }

  handlePlay = () => {
    this.isFetching = false
    this.updateVolume()
    this.props.onPlay()
  }

  updateVolume = () => {
    let vol = this.props.volume
    const { isReplayGainEnabled, rgTrackGain, rgTrackPeak } = this.props

    if (isReplayGainEnabled && typeof rgTrackGain === 'number' && typeof rgTrackPeak === 'number') {
      const gainDb = this.props.rgTrackGain
      const peakDb = 20 * Math.log10(this.props.rgTrackPeak) // linear amplitude factor to dB
      const safeGainDb = (gainDb + peakDb >= 0) ? -0.01 - peakDb : gainDb

      vol = vol * Math.pow(10, safeGainDb / 20) // dB to linear amplitude factor
    }

    if (this.audioCtx && this.audioGainNode) {
      this.audioGainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime)
    }
  }

  render () {
    if (!this.props.isVisible || typeof this.props.mediaId !== 'number') return null

    // One component type rather than a union of the three classes: a union has
    // no single construct signature, so TypeScript refuses it as a JSX tag.
    // The props stay a union because the three players want overlapping but
    // unequal sets, and the spread below satisfies all of them.
    let PlayerComponent: React.ComponentClass<
      React.ComponentProps<typeof CDGPlayer>
      | React.ComponentProps<typeof MP4Player>
      | React.ComponentProps<typeof MP4AlphaPlayer>
    > | undefined

    if (this.props.mediaType === 'cdg') PlayerComponent = CDGPlayer
    else if (this.props.mediaType === 'mp4') PlayerComponent = this.props.isVideoKeyingEnabled ? MP4AlphaPlayer : MP4Player

    if (typeof PlayerComponent === 'undefined') {
      this.props.onError(`No player for mediaType: ${this.props.mediaType}`)
      return null
    }

    const isVisualizerActive = (this.props.mediaType === 'cdg' || this.props.isVideoKeyingEnabled)
      && this.props.isWebGLSupported
      && this.props.visualizer.isEnabled
      && this.state.visualizerAudioSourceNode

    return (
      <>
        <PlayerComponent
          {...this.props}
          onAudioElement={this.handleAudioElement}
          onPlay={this.handlePlay}
        />
        {isVisualizerActive && (
          <PlayerVisualizer
            audioSourceNode={this.state.visualizerAudioSourceNode}
            isPlaying={this.props.isPlaying}
            onError={this.props.onError}
            presetKey={this.props.visualizer.presetKey}
            sensitivity={this.props.visualizer.sensitivity}
            width={this.props.width}
            height={this.props.height}
          />
        )}
      </>
    )
  }
}

export default Player
