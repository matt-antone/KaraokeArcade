import useNow from 'lib/useNow'
import serverNow from 'lib/serverNow'
import React, { useMemo, useState } from 'react'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { partyRequest } from 'store/modules/party'
import getRoundRobinQueue from 'routes/Queue/selectors/getRoundRobinQueue'
import { gameLabel, matchingSongs, rouletteBonus, type PartyRound } from 'shared/party'
import styles from './Party.css'

export function RoundContent ({ round, television = false }: { round: PartyRound, television?: boolean }) {
  const dispatch = useAppDispatch()
  const userId = useAppSelector(state => state.user.userId)
  const answeredIdx = useAppSelector(state => state.party.answeredIdx)
  const now = useNow()
  const seconds = round.endsAt ? Math.max(0, Math.ceil((round.endsAt - (round.sentAt ? serverNow(round as PartyRound & { sentAt: number }, now) : now)) / 1000)) : null
  const canAnswer = !round.closed && answeredIdx === null && round.participants.includes(userId)
  return (
    <div className={styles.content}>
      <p className={styles.eyebrow}>{gameLabel(round.kind)}</p>
      <h2>{round.question}</h2>
      {seconds !== null && !round.closed && <p>{`${seconds}s to answer · 100 points for a correct answer`}</p>}
      {!television && !round.participants.includes(userId) && !round.closed && <p>This round has already started. You’ll join the next one.</p>}
      {round.kind === 'name' && <p>Listen and choose the artist and title. One answer each.</p>}
      <div className={styles.answers}>
        {round.options.map((option, index) => television
          ? <div key={option} className={`${styles.option} ${round.correctIdx === index ? styles.correct : ''}`}>{`${String.fromCharCode(65 + index)} · ${option}${round.closed && round.correctIdx === index ? ' ✓' : ''}`}</div>
          : <Button key={option} disabled={!canAnswer} variant={round.correctIdx === index || answeredIdx === index ? 'primary' : 'default'} onClick={() => dispatch(partyRequest('answer', { id: round.id, index }))}>{`${String.fromCharCode(65 + index)} · ${option}${round.closed && round.correctIdx === index ? ' ✓' : ''}`}</Button>)}
      </div>
      {!television && answeredIdx !== null && (
        <p role='status'>
          Answer locked:
          {round.options[answeredIdx]}
        </p>
      )}
      {!round.closed && (
        <p>
          {round.answered.length}
          {' '}
          of
          {' '}
          {round.participants.length}
          {' '}
          answered
          {television ? ' · Play on your phone' : ''}
        </p>
      )}
      {round.closed && (
        <>
          <h3>Round complete</h3>
          {round.winners.length
            ? round.winners.map(winner => (
                <p key={winner.userId}>
                  {winner.name}
                  {' '}
                  +
                  {winner.points}
                </p>
              ))
            : <p>No correct answers this round.</p>}
        </>
      )}
    </div>
  )
}

