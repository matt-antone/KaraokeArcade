/**
 * Client-side navigation for code that is not a component.
 *
 * A thunk that needs to move the app — signing in with a `redirect` in the
 * query string is the one that does — cannot reach for AppRouter directly.
 * AppRouter renders <App/>, App reaches the store, and the store reaches the
 * thunk: importing it back closes a cycle through nearly every screen in the
 * app. That was survived with a dynamic import inside the thunk and a comment
 * saying it "only works by luck of evaluation order", which is an accurate
 * description of a bug waiting for an unrelated import to be reordered.
 *
 * This module imports nothing, so nothing can cycle through it. AppRouter
 * hands its navigate in on the way up; callers ask for it here.
 *
 * A no-op before the router exists, deliberately. The only caller runs from a
 * user's tap, which cannot happen before the app has rendered — and a missed
 * redirect is a worse thing to crash over than to skip.
 */
type Navigate = (to: string) => void

let navigateTo: Navigate | null = null

export function setNavigate (fn: Navigate): void {
  navigateTo = fn
}

export function navigate (to: string): void {
  navigateTo?.(to)
}
