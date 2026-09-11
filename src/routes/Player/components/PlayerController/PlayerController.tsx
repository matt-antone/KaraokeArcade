import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Player from '../Player/Player'
import PlayerBackdrop from '../PlayerBackdrop/PlayerBackdrop'
import PlayerTextOverlay from '../PlayerTextOverlay/PlayerTextOverlay'
import PlayerQR from '../PlayerQR/PlayerQR'
import PlayerTrivia from '../PlayerTrivia/PlayerTrivia'
import PlayerBattle from '../PlayerBattle/PlayerBattle'
import TriviaMark from 'components/TriviaMark/TriviaMark'
import getRoundRobinQueue from 'routes/Queue/selectors/getRoundRobinQueue'
import { playerLeave, playerError, playerLoad, playerPlay, playerStatus, type PlayerState } from '../../modules/player'
import getRoomPrefs from '../../selectors/getRoomPrefs'
import useTriviaStage from 'lib/useTriviaStage'
import useBattleStage from 'lib/useBattleStage'
import { requestTriviaRound } from 'store/modules/trivia'
import { battleSongEnded, requestBattleTurn } from 'store/modules/battle'
import getSkipEndsAt, { INTERMISSION_MS } from './getSkipEndsAt'
import { SONG_PLAYED } from 'shared/actionTypes'
import { isBattleItem, isTriviaItem, type BattleSide, type QueueItem } from 'shared/types'

interface PlayerControllerProps {
  width: number
  height: number
}

// how long before a song ends to tease the next singer
const UP_NEXT_SECS = 15

/** How long the player holds a trivia row that has produced nothing before
 *  moving on. A question arrives in well under a second, so this only ever
 *  expires on a round that is genuinely lost. */
const TRIVIA_STRANDED_MS = 20000

/** How long the player waits for a battle beat that has not arrived before
 *  giving the room back.
 *
 *  Deliberately the same twenty seconds as trivia's, and not the five minutes a
 *  whole battle takes, because this timer is never armed while a beat is up:
 *  the server hands out one beat at a time, each carrying its own deadline, and
 *  the timer only starts once the beat on screen has expired with no successor.
 *  The longest legitimate silence it has to survive is therefore one round trip,
 *  not one song. Twenty seconds of a black screen is already far too long; five
 *  minutes of it is the night over. */
const BATTLE_STRANDED_MS = 20000

/** Whether this player could hear the room if it asked.
 *
 *  Read once at module load and kept, the way isWebGLSupported is: it cannot
 *  change while the page is open, and a capability re-derived at three call
 *  sites is a capability that eventually disagrees with itself. getUserMedia
 *  needs a secure context, and on an insecure origin navigator.mediaDevices is
 *  *undefined* rather than a promise that rejects — so reaching for
 *  .getUserMedia throws a TypeError rather than failing politely, which is why
 *  the feature detect comes first. The host's own http://localhost is a secure
 *  context and can do this; a player opened at a LAN address never can, and the
 *  server skips both metering beats for it rather than showing the room two
 *  dead meters. */
const CAN_HEAR_ROOM = typeof window !== 'undefined'
  && window.isSecureContext
  && !!navigator.mediaDevices?.getUserMedia

