import React from 'react'
import { Draggable } from '@hello-pangea/dnd'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import VuMeter from 'components/VuMeter/VuMeter'
import { Path } from 'shared/types'
import styles from './PathItem.css'

interface PathItemProps {
  index: number
  /** Show the drag handle and the rescan / settings keys (the panel's Manage). */
  isManaging: boolean
  /** The meter, 0-1: full when idle, the scan's progress while one runs. The
   *  Scanner reports one progress for the whole scan, not one per folder. */
  level: number
  onInfo: (pathId: number) => void
  onRefresh: (pathId: number) => void
  path: Path
}

/** One folder in 09 Media folders: its path, its song count, and a mint meter. */
const PathItem = ({ index, isManaging, level, onInfo, onRefresh, path }: PathItemProps) => {
  const handleInfo = (e: React.SyntheticEvent<HTMLElement>) => onInfo(parseInt(e.currentTarget.dataset.pathId))
  const handleRefresh = (e: React.SyntheticEvent<HTMLElement>) => onRefresh(parseInt(e.currentTarget.dataset.pathId))

  return (
    <Draggable draggableId={`path-${path.pathId}`} index={index} isDragDisabled={!isManaging}>
      {provided => (
        <div
          className={styles.pathItem}
          key={path.pathId}
          ref={provided.innerRef}
          style={provided.draggableProps.style}
          {...provided.draggableProps}
        >
          <div className={styles.topRow} {...provided.dragHandleProps} tabIndex={-1}>
            {isManaging && <Icon icon='DRAG_INDICATOR' className={styles.btnDrag} />}
            <div className={styles.pathName}>
              {path.path}
            </div>
            <div className={styles.count}>{`${path.numSongs || 0} songs`}</div>
            {isManaging && (
              <>
                <Button
                  className={styles.btnRefresh}
                  data-path-id={path.pathId}
                  icon='REFRESH'
                  onClick={handleRefresh}
                  aria-label='Scan this folder'
                />
                <Button
                  className={styles.btnInfo}
                  data-path-id={path.pathId}
                  icon='TUNE'
                  onClick={handleInfo}
                  aria-label='Folder settings'
                />
              </>
            )}
          </div>
          <VuMeter
            value={level}
            segments={24}
            tone='mint'
            height={8}
            gap={2}
            label={`${path.path} scan`}
          />
        </div>
      )}
    </Draggable>
  )
}

export default PathItem
