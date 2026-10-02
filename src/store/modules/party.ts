import { createAction, createReducer } from '@reduxjs/toolkit'
import { emptyParty, PARTY_PUSH, PARTY_REQUEST, type PartyState } from 'shared/party'
import { LOGOUT } from 'shared/actionTypes'
const push = createAction<PartyState>(PARTY_PUSH)
const success = createAction<PartyState>(PARTY_REQUEST + '_SUCCESS')
export const partyRequest = (operation: string, payload: Record<string, unknown> = {}) => ({ type: PARTY_REQUEST, payload: { operation, ...payload } })
export default createReducer(emptyParty, builder => builder
  .addCase(push, (state, { payload }) => ({ ...payload, resolvedQueueId: payload.round?.id === state.round?.id ? state.resolvedQueueId : undefined }))
  .addCase(success, (_state, { payload }) => payload)
  .addCase(createAction(LOGOUT), () => emptyParty))
