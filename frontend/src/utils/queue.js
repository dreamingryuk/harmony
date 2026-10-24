// Fila de reprodução compartilhada pelo player da barra inferior.
// Guarda também os modos aleatório/repetição para que cards de playlist e o
// player falem a mesma língua.
const MODES_KEY = 'synq-player-modes'
const LOOP_MODES = ['off', 'all', 'one']

let queue = []
let index = -1
// Ordem embaralhada (índices da fila) usada quando o aleatório está ligado.
let order = []
let orderPos = -1
let shuffle = false
let loop = 'off'

try {
  const saved = JSON.parse(window.localStorage.getItem(MODES_KEY) || '{}')
  shuffle = saved.shuffle === true
  if (LOOP_MODES.includes(saved.loop)) loop = saved.loop
} catch {
  // Sem armazenamento disponível: mantém os modos padrão.
}

const persistModes = () => {
  try {
    window.localStorage.setItem(MODES_KEY, JSON.stringify({ shuffle, loop }))
  } catch {
    // Ignora falhas de armazenamento (ex.: navegação privada).
  }
}

const sameTrack = (left, right) => {
  if (!left || !right) return false
  if (left === right) return true
  const leftId = left.youtubeId || left.spotifyId
  const rightId = right.youtubeId || right.spotifyId
  return Boolean(leftId && rightId && leftId === rightId)
}

const hasNext = () => {
  if (!queue.length) return false
  if (shuffle && order.length) return orderPos < order.length - 1 || loop === 'all'
  return index < queue.length - 1 || loop === 'all'
}

const hasPrev = () => {
  if (!queue.length) return false
  if (shuffle && order.length) return orderPos > 0 || loop === 'all'
  return index > 0 || loop === 'all'
}

export const queueState = () => ({
  index,
  length: queue.length,
  canNext: hasNext(),
  canPrev: hasPrev(),
  shuffle,
  loop,
})

export const currentQueueTrack = () => (index >= 0 ? queue[index] || null : null)

export const isShuffleEnabled = () => shuffle

export const nextLoopMode = (mode = loop) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off')

// Embaralha os índices mantendo a faixa atual na primeira posição.
function rebuildOrder() {
  order = queue.map((_, position) => position)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (!shuffle || !order.length) {
    orderPos = -1
    return
  }
  const position = order.indexOf(index)
  if (position > 0) {
    order.splice(position, 1)
    order.unshift(index)
  }
  orderPos = 0
}

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
  rebuildOrder()
  return currentQueueTrack()
}

export function setShuffle(enabled) {
  shuffle = Boolean(enabled)
  if (shuffle) rebuildOrder()
  else orderPos = -1
  persistModes()
  return shuffle
}

export function setLoop(mode) {
  loop = LOOP_MODES.includes(mode) ? mode : 'off'
  persistModes()
  return loop
}

export function nextQueueTrack() {
  if (!queue.length) return null
  if (shuffle && order.length) {
    if (orderPos < order.length - 1) orderPos += 1
    else if (loop === 'all') orderPos = 0
    else return null
    index = order[orderPos]
    return queue[index]
  }
  if (index < queue.length - 1) {
    index += 1
    return queue[index]
  }
  if (loop === 'all') {
    index = 0
    return queue[0]
  }
  return null
}

export function previousQueueTrack() {
  if (!queue.length) return null
  if (shuffle && order.length) {
    if (orderPos > 0) orderPos -= 1
    else if (loop === 'all') orderPos = order.length - 1
    else return null
    index = order[orderPos]
    return queue[index]
  }
  if (index > 0) {
    index -= 1
    return queue[index]
  }
  if (loop === 'all' && queue.length > 1) {
    index = queue.length - 1
    return queue[index]
  }
  return null
}