const PlayerController = (props: PlayerControllerProps) => {
  const queue = useAppSelector(getRoundRobinQueue)
  const player = useAppSelector(state => state.player)
  const playerVisualizer = useAppSelector(state => state.playerVisualizer)
  const prefs = useAppSelector(state => state.prefs)
  const roomPrefs = useAppSelector(getRoomPrefs)
  // Two views of the same round, and they are not interchangeable. The live
  // one expires with the countdown and drives *when* the player moves on; the
  // stored one persists between questions and drives *what is on screen*, so
  // the stage does not blink out during every reveal.
  const liveTrivia = useTriviaStage()
  const trivia = useAppSelector(state => state.trivia)
  const resolvedQueueId = trivia.resolvedQueueId
  // Same two views again for a battle, and for the same reason: the live beat
  // expires on its own deadline and decides *when* the row is over, while the
  // stored one is what tells a finished battle (the server clears it) apart
  // from a beat whose successor is still on the wire.
  const liveBattle = useBattleStage()
  const battle = useAppSelector(state => state.battle)
  const queueItem = queue.entities[player.queueId]
  const nextIdx = queue.result.indexOf(player.queueId) + 1
  const nextQueueItem = queue.entities[queue.result[nextIdx]]
  // the two singers after the next one, shown during the intermission
  const comingUpQueueItems = queue.result.slice(nextIdx + 1, nextIdx + 3).map(id => queue.entities[id])
  const comingUpSongTitles = useAppSelector(state => comingUpQueueItems.map(item => state.songs.entities[item.songId]?.title))
  const nextSong = useAppSelector(state => nextQueueItem ? state.songs.entities[nextQueueItem.songId] : undefined)
  const nextArtist = useAppSelector(state => nextSong ? state.artists.entities[nextSong.artistId] : undefined)
  // the corner panel names the singer *and* their song, so the player needs the current one too
  const song = useAppSelector(state => queueItem ? state.songs.entities[queueItem.songId] : undefined)
  const artist = useAppSelector(state => song ? state.artists.entities[song.artistId] : undefined)

  const dispatch = useAppDispatch()
  // set only when a song ends on its own; stays until the next one does. It's stamped with what
  // was playing so it can be *derived* away below instead of cleared (setState in an effect)
  const [intermission, setIntermission] = useState<{
    endsAt: number
    queueId: number
    replayTime: number
  } | null>(null)

  const isIntermission = !!intermission
    && intermission.queueId === player.queueId
    && intermission.replayTime === player._lastReplayTime

  const skipEndsAt = getSkipEndsAt(player, !!nextQueueItem, isIntermission)

  // A trivia round takes its turn in the gap between two singers, so while one
  // is running it *is* the intermission and the next song waits for it. The
  // reveal carries its own end so the room gets to see the answer and the
  // scoreboard before the music starts again.
  const intermissionEndsAt = skipEndsAt ?? (isIntermission ? intermission.endsAt : null)

  // The current queue row is a trivia round rather than a song. It takes its
  // turn exactly as a singer's row does: the player stops here, asks the
  // question, and moves on when the round is done.
  const isTriviaRow = isTriviaItem(queueItem)
  const isTriviaOnStage = isTriviaRow && trivia.round?.queueId === player.queueId

  // The mark holds the stage for the whole handover: the intermission that
  // hands it over, and the gap after the row goes current while the round is
  // asked for. One state rather than two, because they are one wait — the
  // intermission page and the mark were two screens for one thing.
  const isTriviaLeadIn = isTriviaRow || (!!intermissionEndsAt && isTriviaItem(nextQueueItem))

  // The same trio again for battles. A battle row takes its turn exactly as a
  // singer's does — the player stops here, asks the server to run it, and moves
  // on when the verdict is over — but where a trivia round is one screen, a
  // battle is nine beats, two of which are songs playing.
  const isBattleRow = isBattleItem(queueItem)
  const isBattleOnStage = isBattleRow && liveBattle.turn?.queueId === player.queueId

  // Which fighter is at the microphone right now, or null on the seven beats
  // that are not somebody singing. Read from the *live* beat rather than the
  // stored one on purpose: an expired sing1 must stop playing, not run on into
  // the intro that follows it.
  const battleSide: BattleSide | null = isBattleOnStage
    ? (liveBattle.phase === 'sing1' ? 1 : liveBattle.phase === 'sing2' ? 2 : null)
    : null

  // Which half of a battle row is at the microphone, resolved to one set of
  // media props.
  //
  // During sing2 every one of these has to come from the opponent* fields: it
  // is a different file, often in a different format, with its own replay gain.
  // The row's own mediaId/mediaType/rgTrack* describe the *challenger's* song —
  // a battle row is deliberately readable as an ordinary one — so driving the
  // media straight off queueItem plays song one twice and nobody notices until
  // the second fighter is standing there with the wrong words on screen.
  //
  // The key matters as much as the file. A media component reloads only when
  // mediaKey changes (componentDidUpdate), and one queue row is one queueId, so
  // both halves would share a key. The five-second intro2 splash sits exactly
  // between them and drops isMediaVisible, which unmounts the component and
  // makes componentDidMount load the new sources unconditionally — but a
  // distinct key is what makes the *volume* right too: Player uses a changed
  // mediaKey to hold off applying the next song's replay gain until it plays.
  // Negated rather than invented so it stays one row's key, and stays a number.
  const media = queueItem && (battleSide === 2
    ? {
        key: -queueItem.queueId,
        mediaId: queueItem.opponentMediaId,
        mediaType: queueItem.opponentMediaType,
        keyChange: queueItem.opponentKeyChange,
        rgTrackGain: queueItem.opponentRgTrackGain,
        rgTrackPeak: queueItem.opponentRgTrackPeak,
        isVideoKeyingEnabled: queueItem.opponentIsVideoKeyingEnabled,
      }
    : {
        key: queueItem.queueId,
        mediaId: queueItem.mediaId,
        mediaType: queueItem.mediaType,
        keyChange: queueItem.keyChange,
        rgTrackGain: queueItem.rgTrackGain,
        rgTrackPeak: queueItem.rgTrackPeak,
        isVideoKeyingEnabled: queueItem.isVideoKeyingEnabled,
      })

  // Player owns the page's AudioContext and stays mounted even on the beats
  // where its render returns null, so the crowd microphone can borrow it
  // instead of opening a third one — Chrome caps a document at about six and
  // never collects them, and lib/alertCue.ts already has the second. A getter
  // rather than the context itself because a ref may not be read during
  // render, and useCallback because it is an effect dependency in useCrowdMic:
  // a fresh arrow every render would restart the microphone on every tick.
  const playerRef = useRef<Player>(null)
  const getAudioCtx = useCallback(() => playerRef.current?.audioCtx ?? null, [])

  const handleStatus = useCallback((status?: Partial<PlayerState>) => dispatch(playerStatus(status)), [dispatch])
  const handleLoad = () => dispatch(playerLoad())
  const handlePlay = () => dispatch(playerPlay())
  const handleError = (msg: string) => {
    dispatch(playerError(msg))
    handleStatus()
  }

  const handleReplay = useCallback((queueId: number) => {
    const nextItem = queue.entities[queueId]
    if (!nextItem) return

    const history = JSON.parse(player.historyJSON)

    if (queueId !== player.queueId) {
      // reset history up to and including the replaying queueId
      const idx = history.lastIndexOf(queueId)
      if (idx !== -1) history.splice(idx)
    }

    handleStatus({
      historyJSON: JSON.stringify(history),
      isAtQueueEnd: false,
      isPlaying: true,
      isVideoKeyingEnabled: nextItem.isVideoKeyingEnabled,
      mediaType: nextItem.mediaType,
      position: 0,
      queueId: nextItem.queueId,
      nextUserId: null,
      _isReplayingQueueId: null,
    })
  }, [handleStatus, player.historyJSON, player.queueId, queue.entities])

  const handleLoadNext = useCallback(() => {
    const history = JSON.parse(player.historyJSON)

    // add current item to history (once)
    if (queueItem && history.lastIndexOf(queueItem.queueId) === -1) {
      history.push(queueItem.queueId)

      // a song counts as sung once it leaves the stage, however it left. A
      // skip is still a turn taken, and the singer who cut their own song
      // short should not have it missing from Sung Tonight. This is the one
      // path every song departs through, and addPlay upserts, so a replay
      // that comes back through here just refreshes dateSung.
      //
      // A trivia round departs through here too and is nobody's song. Said
      // out loud rather than left to addPlay's INNER JOIN quietly matching
      // nothing on a null songId, which works by accident and would stop
      // working the day that join changed.
      if (!isTriviaItem(queueItem)) {
        dispatch({ type: SONG_PLAYED, payload: { queueId: queueItem.queueId } })
      }
    }

    // queue exhausted?
    if (!nextQueueItem) {
      handleStatus({
        historyJSON: JSON.stringify(history),
        isAtQueueEnd: true,
        mediaType: null,
        _isPlayingNext: false,
      })

      return
    }

    // play next
    handleStatus({
      historyJSON: JSON.stringify(history),
      isAtQueueEnd: false,
      isPlaying: true,
      isVideoKeyingEnabled: nextQueueItem.isVideoKeyingEnabled,
      mediaType: nextQueueItem.mediaType,
      position: 0,
      queueId: nextQueueItem.queueId,
      nextUserId: null,
      _isPlayingNext: false,
    })
  }, [dispatch, handleStatus, nextQueueItem, player.historyJSON, queueItem])

  // the queue can change while we're waiting, so the timer calls the latest handleLoadNext
  const loadNextRef = useRef(handleLoadNext)
  useEffect(() => {
    loadNextRef.current = handleLoadNext
  }, [handleLoadNext])

  // song finished on its own: hold for the intermission before loading the next one
  const handleMediaEnd = useCallback(() => {
    // A battle's song running out is not the end of the row. The server owns
    // the sequence, so the player only reports which half finished and waits
    // for the next beat. Falling through to the intermission below would set a
    // 15s countdown and hand the row to handleLoadNext, which is the wrong
    // destination halfway through a fight.
    if (battleSide) {
      dispatch(battleSongEnded(player.queueId, battleSide))
      return
    }

    // Neither the history dispatch nor a timer to clear lives here any more:
    // a song is recorded as sung on the way out through handleLoadNext, and
    // the intermission's timer is owned by the effect below so it can re-arm
    // when a trivia round claims the gap.

    // nothing to wait for at the end of the queue
    if (!nextQueueItem) {
      handleLoadNext()
      return
    }

    setIntermission({
      endsAt: Date.now() + INTERMISSION_MS,
      queueId: player.queueId,
      replayTime: player._lastReplayTime,
    })
  }, [battleSide, dispatch, handleLoadNext, nextQueueItem, player.queueId, player._lastReplayTime])

  // Reached a trivia row: ask the room's question. The server decides whether
  // there is one to ask — it owns the shuffle and the countdown, so two
  // players in a room cannot disagree about the answer.
  useEffect(() => {
    if (!isTriviaRow || !player.isPlaying) return
    if (resolvedQueueId === player.queueId) return

    dispatch(requestTriviaRound(player.queueId))
  }, [dispatch, isTriviaRow, player.isPlaying, player.queueId, resolvedQueueId])

  // The round is done with this row — its last question has been answered and
  // revealed, or there was nothing to ask. Both halves are needed: the resolve
  // alone would cut the final scoreboard off, and the expiry alone would move
  // on in the gap between asking and the first question arriving.
  useEffect(() => {
    if (!isTriviaRow) return
    if (liveTrivia.round || liveTrivia.result) return // reveal still on screen

    if (resolvedQueueId === player.queueId) {
      handleLoadNext()
      return
    }

    // Nothing on screen and nothing resolved: the round this row was promised
    // is not coming. A server restart takes its in-memory rounds with it, and
    // the row was marked played the moment the round began, so no later
    // request can revive it — the reply is "that is not the row waiting". The
    // player was left holding a dead row with no timeout and no error, and the
    // queue stopped for the rest of the night. A round is worth one gap, never
    // the party.
    if (!player.isPlaying) return

    const timerID = setTimeout(() => loadNextRef.current(), TRIVIA_STRANDED_MS)
    return () => clearTimeout(timerID)
  }, [
    handleLoadNext,
    isTriviaRow,
    liveTrivia.result,
    liveTrivia.round,
    player.isPlaying,
    player.queueId,
    resolvedQueueId,
  ])

  // Reached a battle row: ask the server to run it, and tell it whether this
  // player can hear the room. The server owns every beat boundary — two players
  // in a room cannot disagree about who is singing — and it owns the choice of
  // how the fight is judged, which is a room pref. The answer here only bears
  // on a room set to crowd scoring: a no there skips both metering beats rather
  // than showing the room two dead meters.
  useEffect(() => {
    if (!isBattleRow || !player.isPlaying) return
    if (battle.resolvedQueueId === player.queueId) return

    dispatch(requestBattleTurn(player.queueId, CAN_HEAR_ROOM))
  }, [battle.resolvedQueueId, dispatch, isBattleRow, player.isPlaying, player.queueId])

  // The row is done with, or was never going to happen.
  //
  // Three endings, and they need telling apart. A battle that ran is over when
  // the server clears it: the stored turn goes null, which it never does
  // between beats, so seeing this row's beat and then seeing nothing means the
  // verdict has been given. A row the server declined resolves instead. Anything
  // else is a battle that stopped talking, and gets the fail-safe — armed only
  // once the beat on screen has expired, so the timer never runs against a
  // singing beat's own two-minute deadline.
  //
  // Stamped with the replay time as well as the row, because a battle that has
  // been fought once and is then replayed is a battle that has to be fought
  // again — on the row alone, the replay would see its own past and advance
  // before a single beat arrived.
  const sawBattleRef = useRef('')
  const battleRun = `${player.queueId}:${player._lastReplayTime}`

  useEffect(() => {
    if (!isBattleRow || !player.isPlaying) return

    if (liveBattle.turn) {
      if (liveBattle.turn.queueId === player.queueId) sawBattleRef.current = battleRun
      return
    }

    const isSpent = sawBattleRef.current === battleRun && !battle.turn
    if (isSpent || battle.resolvedQueueId === player.queueId) {
      handleLoadNext()
      return
    }

    const timerID = setTimeout(() => loadNextRef.current(), BATTLE_STRANDED_MS)
    return () => clearTimeout(timerID)
  }, [
    battle.resolvedQueueId,
    battle.turn,
    battleRun,
    handleLoadNext,
    isBattleRow,
    liveBattle.turn,
    player.isPlaying,
    player.queueId,
  ])

  // "lock in" the next user that isn't the currently up user, if possible
  useEffect(() => {
    if (!player.nextUserId || queueItem?.userId === nextQueueItem?.userId) {
      for (let i = queue.result.indexOf(queueItem?.queueId) + 1; i < queue.result.length; i++) {
        if (queueItem?.userId !== queue.entities[queue.result[i]].userId) {
          handleStatus({ nextUserId: queue.entities[queue.result[i]].userId })
          return
        }
      }
    }
  }, [handleStatus, nextQueueItem, player.nextUserId, queue, queueItem])

  // always emit status when any of these change
  useEffect(() => handleStatus({ isVideoKeyingEnabled: media?.isVideoKeyingEnabled }), [
    handleStatus,
    media?.isVideoKeyingEnabled,
    player.cdgAlpha,
    player.cdgSize,
    player.isPlaying,
    player.mp4Alpha,
    player.volume,
    playerVisualizer,
  ])

  // The intermission's own timer, owned by an effect rather than a ref so it
  // re-arms whenever the end moves — which is exactly what a trivia round
  // claiming the gap does. Same shape as the skip timer below.
  useEffect(() => {
    if (skipEndsAt || !isIntermission || !intermissionEndsAt) return

    const timerID = setTimeout(() => loadNextRef.current(), Math.max(0, intermissionEndsAt - Date.now()))
    return () => clearTimeout(timerID)
  }, [intermissionEndsAt, isIntermission, skipEndsAt])

  // on unmount
  useEffect(() => () => {
    dispatch(playerLeave())
  }, [dispatch])

  // playing for first time?
  useEffect(() => {
    if (player.isPlaying && player.queueId === -1) {
      handleLoadNext()
    }
  }, [handleLoadNext, player.isPlaying, player.queueId])

  useEffect(() => {
    if (!player._isPlayingNext) return

    if (!skipEndsAt) {
      handleLoadNext()
      return
    }

    const timerID = setTimeout(() => loadNextRef.current(), Math.max(0, skipEndsAt - Date.now()))
    return () => clearTimeout(timerID)
  }, [handleLoadNext, player._isPlayingNext, skipEndsAt])

  // history reset? empty the played list and push it, so the library's
  // greyed-out rows come back to life for everyone in the room
  useEffect(() => {
    if (player._lastHistoryResetTime) {
      handleStatus({ historyJSON: '[]' })
    }
  }, [handleStatus, player._lastHistoryResetTime])

  // replaying?
  useEffect(() => {
    if (player._isReplayingQueueId !== null) {
      handleReplay(player._isReplayingQueueId)
    }
  }, [handleReplay, player._isReplayingQueueId])

  // queue was exhausted, but is no longer?
  useEffect(() => {
    if (player.isAtQueueEnd && nextQueueItem && player.isPlaying) {
      handleLoadNext()
    }
  }, [handleLoadNext, player.isPlaying, player.isAtQueueEnd, nextQueueItem])

  // retrying after error?
  useEffect(() => {
    if (player.isErrored && player.isPlaying) {
      handleStatus({ isErrored: false })
    }
  }, [handleStatus, player.isErrored, player.isPlaying])

  // the media layer covers the stage completely; the thread field behind it stops
  // drawing whenever it does — and the mark's card is opaque too, so a lead-in
  // stops it for the same reason
  //
  // A battle row shows media on two of its nine beats and nothing but this
  // overlay on the other seven. Unmounting IS the stop: the element leaves the
  // document and the UA pauses it per spec, which is why there is no pause()
  // call anywhere in this file and why the two-minute cut needs no new one.
  const isMediaVisible = !!queueItem && !isTriviaRow && !player.isErrored && !player.isAtQueueEnd
    && !intermissionEndsAt && (!isBattleRow || battleSide !== null)

  return (
    <>
      {/* A battle overlay is opaque on seven of its nine beats and the media
          covers the other two, so the thread field has to stop for the whole
          row — otherwise it burns a core behind the fight for five minutes. */}
      <PlayerBackdrop isCovered={isMediaVisible || isTriviaLeadIn || isBattleRow} />
      <Player
        ref={playerRef}
        cdgAlpha={player.cdgAlpha}
        cdgSize={player.cdgSize}
        isPlaying={player.isPlaying}
        isVisible={isMediaVisible}
        keyChange={media?.keyChange ?? 0}
        isReplayGainEnabled={prefs.isReplayGainEnabled}
        isVideoKeyingEnabled={!!media?.isVideoKeyingEnabled}
        isWebGLSupported={player.isWebGLSupported}
        mediaId={media ? media.mediaId : null}
        mediaKey={media ? media.key : null}
        mediaReplayKey={player._lastReplayTime}
        mediaType={media ? media.mediaType : null}
        mp4Alpha={player.mp4Alpha}
        onEnd={handleMediaEnd}
        onError={handleError}
        onLoad={handleLoad}
        onPlay={handlePlay}
        onStatus={handleStatus}
        rgTrackGain={media ? media.rgTrackGain : null}
        rgTrackPeak={media ? media.rgTrackPeak : null}
        visualizer={playerVisualizer}
        volume={player.volume}
        width={props.width}
        height={props.height}
      />
      {/* A round owns the whole stage for its turn, so the text overlay stands
          down rather than drawing a countdown behind it. */}
      {isTriviaOnStage
        ? (
            <PlayerTrivia
              key={trivia.round.roundId}
              round={trivia.round}
              result={trivia.result}
              width={props.width}
              height={props.height}
            />
          )
        : isBattleRow
          ? (
              /* A battle owns the stage for its whole row, including the gap
                 before the server's first beat lands — PlayerBattle draws its
                 own holding card for that, the way the trivia mark covers a
                 round's lead-in. The text overlay stands down for the same
                 reason it does for a round. */
              <PlayerBattle
                queueId={player.queueId}
                getAudioCtx={getAudioCtx}
                width={props.width}
                height={props.height}
              />
            )
          : (
              <>
                {/* One mount across the whole lead-in. Rendering the mark from
                  the intermission branch and again from the row's would replay
                  the sting the moment the row went current, and the question
                  would cut the replay off halfway. */}
                {isTriviaLeadIn && <TriviaMark variant='stage' />}
                {!isTriviaRow && (
                  <PlayerTextOverlay
                    queueItem={queueItem as QueueItem}
                    nextQueueItem={nextQueueItem as QueueItem}
                    comingUpQueueItems={comingUpQueueItems as QueueItem[]}
                    comingUpSongTitles={comingUpSongTitles}
                    songTitle={song?.title}
                    songArtist={artist?.name}
                    nextSongTitle={nextSong?.title}
                    nextSongArtist={nextArtist?.name}
                    queueDepth={Math.max(0, queue.result.length - nextIdx)}
                    isSongEnding={player.duration > 0 && player.duration - player.position <= UP_NEXT_SECS}
                    isAtQueueEnd={player.isAtQueueEnd}
                    isQueueEmpty={!queue.result.length}
                    intermissionEndsAt={intermissionEndsAt}
                    isErrored={player.isErrored}
                    width={props.width}
                    height={props.height}
                  />
                )}
              </>
            )}
      {roomPrefs?.qr?.isEnabled && (
        <PlayerQR
          height={props.height}
          prefs={roomPrefs.qr}
          queueItem={queueItem}
        />
      )}
    </>
  )
}

export default PlayerController
