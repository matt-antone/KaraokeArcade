import { useEffect, useState } from 'react'
import socket from 'lib/socket'

interface SocketStatus {
  /** `connecting` until the socket has answered once; `lost` from any drop or
   *  failed attempt until it is back. */
  state: 'connecting' | 'online' | 'lost'
  /** Which reconnect attempt is under way, 0 before the first. */
  attempt: number
}

/**
 * Whether the socket is up. Nothing in the store knows — the socket lives in
 * lib/socket and only the middleware talks to it — so the layout listens to it
 * directly rather than mirroring a flag into redux nobody else reads.
 */
const useSocketStatus = (): SocketStatus => {
  const [status, setStatus] = useState<SocketStatus>({
    state: socket.connected ? 'online' : 'connecting',
    attempt: 0,
  })

  useEffect(() => {
    const onConnect = () => setStatus({ state: 'online', attempt: 0 })
    const onLost = () => setStatus(prev => ({ ...prev, state: 'lost' }))
    const onAttempt = (attempt: number) => setStatus({ state: 'lost', attempt })

    socket.on('connect', onConnect)
    socket.on('disconnect', onLost)
    socket.on('connect_error', onLost)
    socket.io.on('reconnect_attempt', onAttempt)

    // a connect that landed between render and effect
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onLost)
      socket.off('connect_error', onLost)
      socket.io.off('reconnect_attempt', onAttempt)
    }
  }, [])

  return status
}

export default useSocketStatus
