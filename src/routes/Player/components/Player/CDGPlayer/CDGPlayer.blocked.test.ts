// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import CDGPlayer from './CDGPlayer'

// play() refused by the browser's autoplay policy is a tap away, not a bad
// file: it must reach onBlocked (the TV's SoundGate), never "Media failed".
const playerWith = (rejection: Error) => {
  const props = { isPlaying: true, onError: vi.fn(), onBlocked: vi.fn() }
  const player = new CDGPlayer(props as unknown as ConstructorParameters<typeof CDGPlayer>[0])
  player.audio = { current: { play: () => Promise.reject(rejection) } } as unknown as typeof player.audio
  return { player, props }
}

const named = (name: string, message: string) => Object.assign(new Error(message), { name })

describe('CDGPlayer play() refusals', () => {
  it('reports an autoplay block as blocked, not as a media error', async () => {
    const { player, props } = playerWith(named('NotAllowedError', 'play() failed because the user didn\'t interact'))

    player.updateIsPlaying()
    await vi.waitFor(() => expect(props.onBlocked).toHaveBeenCalledOnce())
    expect(props.onError).not.toHaveBeenCalled()
  })

  it('still reports any other refusal as a media error', async () => {
    const { player, props } = playerWith(named('NotSupportedError', 'no supported source'))

    player.updateIsPlaying()
    await vi.waitFor(() => expect(props.onError).toHaveBeenCalledWith('no supported source'))
    expect(props.onBlocked).not.toHaveBeenCalled()
  })
})
