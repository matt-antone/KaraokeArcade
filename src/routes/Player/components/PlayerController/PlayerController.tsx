import { isPartyItem, gameLabel } from 'shared/party'
import { partyRequest } from 'store/modules/party'
import { RoundContent } from 'components/Party/Party'
import partyStyles from 'components/Party/Party.css'
import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Player from '../Player/Player'
import PlayerBackdrop from '../PlayerBackdrop/PlayerBackdrop'
import PlayerTextOverlay from '../PlayerTextOverlay/PlayerTextOverlay'
import overlayState from '../PlayerTextOverlay/overlayState'
import PlayerQR from '../PlayerQR/PlayerQR'
import PlayerJoin from '../PlayerJoin/PlayerJoin'
import PlayerTrivia, { PlayerTriviaSplash } from '../PlayerTrivia/PlayerTrivia'
import PlayerBattle from '../PlayerBattle/PlayerBattle'
import type { BattleUpNext } from '../PlayerBattle/battleBeats'
import PlayerFrame from './PlayerFrame'
import SoundGate from './SoundGate'
import frameStyles from './PlayerFrame.css'
import getRoundRobinQueue from 'routes/Queue/selectors/getRoundRobinQueue'
import { playerLeave, playerError, playerLoad, playerPlay, playerStatus, type PlayerState } from '../../modules/player'
import getRoomPrefs from '../../selectors/getRoomPrefs'
import { scoredLeaderboard } from 'store/selectors/points'
import useTriviaStage from 'lib/useTriviaStage'
import useBattleStage from 'lib/useBattleStage'
import { requestTriviaRound } from 'store/modules/trivia'
import { battleSongEnded, requestBattleTurn } from 'store/modules/battle'
import getSkipEndsAt, { INTERMISSION_MS } from './getSkipEndsAt'
import { getBattleSide, getIsMediaVisible, getIsRowOnStage, mediaStage, resolveMedia } from './playerStage'
import { battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import { SONG_PLAYED } from 'shared/actionTypes'
import {
  isBattleItem, isTriviaItem, rotationIdOf,
  type QueueItem, type TriviaResult, type TriviaRound,
} from 'shared/types'

interface PlayerControllerProps {
  width: number
  height: number
}

/** How long the player holds a trivia row that has produced nothing before
 *  moving on. A primed round arrives in well under a second, but one fetched
 *  on arrival is a request per difficulty six seconds apart (server/Trivia/
 *  Questions.ts) — near twenty with a token to get first — so this sits
 *  clear of that and only ever expires on a round that is genuinely lost. */
const TRIVIA_STRANDED_MS = 30000

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

/**
 * Whatever owns the stage above the media: a trivia round, a battle, or the
 * ordinary text overlay.
 *
 * A round and a battle each own the whole stage for their turn, so the text
 * overlay stands down rather than drawing a countdown behind them.
 */
const StageOverlay = ({
  trivia,
  isTriviaOnStage,
  isTriviaRow,
  isTriviaLeadIn,
  isBattleRow,
  battleQueueId,
  isBezeled,
  battleUpNext,
  getAudioCtx,
  width,
  height,
  overlay,
}: {
  trivia: { round: TriviaRound | null, result: TriviaResult | null }
  isTriviaOnStage: boolean
  isTriviaRow: boolean
  isTriviaLeadIn: boolean
  isBattleRow: boolean
  battleQueueId: number
  /** the bezel round the battle's hole; off when the half is keyed */
  isBezeled: boolean
  battleUpNext: BattleUpNext | null
  getAudioCtx: () => AudioContext | null
  width: number
  height: number
  overlay: Omit<React.ComponentProps<typeof PlayerTextOverlay>, 'width' | 'height'>
}) => {
  if (isTriviaOnStage) {
    return (
      <PlayerTrivia
        key={trivia.round.roundId}
        round={trivia.round}
        result={trivia.result}
        width={width}
        height={height}
      />
    )
  }

  // A battle owns the stage for its whole row, including the gap before the
  // server's first beat lands — PlayerBattle draws its own holding card for
  // that, the way the trivia splash covers a round's lead-in.
  if (isBattleRow) {
    return (
      <PlayerBattle
        queueId={battleQueueId}
        isBezeled={isBezeled}
        getAudioCtx={getAudioCtx}
        upNext={battleUpNext}
        width={width}
        height={height}
      />
    )
  }

  return (
    <>
      {/* One mount across the whole lead-in, so the splash does not restart
          the moment the row goes current. */}
      {isTriviaLeadIn && <PlayerTriviaSplash intermissionEndsAt={overlay.intermissionEndsAt} width={width} height={height} />}
      {!isTriviaRow && <PlayerTextOverlay {...overlay} width={width} height={height} />}
    </>
  )
}

const PlayerController = (props: PlayerControllerProps) => {
  const queue = useAppSelector(getRoundRobinQueue)
  const player = useAppSelector(state => state.player)
  const playerVisualizer = useAppSelector(state => state.playerVisualizer)
  const prefs = useAppSelector(state => state.prefs)
  const roomPrefs = useAppSelector(getRoomPrefs)
  const roomName = useAppSelector(state => state.rooms.entities[state.user.roomId]?.name)
  // 14 lists, and cycles in for, only people who have scored
  const leaderboard = useAppSelector(scoredLeaderboard)
  const singerCount = useAppSelector(state => state.rooms.singerCount)
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
  const party = useAppSelector(state => state.party)
  const isPartyRow = isPartyItem(queueItem) && !player.isAtQueueEnd
  const partyRound = isPartyRow && party.round?.queueId === player.queueId ? party.round : null
  const partyRoundId = partyRound?.id
  const partyRoundClosed = partyRound?.closed
  const nextIdx = queue.result.indexOf(player.queueId) + 1
  const nextQueueItem = queue.entities[queue.result[nextIdx]]
  // the three singers after the next one, shown during the intermission (11a)
  const comingUpQueueItems = queue.result.slice(nextIdx + 1, nextIdx + 4).map(id => queue.entities[id])
  const comingUpSongTitles = useAppSelector(state => comingUpQueueItems.map(item => state.songs.entities[item.songId]?.title))
  const nextSong = useAppSelector(state => nextQueueItem ? state.songs.entities[nextQueueItem.songId] : undefined)
  const nextArtist = useAppSelector(state => nextSong ? state.artists.entities[nextSong.artistId] : undefined)

  /* Who the room goes back to when a fight is over, drawn on the verdict beat.
     The page that normally names the next singer is stood down before a battle
     — it can only name one of two fighters — so the verdict's fifteen seconds
     carries the handover instead, and nobody waits an extra countdown for it.

     Only for an ordinary song. A trivia round draws its own mark and a second
     battle opens by naming both of its own fighters, so announcing either from
     inside this one is the duplicate screen this change exists to remove. */
  const battleUpNext: BattleUpNext | null = nextQueueItem
    && !isTriviaItem(nextQueueItem)
    && !isBattleItem(nextQueueItem)
    ? {
        singer: nextQueueItem.userDisplayName,
        songArtist: nextArtist?.name,
        songTitle: nextSong?.title,
      }
    : null
  // the 11b bar names the singer *and* their song, so the player needs the current one too
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
  // question, and moves on when the round is done — and stops owning the stage
  // the moment the queue runs out under it. See getIsRowOnStage.
  const isTriviaRow = getIsRowOnStage(isTriviaItem(queueItem), player.isAtQueueEnd)
  const isTriviaOnStage = isTriviaRow && trivia.round?.queueId === player.queueId

  // The mark holds the stage for the whole handover: the intermission that
  // hands it over, and the gap after the row goes current while the round is
  // asked for. One state rather than two, because they are one wait — the
  // intermission page and the mark were two screens for one thing.
  const isTriviaLeadIn = isTriviaRow || (!!intermissionEndsAt && isTriviaItem(nextQueueItem))

  // The same trio again for battles. A battle row takes its turn exactly as a
  // singer's does — the player stops here, asks the server to run it, and moves
  // on when the verdict is over — but where a trivia round is one screen, a
  // battle is ten beats, two of which are songs playing.
  const isBattleRow = getIsRowOnStage(isBattleItem(queueItem), player.isAtQueueEnd)
  const isBattleOnStage = isBattleRow && liveBattle.turn?.queueId === player.queueId

  const battleSide = getBattleSide(isBattleOnStage, liveBattle.phase)
  const media = resolveMedia(queueItem as QueueItem | undefined, battleSide)
  if (isPartyRow) {
    media.mediaId = partyRound?.closed ? undefined : partyRound?.mediaId
    media.mediaType = partyRound?.mediaType ?? null
    media.isVideoKeyingEnabled = false
  }

  // Player owns the page's AudioContext and stays mounted even on the beats
  // where its render returns null, so the crowd microphone can borrow it
  // instead of opening a third one — Chrome caps a document at about six and
  // never collects them, and lib/alertCue.ts already has the second. A getter
  // rather than the context itself because a ref may not be read during
  // render, and useCallback because it is an effect dependency in useCrowdMic:
  // a fresh arrow every render would restart the microphone on every tick.
  const playerRef = useRef<Player>(null)
  const getAudioCtx = useCallback(() => playerRef.current?.audioCtx ?? null, [])
  // the 11b bar's meter reads the room's level off Player's analyser
  const getAnalyser = useCallback(() => playerRef.current?.analyser ?? null, [])

  const handleStatus = useCallback((status?: Partial<PlayerState>) => dispatch(playerStatus(status)), [dispatch])
  const handleLoad = () => dispatch(playerLoad())
  // play() refused for want of a tap on this page (see SoundGate). Cleared by
  // the media actually starting, which the tap is what allows.
  const [isSoundBlocked, setSoundBlocked] = useState(false)
  const handleBlocked = () => setSoundBlocked(true)
  const handleSoundTap = () => {
    playerRef.current?.resumeFromGesture(document.getElementById('player-fs-container') ?? document)
    setSoundBlocked(false)
  }
  const handlePlay = () => {
    setSoundBlocked(false)
    dispatch(playerPlay())
  }
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

  // Which run of which row last ran out on its own. A song leaving the stage
  // any other way was skipped, and a skipped song earns no points. Stamped
  // with the replay time for the reason battleRun is: a replayed song is sung
  // again and has to end again.
  const endedRunRef = useRef('')

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
      if (!isTriviaItem(queueItem) && !isPartyItem(queueItem)) {
        dispatch({
          type: SONG_PLAYED,
          payload: {
            queueId: queueItem.queueId,
            isSkipped: endedRunRef.current !== `${queueItem.queueId}:${player._lastReplayTime}`,
          },
        })
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
  }, [dispatch, handleStatus, nextQueueItem, player._lastReplayTime, player.historyJSON, queueItem])

  // the queue can change while we're waiting, so the timer calls the latest handleLoadNext
  const loadNextRef = useRef(handleLoadNext)
  useEffect(() => {
    loadNextRef.current = handleLoadNext
  }, [handleLoadNext])

  // song finished on its own: hold for the intermission before loading the next one
  const handleMediaEnd = useCallback(() => {
    // Natural track end does not discard unanswered guesses. The room can
    // still answer after the audio ends; the host retains the skip control.
    if (isPartyRow) return
    // A battle's song running out is not the end of the row. The server owns
    // the sequence, so the player only reports which half finished and waits
    // for the next beat. Falling through to the intermission below would set a
    // 15s countdown and hand the row to handleLoadNext, which is the wrong
    // destination halfway through a fight.
    if (battleSide) {
      dispatch(battleSongEnded(player.queueId, battleSide))
      return
    }

    endedRunRef.current = `${player.queueId}:${player._lastReplayTime}`
    dispatch({ type: SONG_PLAYED, payload: { queueId: player.queueId, isSkipped: false } })

    // Notify the server at completion so an interlude can join the queue
    // before the handover. The departure notification is idempotent.

    // nothing to wait for at the end of the queue
    if (!nextQueueItem) {
      handleLoadNext()
      return
    }

    // Nothing to wait for before a battle either. The intermission exists to
    // name the next singer and give them fifteen seconds to reach the
    // microphone — and a battle opens by naming both of its fighters and both
    // of their songs on the `versus` beat, to two people who agreed to fight
    // minutes ago and are already standing there. Running the page first is
    // the same announcement twice, the first one worse and only half true,
    // because it can only name one of the two.
    if (isBattleItem(nextQueueItem)) {
      handleLoadNext()
      return
    }

    setIntermission({
      endsAt: Date.now() + INTERMISSION_MS,
      queueId: player.queueId,
      replayTime: player._lastReplayTime,
    })
  }, [isPartyRow, battleSide, dispatch, handleLoadNext, nextQueueItem, player.queueId, player._lastReplayTime])

  // Dev only: end the song early, exactly as if it had run out, so intermission,
  // points and battles all see a normal ending. Its own ref rather than
  // endedRunRef, which a battle half never sets: once per run and per half,
  // and a replay gets its own cut.
  const devCutRef = useRef('')

  useEffect(() => {
    if (!__DEV_SONG_SECONDS__ || !player.isPlaying || player.position < __DEV_SONG_SECONDS__) return

    const run = `${player.queueId}:${player._lastReplayTime}:${battleSide}`
    if (devCutRef.current === run) return

    devCutRef.current = run
    handleMediaEnd()
  }, [battleSide, handleMediaEnd, player.isPlaying, player.position, player.queueId, player._lastReplayTime])

  useEffect(() => {
    if (isPartyRow && player.isPlaying && !partyRound && party.resolvedQueueId !== player.queueId) dispatch(partyRequest('start', { queueId: player.queueId }))
  }, [dispatch, isPartyRow, player.isPlaying, player.queueId, partyRound, party.resolvedQueueId])

  useEffect(() => {
    if (!isPartyRow || !player.isPlaying) return
    if (party.resolvedQueueId === player.queueId) {
      loadNextRef.current()
      return
    }
    if (!partyRoundId) {
      const timer = setTimeout(() => loadNextRef.current(), 45000)
      return () => clearTimeout(timer)
    }
    if (partyRoundClosed) {
      const timer = setTimeout(() => loadNextRef.current(), 7000)
      return () => clearTimeout(timer)
    }
  }, [isPartyRow, player.isPlaying, player.queueId, party.resolvedQueueId, partyRoundId, partyRoundClosed])

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

  /* "lock in" the next user that isn't the currently up user, if possible.
     Rotation ids rather than raw userIds, so a battle locks in as itself. Its
     userId is the challenger's, and storing that sends getSettled looking for
     the challenger in raw queue order — where it finds one of their ordinary
     songs, pins that instead, and pushes the fight back a slot on every
     advance until it is last in the queue. */
  useEffect(() => {
    const curId = queueItem ? rotationIdOf(queueItem) : undefined

    for (let i = queue.result.indexOf(queueItem?.queueId) + 1; i < queue.result.length; i++) {
      const rowId = rotationIdOf(queue.entities[queue.result[i]])

      if (curId === rowId) continue

      // Only when it actually changes. Written as "recompute, compare, maybe
      // emit" rather than the old "emit unless something looks already set",
      // because that guard leaned on the locked id being falsy to know it was
      // spent — true of a singer's 0-less id and of trivia's 0, and false of a
      // battle's -1, which is truthy and so stuck the lock on the fight for
      // the rest of the night. This converges: the locked row is the one the
      // rotation then places next, so the same value is computed and nothing
      // is dispatched until the player moves past it.
      if (rowId !== player.nextUserId) handleStatus({ nextUserId: rowId })

      return
    }
  }, [handleStatus, player.nextUserId, queue, queueItem])

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

  // D8 · the phones' 12e0 waiting screen counts down with the TV: while a
  // round is coming (the gap before it, then the wait for its first question)
  // the status says which row and when. Once the lead-in is over both go out
  // as absent, which the phones' status reducer reads as "no lead-in". A row
  // reached with no intermission of its own carries the last one's end, which
  // is past: the phones hold at 0 until the question lands.
  const leadInQueueId = isTriviaLeadIn && !isTriviaOnStage
    ? (isTriviaRow ? player.queueId : nextQueueItem.queueId)
    : undefined
  const leadInEndsAt = leadInQueueId === undefined ? undefined : (intermissionEndsAt ?? intermission?.endsAt)

  useEffect(() => handleStatus({ leadInEndsAt, leadInQueueId }), [handleStatus, leadInEndsAt, leadInQueueId])

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

  // Unmounting IS the stop: the element leaves the document and the UA pauses
  // it per spec, which is why there is no pause() call anywhere in this file
  // and why a battle's two-minute cut needs no new one.
  const isMediaVisible = getIsMediaVisible({
    queueItem,
    isTriviaRow,
    isErrored: player.isErrored,
    isAtQueueEnd: player.isAtQueueEnd,
    intermissionEndsAt,
    isBattleRow,
    battleSide,
  })

  // Which state the text overlay is in, when it is drawn at all — the same
  // ladder it runs, so the join screen and the stage it draws never disagree.
  const stage = isTriviaRow || isBattleRow || isPartyRow
    ? null
    : overlayState({
        isQueueEmpty: !queue.result.length,
        isAtQueueEnd: player.isAtQueueEnd,
        nextQueueItem,
        queueItem,
        isErrored: player.isErrored,
        intermissionEndsAt,
      })
  // 10 · the idle / join screen, whenever nobody is singing
  const isJoinShown = stage === 'empty' || stage === 'idle'
  // 11a · the intermission draws the next singer's own stage, full bleed —
  // except before a trivia round (its splash) or a battle (only a clock)
  const isOnStageNext = stage === 'intermission' && !isTriviaItem(nextQueueItem) && !isBattleItem(nextQueueItem)
  // 11b and 13e/13g alike: where the media plays and whose stage is behind it
  const { rect: frameRect, backdropRect, singer: stageSinger, frame } = mediaStage({
    queueItem: queueItem as QueueItem | undefined,
    battleSide,
    isMediaVisible,
    isBattleRow,
    isWebGLSupported: player.isWebGLSupported,
    width: props.width,
    height: props.height,
  })

  return (
    <>
      {/* A battle overlay is opaque on eight of its ten beats and the media
          covers the other two, so the thread field has to stop for the whole
          row — otherwise it burns a core behind the fight for five minutes.
          The join screen, the on-stage-next page and a song's own stage
          are opaque too. */}
      <PlayerBackdrop
        isCovered={isMediaVisible || isTriviaLeadIn || isBattleRow || isJoinShown || isOnStageNext}
        stage={stageSinger === undefined ? undefined : battleSingerStage(battleSingerOrDefault(stageSinger))}
        stageRect={backdropRect}
      />
      {/* On a singing beat the stage above is a bezel with a hole cut in it and
          this is what shows through, so the media is sized and placed to the
          opening rather than to the screen; an ordinary song sits in 11b's
          frame. Everywhere else it is the whole display — the same box with
          different numbers, never a removed one.
          Taking the wrapper away for that case, by fragment or by
          `display: contents`, costs either the AudioContext or the video's
          compositing layer; PlayerFrame.tsx has the full account. */}
      <PlayerFrame
        rect={frameRect}
        width={props.width}
        height={props.height}
        className={isPartyRow ? partyStyles.audioOnly : frame === 'song' ? frameStyles.framed : undefined}
      >
        <Player
          ref={playerRef}
          cdgAlpha={player.cdgAlpha}
          cdgSize={player.cdgSize}
          isPlaying={player.isPlaying}
          isVisible={isPartyRow ? !!partyRound?.mediaId && !partyRound.closed : isMediaVisible}
          keyChange={media.keyChange}
          isReplayGainEnabled={prefs.isReplayGainEnabled}
          isVideoKeyingEnabled={media.isVideoKeyingEnabled}
          isWebGLSupported={player.isWebGLSupported}
          mediaId={media.mediaId}
          mediaKey={media.key}
          mediaReplayKey={player._lastReplayTime}
          mediaType={media.mediaType}
          mp4Alpha={player.mp4Alpha}
          onEnd={handleMediaEnd}
          onError={handleError}
          onBlocked={handleBlocked}
          onLoad={handleLoad}
          onPlay={handlePlay}
          onStatus={handleStatus}
          rgTrackGain={media.rgTrackGain}
          rgTrackPeak={media.rgTrackPeak}
          visualizer={playerVisualizer}
          volume={player.volume}
          width={frameRect ? frameRect.width : props.width}
          height={frameRect ? frameRect.height : props.height}
        />
      </PlayerFrame>
      {isJoinShown && (
        <PlayerJoin
          roomName={roomName}
          leaderboard={leaderboard}
          singerCount={singerCount}
          isIdle={stage === 'idle'}
          qr={<PlayerQR height={props.height} prefs={roomPrefs?.qr} />}
        />
      )}
      {isPartyRow && <div className={partyStyles.stage}>{partyRound ? <RoundContent round={partyRound} television /> : <h2>{gameLabel(queueItem?.type)}</h2>}</div>}
      {!isPartyRow && (
        <StageOverlay
          trivia={trivia}
          isTriviaOnStage={isTriviaOnStage}
          isTriviaRow={isTriviaRow}
          isTriviaLeadIn={isTriviaLeadIn}
          isBattleRow={isBattleRow}
          battleQueueId={player.queueId}
          isBezeled={frame === 'bezel'}
          battleUpNext={battleUpNext}
          getAudioCtx={getAudioCtx}
          width={props.width}
          height={props.height}
          overlay={{
            queueItem: queueItem as QueueItem,
            nextQueueItem: nextQueueItem as QueueItem,
            comingUpQueueItems: comingUpQueueItems as QueueItem[],
            comingUpSongTitles,
            songTitle: song?.title,
            songArtist: artist?.name,
            nextSongTitle: nextSong?.title,
            nextSongArtist: nextArtist?.name,
            isAtQueueEnd: player.isAtQueueEnd,
            isQueueEmpty: !queue.result.length,
            intermissionEndsAt,
            isErrored: player.isErrored,
            venue: roomName,
            position: player.position,
            duration: player.duration,
            getAnalyser,
          }}
        />
      )}
      {isSoundBlocked && <SoundGate onTap={handleSoundTap} />}
    </>
  )
}

export default PlayerController
