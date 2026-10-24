// Fila de reprodução compartilhada pelo player da barra inferior.
let queue = []
let index = -1

const sameTrack = (left, right) => {
  if (!left || !right) return false
  if (left === right) return true
  const leftId = left.youtubeId || left.spotifyId
  const rightId = right.youtubeId || right.spotifyId
  return Boolean(leftId && rightId && leftId === rightId)
}

export const queueState = () => ({
  index,
  length: queue.length,
  canNext: index >= 0 && index < queue.length - 1,
  canPrev: index > 0,
})

export const currentQueueTrack = () => (index >= 0 ? queue[index] || null : null)

// Começa uma nova fila a partir da faixa escolhida; quando a lista não
// contém a faixa ela entra no fim para manter a navegação possível.
export function startQueue(tracks, track) {
  const items = (Array.isArray(tracks) ? tracks : []).filter(Boolean)
  const found = items.findIndex((item) => sameTrack(item, track))
  if (found >= 0) {
    queue = items
    index = found
  } else {
    queue = [...items, track].filter(Boolean)
    index = Math.max(items.length, 0)
  }
  return currentQueueTrack()
}

export function nextQueueTrack() {
  if (index >= 0 && index < queue.length - 1) {
    index += 1
    return queue[index]
  }
  return null
}

export function previousQueueTrack() {
  if (index > 0) {
    index -= 1
    return queue[index]
  }
  return null
}