export default function Party () {
  const dispatch = useAppDispatch()
  const party = useAppSelector(state => state.party)
  const songs = useAppSelector(state => state.songs.entities)
  const artists = useAppSelector(state => state.artists.entities)
  const userId = useAppSelector(state => state.user.userId)
  const queue = useAppSelector(getRoundRobinQueue)
  const historyJSON = useAppSelector(state => state.status.historyJSON)
  const history: number[] = JSON.parse(historyJSON)
  const currentId = useAppSelector(state => state.status.queueId)
  const [panel, setPanel] = useState<'bingo' | 'roulette' | null>(null)
  const [filters, setFilters] = useState<string[]>([])
  const [queueId, setQueueId] = useState(0)
  const [dismissedRound, setDismissedRound] = useState('')
  const library = useMemo(() => Object.values(songs), [songs])
  const tags = useMemo(() => [...new Set(library.flatMap(song => song.tags))].sort(), [library])
  const mine = queue.result.map(id => queue.entities[id]).filter(item => item.type === 'song' && item.userId === userId && item.queueId !== currentId && !history.includes(item.queueId))
  const selectedId = mine.some(item => item.queueId === queueId) ? queueId : mine[0]?.queueId
  const draw = party.roulette.find(d => d.queueId === selectedId)
  const selectedFilters = draw?.filters ?? filters
  const count = draw?.poolSongIds?.length ?? matchingSongs(library, selectedFilters).length
  const card = party.bingo
  const round = party.round
  const win = !!card?.payout
  return (
    <>
      {(party.enabled.bingo || party.enabled.roulette) && (
        <div className={styles.launcher}>
          {party.enabled.bingo && (
            <Button variant='default' onClick={() => setPanel('bingo')}>
              {`Bingo ${card ? `${card.squares.filter(s => s.done).length}/9` : ''}`}
            </Button>
          )}
          {party.enabled.roulette && <Button variant='default' onClick={() => setPanel('roulette')}>Roulette</Button>}
        </div>
      )}
      {round && round.id !== dismissedRound && <Modal scrollable title={gameLabel(round.kind)} onClose={() => setDismissedRound(round.id)}><RoundContent round={round} /></Modal>}
      {round && round.id === dismissedRound && !round.closed && (
        <div className={styles.rejoin}>
          <Button variant='default' onClick={() => setDismissedRound('')}>
            Answer
            {gameLabel(round.kind)}
          </Button>
        </div>
      )}
      {(win || panel === 'bingo') && card && (
        <Modal
          title={win ? `Bingo! +${card.payout} points` : 'Karaoke bingo'}
          onClose={() => {
            if (win) dispatch(partyRequest('dismiss', { id: card.id }))
            setPanel(null)
          }}
        >
          <div className={styles.content}>
            <p>{win ? 'Your winning line has been paid. Dismiss to receive your next card.' : 'Three in a row, column, or diagonal wins. Anyone in the room can sing your song squares.'}</p>
            <div className={styles.grid}>
              {card.squares.map((square, index) => (
                <div key={index} className={`${styles.square} ${square.done ? styles.done : ''}`}>
                  <strong>{square.value}</strong>
                  <span>{square.label}</span>
                  <span>{square.done ? '✓ Complete' : 'Waiting'}</span>
                </div>
              ))}
            </div>
            {win && (
              <Button
                variant='primary'
                onClick={() => {
                  dispatch(partyRequest('dismiss', { id: card.id }))
                  setPanel(null)
                }}
              >
                Next card
              </Button>
            )}
          </div>
        </Modal>
      )}
      {panel === 'roulette' && (
        <Modal scrollable title='Karaoke roulette' onClose={() => setPanel(null)}>
          <div className={styles.content}>
            <p>Let the room surprise you. Choose filters, draw a song, and sing it to earn your bonus.</p>
            {!mine.length
              ? <p>Add a song to the queue first, then turn that singing turn into roulette.</p>
              : (
                  <>
                    <label>
                      Your singing turn
                      <select value={selectedId} onChange={e => setQueueId(Number(e.target.value))}>
                        {mine.map(item => (
                          <option key={item.queueId} value={item.queueId}>
                            {artists[songs[item.songId]?.artistId]?.name}
                            {' '}
                            -
                            {' '}
                            {songs[item.songId]?.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Metadata filters (up to four)
                      <select value='' disabled={!!draw || selectedFilters.length >= 4} onChange={e => setFilters([...filters, e.target.value])}>
                        <option value=''>Add a genre, decade, subgenre, or mood</option>
                        {tags.filter(tag => !filters.includes(tag)).map(tag => <option key={tag}>{tag}</option>)}
                      </select>
                    </label>
                    <div className={styles.tags}>
                      {selectedFilters.map(tag => (
                        <Button variant='default' key={tag} disabled={!!draw} onClick={() => setFilters(filters.filter(t => t !== tag))}>
                          {tag}
                          {!draw && ' ×'}
                        </Button>
                      ))}
                    </div>
                    <p>
                      {count}
                      {' '}
                      matching songs ·
                      {' '}
                      {150 + (draw?.bonus ?? rouletteBonus(filters.length, 0))}
                      {' '}
                      total points after singing
                    </p>
                    {draw
                      ? (
                          <>
                            <h3>
                              {artists[songs[draw.songId]?.artistId]?.name}
                              {' '}
                              -
                              {' '}
                              {songs[draw.songId]?.title}
                            </h3>
                            <p>{draw.declined ? 'Normal singing turn · No roulette bonus' : `${draw.rerolls} rerolls · +${draw.bonus} bonus`}</p>
                            {!draw.declined && (
                              <>
                                <Button variant='default' disabled={draw.bonus < 50} onClick={() => dispatch(partyRequest('reroll', { queueId: selectedId }))}>Reroll −50 points</Button>
                                <Button variant='default' onClick={() => dispatch(partyRequest('decline', { queueId: selectedId }))}>Decline roulette</Button>
                              </>
                            )}
                          </>
                        )
                      : <Button variant='primary' disabled={count < 10} onClick={() => dispatch(partyRequest('draw', { queueId: selectedId, filters }))}>Draw and lock song</Button>}
                    {count < 10 && <p>Broaden your filters to match at least 10 songs.</p>}
                  </>
                )}
          </div>
        </Modal>
      )}
    </>
  )
}
