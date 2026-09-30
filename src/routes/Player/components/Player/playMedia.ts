/**
 * play() on a media element, reporting a refusal the way the player needs it
 * told apart: the browser's autoplay block is a tap on the TV away (SoundGate),
 * anything else is the media failing.
 */
export default function playMedia (
  el: HTMLMediaElement,
  { onError, onBlocked }: { onError(error: string): void, onBlocked?(): void },
): void {
  el.play().catch((err: Error) => (err.name === 'NotAllowedError' && onBlocked
    ? onBlocked()
    : onError(err.message)))
}
