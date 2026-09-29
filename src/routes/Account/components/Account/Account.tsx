import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { updateAccount } from 'store/modules/user'
import { myStanding } from 'store/selectors/points'
import Modal from 'components/Modal/Modal'
import Hud from 'components/Header/Hud/Hud'
import AvatarPicker from 'components/BattleStage/AvatarPicker'
import {
  BATTLE_STAGE_PLATE,
  battleSingerKeyArt,
  battleSingerOrDefault,
  battleSingerStage,
} from 'lib/battleSingers'
import { useFighterListing } from 'lib/fighterSets'
import Button from 'components/Button/Button'
import { POINTS_BATTLE_TAKE_PART, POINTS_BATTLE_WIN, POINTS_SONG, type LeaderboardEntry } from 'shared/types'
import AccountForm from '../AccountForm/AccountForm'
import styles from './Account.css'

/** A fighter with no stage of their own stands on the dive bar. Guarded so a
 *  missing plate cannot loop the error handler. */
const fallBackToPlate = (e: React.SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith(BATTLE_STAGE_PLATE)) e.currentTarget.src = BATTLE_STAGE_PLATE
}

/** 08 My account: the hero card, points tonight and its ledger, Profile. */
const Account = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const venue = useAppSelector(state => (user.roomId === null ? undefined : state.rooms.entities[user.roomId]?.name))
  const { points } = useAppSelector(myStanding)
  const mine = useAppSelector(state => state.points.leaderboard.find(e => e.userId === user.userId))

  const singer = battleSingerOrDefault(user.avatarId)
  const listed = useFighterListing()[singer.group]?.[singer.slug]
  const singerName = listed?.name ?? singer.name
  const height = listed?.height ?? singer.height

  const [isDirty, setDirty] = useState(false)
  const [isPicking, setPicking] = useState(false)

  const { sings = 0, battleWins = 0, battlePlays = 0, triviaPoints = 0 }: Partial<LeaderboardEntry> = mine ?? {}
  const ledger = [
    { label: 'Singing', detail: `${sings} × ${POINTS_SONG}`, pts: sings * POINTS_SONG },
    { label: 'Battles won', detail: `${battleWins} × ${POINTS_BATTLE_WIN}`, pts: battleWins * POINTS_BATTLE_WIN },
    { label: 'Battles played', detail: `${battlePlays} × ${POINTS_BATTLE_TAKE_PART}`, pts: battlePlays * POINTS_BATTLE_TAKE_PART },
    { label: 'Trivia', detail: 'rounds', pts: triviaPoints },
  ]

  const handleSubmit = (data: FormData) => {
    dispatch(updateAccount(data))
  }

  const handleChooseSinger = (avatarId: string) => {
    const data = new FormData()
    data.append('avatarId', avatarId)
    void dispatch(updateAccount({ data, isSilent: true }))
    setPicking(false)
  }

  return (
    <>
      <section className={styles.hero}>
        <img className={styles.location} src={battleSingerStage(singer)} alt='' onError={fallBackToPlate} />
        <div className={styles.fade} />
        <img className={styles.keyArt} src={battleSingerKeyArt(singer).url} alt='' />
        <div className={styles.who}>
          <span className={styles.label}>Signed in as</span>
          <span className={styles.name} translate='no'>{user.isGuest ? 'guest' : user.username}</span>
          <span className={styles.singer}>{height ? `${singerName} · ${height}` : singerName}</span>
        </div>
        <button type='button' className={styles.change} onClick={() => setPicking(true)}>
          Change singer
        </button>
      </section>

      {/* 03 Select your singer, full screen over everything */}
      {isPicking && (
        <Modal variant='screen' title='Select your singer' onClose={() => setPicking(false)}>
          <div className={styles.picker}>
            <Hud room={venue} />
            <AvatarPicker avatarId={user.avatarId} onChoose={handleChooseSinger} />
          </div>
        </Modal>
      )}

      <section className={styles.points}>
        <div className={styles.pointsHead}>
          <span className={styles.heading}>Points tonight</span>
          <span className={styles.pointsTotal}>{points}</span>
        </div>
        {ledger.map(row => (
          <div key={row.label} className={styles.ledgerRow}>
            <span className={styles.ledgerLabel}>{row.label}</span>
            <span className={styles.ledgerDetail}>{row.detail}</span>
            <span className={styles.ledgerPts}>{row.pts}</span>
          </div>
        ))}
      </section>

      <section className={styles.profile}>
        <div className={styles.heading}>Profile</div>
        <AccountForm
          compact
          user={user}
          showAvatar={false}
          onDirtyChange={setDirty}
          onSubmit={handleSubmit}
          showUsername={!user.isGuest}
          showPassword={!user.isGuest}
        >
          {/* the design draws no save key; one appears only once there is
              something to save */}
          {isDirty && (
            <Button type='submit' variant='default'>
              Update account
            </Button>
          )}
        </AccountForm>
      </section>
    </>
  )
}

export default Account
