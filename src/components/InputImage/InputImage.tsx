import React, { useState, useEffect } from 'react'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import loadImage from 'blueimp-load-image'
import { User } from 'shared/types'
import styles from './InputImage.css'

interface UserImageProps {
  user?: User
  onSelect: (blob: Blob) => void
}

// server rejects images over IMG_MAX_LENGTH (server/User/User.ts)
const IMG_MAX_LENGTH = 51200

// stored square; big enough for the player's overlay on a 1080p screen
const IMG_SIZE = 300

// JPEG-encode at decreasing quality until the result fits; returns the
// smallest attempt if even the lowest quality is over (server will reject)
const encodeUnderLimit = async (canvas: HTMLCanvasElement) => {
  let blob: Blob | null = null

  for (const quality of [0.8, 0.6, 0.4]) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= IMG_MAX_LENGTH) break
  }

  return blob
}

const InputImage = ({ user, onSelect }: UserImageProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [imageURL, setImageURL] = useState<string | null>(
    user && user.userId !== null
      ? `${document.baseURI}api/user/${user.userId}/image?v=${user.dateUpdated}`
      : null,
  )

  useEffect(() => {
    return () => {
      if (imageURL) {
        URL.revokeObjectURL(imageURL)
      }
    }
  }, [imageURL])

  const handleImgLoad = () => {
    setIsLoading(false)
  }

  const handleImgError = () => {
    setImageURL(null)
    setIsLoading(false)
  }

  const handleImgClear = () => {
    setImageURL(null)
    onSelect(null)
  }

  const handleChoose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    loadImage(
      file,
      (canvas) => {
        if (canvas instanceof Event) {
          alert('The image could not be loaded.')
          return
        }

        const scaled = loadImage.scale(canvas, {
          canvas: true,
          maxWidth: IMG_SIZE,
          maxHeight: IMG_SIZE,
          crop: true,
          downsamplingRatio: 0.5,
        })

        void (async () => {
          const blob = await encodeUnderLimit(scaled)

          if (blob) {
            setImageURL(URL.createObjectURL(blob))
            onSelect(blob)
          }
        })()
      },
      {
        canvas: true,
        aspectRatio: 1, // largest centered square the source allows
        orientation: true,
      },
    )
  }

  return (
    <div className={styles.container}>
      {!imageURL && (
        <Icon icon='PHOTO_ADD' size={48} className={styles.placeholder} />
      )}

      {imageURL && (
        <img
          src={imageURL}
          width={96}
          height={96}
          onLoad={handleImgLoad}
          onError={handleImgError}
          alt='User Profile'
        />
      )}

      {imageURL && !isLoading && (
        <Button
          className={styles.btnClear}
          icon='DELETE'
          aria-label='Remove photo'
          onClick={handleImgClear}
          size={20}
          variant='default'
        />
      )}

      <input
        type='file'
        accept='image/*'
        onChange={handleChoose}
        className={styles.fileInput}
        ref={(node) => {
          if (!node) return

          // prevents cancel event from bubbling up and dismissing a <dialog>
          node.addEventListener('cancel', (e) => {
            e.stopPropagation()
          })
        }}
      />
    </div>
  )
}

export default InputImage
