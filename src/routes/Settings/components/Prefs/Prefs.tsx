import React, { useState } from 'react'
import Panel from 'components/Panel/Panel'
import PathPrefs from './PathPrefs/PathPrefs'
import { HeadKey } from '../PanelHead/PanelHead'
import styles from './Prefs.css'

const Prefs = () => {
  const [isManaging, setManaging] = useState(false)

  return (
    <Panel
      title='Media folders'
      titleComponent={<HeadKey isOn={isManaging} onClick={() => setManaging(!isManaging)} />}
      contentClassName={styles.content}
    >
      <PathPrefs isManaging={isManaging} />
    </Panel>
  )
}

export default Prefs
