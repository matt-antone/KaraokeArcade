import { Action, Middleware, UnknownAction } from '@reduxjs/toolkit'
import { BEGIN, COMMIT, REVERT } from 'redux-optimistic-ui'
import { PLAYER_EMIT_STATUS, SOCKET_AUTH_ERROR } from 'shared/actionTypes'
import { Socket } from 'socket.io-client'
import type { OptimisticAction } from './store'

// optimistic actions need a transaction id to match BEGIN to COMMIT/REVERT
let transactionID = 0

export default function createSocketMiddleware (socket: Socket, prefix: string): Middleware {
  return (store) => {
    // attach handler for incoming actions (from server)
    socket.on('action', action => store.dispatch(action))

    return next => (action: Action | OptimisticAction) => {
      // dispatch normally if it's not a socket.io request
      if (!action.type || !action.type.startsWith(prefix)) {
        return next(action)
      }

      const hasMeta = 'meta' in action
      const isOptimistic = hasMeta && (action.meta?.isOptimistic ?? false)

      // Claim this action's transaction id NOW, before emitting. The
      // acknowledgement fires later, and by then another optimistic action may
      // have incremented the counter — reading it inside the callback applied
      // the COMMIT/REVERT to whichever transaction happened to be last, so a
      // rejected star could survive while an unrelated in-flight one was
      // rolled back.
      const txId = isOptimistic ? ++transactionID : undefined

      // The TV's status carries its lead-in's end by its own clock (12e0).
      // Stamped here, as it actually leaves (after the throttle, which can
      // hold it a second), so the server can rebase it onto its own clock.
      const sent = action.type === PLAYER_EMIT_STATUS
        ? { ...action, payload: { ...(action as { payload?: object }).payload, sentAt: Date.now() } }
        : action

      socket.emit('action', sent, (cbAction: UnknownAction) => {
        // make sure callback response is an action
        if (typeof cbAction !== 'object' || typeof cbAction.type !== 'string') {
          return
        }

        if (isOptimistic) {
          // An auth failure is a rejection even though it carries no `error`:
          // the server refused the action outright, so anything applied
          // optimistically has to come back off. user and userStars happen to
          // mask this by resetting to initialState, but queue does not — a
          // refused QUEUE_ADD would stay applied and leak a transaction that
          // can never resolve.
          const isRejected = !!cbAction.error || cbAction.type === SOCKET_AUTH_ERROR

          cbAction.meta = {
            ...('meta' in cbAction && typeof cbAction.meta === 'object' ? cbAction.meta : {}),
            optimistic: isRejected ? { type: REVERT, id: txId } : { type: COMMIT, id: txId },
          }
        }

        next(cbAction)
      })

      if (!isOptimistic) {
        return next(action)
      }

      // don't mutate action because we don't need to
      // emit this meta info to the server
      next({
        ...action,
        meta: {
          ...action.meta,
          optimistic: { type: BEGIN, id: txId },
        },
      })
    }
  }
}
