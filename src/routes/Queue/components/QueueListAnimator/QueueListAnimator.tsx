import React from 'react'
import { Flipper, Flipped } from 'react-flip-toolkit'
import { useAppSelector } from 'store/hooks'

const handleShouldFlip = (prev: number, cur: number) => cur === prev

interface QueueListAnimatorProps {
  queueItems: React.ReactElement[]
}

const QueueListAnimator = ({
  queueItems,
}: QueueListAnimatorProps) => {
  const headerHeight = useAppSelector(state => state.ui.headerHeight)

  // Flipped applies data-* props to its child; using a div wrapper
  // here so QueueItems need not be concerned with rendering them
  // https://github.com/aholachek/react-flip-toolkit#wrapping-a-react-component
  // Rows slide to their new places; they do not fade in or out (the design
  // draws neither).
  const items = React.Children.map(queueItems, (child) => {
    return (
      <Flipped
        flipId={child.key}
        key={child.key}
        shouldFlip={handleShouldFlip}
        translate
      >
        <div>
          {child}
        </div>
      </Flipped>
    )
  })

  return (
    <Flipper
      applyTransformOrigin={false}
      decisionData={headerHeight}
      flipKey={queueItems}
    >
      {items}
    </Flipper>
  )
}

export default QueueListAnimator
