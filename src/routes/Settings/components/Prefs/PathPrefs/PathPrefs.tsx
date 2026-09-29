import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import HttpApi from 'lib/HttpApi'
import PathChooser from './PathChooser/PathChooser'
import PathInfo from './PathInfo/PathInfo'
import PathItem from './PathItem/PathItem'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import styles from './PathPrefs.css'
import { receivePrefs, requestScan, requestScanAll, requestScanStop, setPathPriority, setPathPrefs } from 'store/modules/prefs'
import { showErrorMessage } from 'store/modules/ui'
import type { Path } from 'shared/types'

const api = new HttpApi('prefs/path')

/** 09 Media folders: each folder with its song count and a mint meter, full
 *  when idle and the scan's progress while one runs (the scan used to be a
 *  row in the header). Reordering, re-scanning, per-folder settings and
 *  adding a folder are the admin extras behind the panel's Manage key. */
const PathPrefs = ({ isManaging }: { isManaging: boolean }) => {
  const paths = useAppSelector(state => state.prefs.paths)
  const isScanning = useAppSelector(state => state.prefs.isScanning)
  const scannerPct = useAppSelector(state => state.prefs.scannerPct)
  const scannerText = useAppSelector(state => state.prefs.scannerText)
  const [isChoosing, setChoosing] = useState(false)
  const [editingPath, setEditingPath] = useState<Path | null>(null)
  const [removingPath, setRemovingPath] = useState<Path | null>(null)
  const [priority, setPriority] = useState(paths.result)

  const handleCloseChooser = () => setChoosing(false)
  const handleOpenChooser = () => setChoosing(true)
  const handleCloseInfo = () => setEditingPath(null)

  const dispatch = useAppDispatch()

  // A drag reorders this list before the server has agreed to it, so the order
  // is held locally and resynced whenever the store's copy changes. Adjusted
  // during render rather than in an effect: an effect would paint the stale
  // order first and then immediately repaint, which is the cascading render
  // react-hooks/set-state-in-effect exists to stop.
  const [prevPaths, setPrevPaths] = useState(paths)

  if (paths !== prevPaths) {
    setPrevPaths(paths)
    setPriority(paths.result)
  }

  const handleDragEnd = (dnd: DropResult) => {
    // dropped outside the list?
    if (!dnd.destination) return

    const res = priority.slice() // copy
    const [removed] = res.splice(dnd.source.index, 1)
    res.splice(dnd.destination.index, 0, removed)

    setPriority(res)
    dispatch(setPathPriority(res as number[]))
  }

  const handleAdd = (dir: string, prefs: object) => {
    api.post(`/?dir=${encodeURIComponent(dir)}`, { body: prefs })
      .then((res) => {
        dispatch(receivePrefs(res))
        setChoosing(false)
        return
      }).catch((err) => {
        alert(err)
      })
  }

  // Asking happens in our own Modal, not window.confirm: a browser that has
  // been told to suppress this page's dialogs returns false from confirm and
  // swallows alert, so the key did nothing and said nothing about it.
  const handleRemove = (pathId: number) => {
    const path = paths.entities[pathId]
    if (path) setRemovingPath(path)
  }

  const handleRemoveCancel = () => setRemovingPath(null)

  const handleRemoveConfirm = () => {
    const pathId = removingPath?.pathId
    if (pathId === undefined) return

    setRemovingPath(null)

    // optimistically update local state
    setPriority(priority.filter(id => id !== pathId))
    setEditingPath(null)

    api.delete(`/${pathId}`)
      .then((res): null => {
        dispatch(receivePrefs(res))
        return null
      }).catch((err) => {
        // a failure has to be visible even when the folder is long gone
        dispatch(showErrorMessage(`The folder could not be removed: ${err.message || err}`))
      })
  }

  const handleUpdate = (pathId: number, data: FormData) => {
    dispatch(setPathPrefs({ pathId, data }))
  }

  const handleInfo = (pathId: number) => setEditingPath(paths.entities[pathId])
  const handleRefresh = (pathId: number) => dispatch(requestScan(pathId))
  const handleRefreshAll = () => dispatch(requestScanAll())
  const handleStopScan = () => dispatch(requestScanStop())

  const isEmpty = paths.result.length === 0

  return (
    <div className={styles.content}>
      {isEmpty && (
        <>
          <p className={styles.empty}>Add a media folder to get started.</p>
          <Button onClick={handleOpenChooser} variant='primary' cta>Add folder</Button>
        </>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId='droppable'>
          {provided => (
            <div className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
              {priority.map((pathId, i) => (
                <PathItem
                  index={i}
                  key={pathId}
                  path={paths.entities[pathId]}
                  isManaging={isManaging}
                  level={isScanning ? scannerPct / 100 : 1}
                  onInfo={handleInfo}
                  onRefresh={handleRefresh}
                />
              ),
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {isScanning && (
        <div className={styles.scan}>
          <span className={styles.scanText}>{scannerText}</span>
          <button type='button' className={styles.stop} onClick={handleStopScan}>Stop</button>
        </div>
      )}

      {isManaging && !isEmpty && (
        <div className={styles.btnContainer}>
          <Button onClick={handleRefreshAll} variant='default'>
            Scan folders
          </Button>
          <Button onClick={handleOpenChooser} variant='default'>
            Add folder
          </Button>
        </div>
      )}

      {isChoosing && (
        <PathChooser
          onCancel={handleCloseChooser}
          onChoose={handleAdd}
        />
      )}

      {!!editingPath && (
        <PathInfo
          onClose={handleCloseInfo}
          onRemove={handleRemove}
          onUpdate={handleUpdate}
          path={editingPath}
        />
      )}

      {!!removingPath && (
        <Modal
          onClose={handleRemoveCancel}
          title='Remove Folder'
          buttons={(
            <>
              <Button onClick={handleRemoveConfirm} variant='danger'>Remove Folder</Button>
              <Button onClick={handleRemoveCancel} variant='primary'>Cancel</Button>
            </>
          )}
        >
          <p className={styles.removePath}>{removingPath.path}</p>
          <p>
            Every song in this folder disappears from the library and from
            anyone&rsquo;s queue. The files on disk are not touched.
          </p>
        </Modal>
      )}
    </div>
  )
}

export default PathPrefs
