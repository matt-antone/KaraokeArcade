import React from 'react'
import { QRCode } from 'react-qrcode-logo'
import Modal, { ModalProps } from 'components/Modal/Modal'
import Button from 'components/Button/Button'
import styles from './JoinCode.css'

const QR_SIZE = 176

// the value --ink resolves to. The code is painted to a canvas, so it needs a
// real colour rather than the token; keep the two in step.
const INK = '#e9e2ff'

interface JoinCodeProps {
  roomId: number
  serverUrl?: string
  qrPassword?: string
  onClose: ModalProps['onClose']
}

const JoinCode = ({ roomId, serverUrl, qrPassword, onClose }: JoinCodeProps) => {
  // Built from the server's own LAN address, not this browser's — a guest's
  // phone must reach the server, not whatever machine is viewing this modal.
  let joinUrl: string | undefined
  if (serverUrl) {
    const url = new URL(serverUrl)
    url.searchParams.set('roomId', String(roomId))
    if (qrPassword) url.searchParams.set('password', btoa(qrPassword))
    joinUrl = url.href
  }

  return (
    <Modal
      onClose={onClose}
      title='Join Code'
      buttons={<Button variant='primary' onClick={onClose}>Done</Button>}
    >
      <div className={styles.content}>
        {joinUrl
          ? (
              <>
                <div className={styles.plate}>
                  <QRCode
                    value={joinUrl}
                    ecLevel='L'
                    size={QR_SIZE}
                    quietZone={10}
                    bgColor={INK}
                    qrStyle='dots'
                  />
                </div>
                <p className={styles.url}>{joinUrl}</p>
              </>
            )
          : (
              <p className={styles.unavailable}>
                The server hasn&rsquo;t reported a LAN address, so no join code can be shown.
                Make sure the server and this device share a network, then reopen this panel.
              </p>
            )}
      </div>
    </Modal>
  )
}

export default JoinCode
