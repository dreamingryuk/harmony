import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export function AvatarCropDialog({ image, onSave, onCancel, busy }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const frameSize = 280

  const imageLayout = useCallback(() => {
    const scale = Math.max(frameSize / image.naturalWidth, frameSize / image.naturalHeight) * zoom
    return {
      scale,
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale,
    }
  }, [image, zoom])
  const clampOffset = useCallback((nextOffset) => {
    const { width, height } = imageLayout()
    return {
      x: Math.min(0, Math.max(frameSize - width, nextOffset.x)),
      y: Math.min(0, Math.max(frameSize - height, nextOffset.y)),
    }
  }, [imageLayout])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image.complete) return
    const context = canvas.getContext('2d')
    const { scale, width, height } = imageLayout()
    const cropOffset = clampOffset(offset)
    const imageX = (frameSize - width) / 2 + cropOffset.x
    const imageY = (frameSize - height) / 2 + cropOffset.y
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      -imageX / scale,
      -imageY / scale,
      frameSize / scale,
      frameSize / scale,
      0,
      0,
      canvas.width,
      canvas.height
    )
  }, [clampOffset, image, imageLayout, offset])

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])
  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled)'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handlePointerDown = (event) => {
    if (busy) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }
  }
  const handlePointerMove = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const frameScale = frameSize / bounds.width
    setOffset(
      clampOffset({
        x: dragRef.current.offset.x + (event.clientX - dragRef.current.startX) * frameScale,
        y: dragRef.current.offset.y + (event.clientY - dragRef.current.startY) * frameScale,
      })
    )
  }
  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setError('')
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Não foi possível preparar a foto. Tente outra imagem.')
          return
        }
        if (blob.size > 5 * 1024 * 1024) {
          setError('A imagem recortada excede o limite de 5 MB. Reduza o zoom ou escolha outra foto.')
          return
        }
        onSave(blob)
      },
      'image/webp',
      0.9
    )
  }

  return (
    <div className="modal-backdrop avatar-modal-backdrop">
      <section
        className="modal avatar-crop-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        aria-describedby="avatar-crop-help"
        onKeyDown={handleDialogKeyDown}
      >
        <header>
          <div>
            <h2 id="avatar-crop-title">Ajustar foto de perfil</h2>
            <p id="avatar-crop-help">Arraste a imagem para ajustar o recorte quadrado.</p>
          </div>
          <button
            className="icon"
            type="button"
            ref={closeButtonRef}
            aria-label="Cancelar edição da foto"
            onClick={onCancel}
            disabled={busy}
          >
            <X />
          </button>
        </header>
        <canvas
          className="avatar-crop-canvas"
          ref={canvasRef}
          width="512"
          height="512"
          aria-label="Pré-visualização do recorte da foto"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            dragRef.current = null
          }}
          onPointerCancel={() => {
            dragRef.current = null
          }}
        />
        <label className="avatar-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            aria-label="Zoom da foto"
            onChange={(event) => {
              setZoom(Number(event.target.value))
              setOffset((current) => clampOffset(current))
            }}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions avatar-modal-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <span />
          <button type="button" className="primary" onClick={save} disabled={busy}>
            {busy ? 'Salvando foto...' : 'Salvar foto'}
          </button>
        </div>
      </section>
    </div>
  )
}
