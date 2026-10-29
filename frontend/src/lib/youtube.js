import { FALLBACK_COVER } from './media'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos'
const YOUTUBE_PLAYER_API = 'https://www.youtube.com/iframe_api'
const CONNECTION_PREFIX = 'harmony_youtube_enabled_'
let playerApiPromise

export function youtubeApiKey() {
  return import.meta.env.VITE_YOUTUBE_API_KEY?.trim() || ''
}

export function isYoutubeConnected(userId) {
  return Boolean(userId && youtubeApiKey() && localStorage.getItem(`${CONNECTION_PREFIX}${userId}`) === 'true')
}

export function connectYoutube(userId) {
  if (!userId) throw new Error('Entre na sua conta para ativar o YouTube.')
  if (!youtubeApiKey()) throw new Error('Configure VITE_YOUTUBE_API_KEY para ativar a busca no YouTube.')
  localStorage.setItem(`${CONNECTION_PREFIX}${userId}`, 'true')
  window.dispatchEvent(new Event('harmony-music-connections-changed'))
}

export function disconnectYoutube(userId) {
  if (!userId) return
  localStorage.removeItem(`${CONNECTION_PREFIX}${userId}`)
  window.dispatchEvent(new Event('harmony-music-connections-changed'))
}

const thumbnails = (snippet) =>
  snippet?.thumbnails?.high?.url ||
  snippet?.thumbnails?.medium?.url ||
  snippet?.thumbnails?.default?.url ||
  FALLBACK_COVER

// Normaliza tanto resultados de busca quanto a lista de vídeos em alta.
function toYoutubeTrack(item) {
  const videoId = item?.id?.videoId || (typeof item?.id === 'string' ? item.id : null)
  if (!videoId || !item.snippet) return null
  return {
    platform: 'youtube',
    youtubeId: videoId,
    mediaId: `youtube:${videoId}`,
    uri: `https://www.youtube.com/watch?v=${videoId}`,
    title: item.snippet.title,
    artists: item.snippet.channelTitle || 'YouTube',
    channelId: item.snippet.channelId || null,
    album: 'YouTube Music',
    coverUrl: thumbnails(item.snippet),
    previewUrl: '',
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    genres: [],
  }
}

export async function searchYoutubeTracks(query, options = {}) {
  const key = youtubeApiKey()
  if (!key) throw new Error('A busca no YouTube não está configurada neste site.')

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: String(options.limit || 10),
    q: `${query} music`,
    key,
  })
  if (options.order) params.set('order', options.order)

  const response = await fetch(`${YOUTUBE_API}?${params}`)
  const result = await response.json()
  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded') {
      throw new Error('A cota diária de busca do YouTube foi atingida. Tente novamente amanhã.')
    }
    throw new Error(result.error?.message || 'Não foi possível buscar no YouTube.')
  }

  return (result.items || []).map(toYoutubeTrack).filter(Boolean)
}

// Os vídeos de música mais populares do momento (categoria "Música").
// Se o gráfico não estiver disponível, cai para a busca mais vista.
export async function youtubePopularTracks(limit = 12) {
  const key = youtubeApiKey()
  if (!key) throw new Error('A busca no YouTube não está configurada neste site.')

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,chart',
      chart: 'mostPopular',
      videoCategoryId: '10',
      regionCode: 'BR',
      maxResults: String(limit),
      key,
    })
    const response = await fetch(`${YOUTUBE_VIDEOS_API}?${params}`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error?.message || 'Gráfico indisponível.')
    const tracks = (result.items || []).map(toYoutubeTrack).filter(Boolean)
    if (!tracks.length) throw new Error('Nenhum vídeo retornado.')
    return tracks.slice(0, limit)
  } catch {
    return searchYoutubeTracks('top hits', { order: 'viewCount', limit })
  }
}

const YOUTUBE_CHANNELS_API = 'https://www.googleapis.com/youtube/v3/channels'

// Artistas das faixas: cada vídeo aponta para o canal (channelId) e uma única
// chamada em "channels" traz a foto de perfil de todos de uma vez (1 unidade
// de cota). Sem chave ou em caso de falha, vale a capa do vídeo.
export async function youtubeArtists(tracks, limit = 8) {
  const vistos = new Set()
  const artistas = []
  for (const track of tracks || []) {
    const nome = (track.artists || '').trim()
    if (!nome) continue
    const chave = nome.toLowerCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)
    artistas.push({ nome, channelId: track.channelId || null, capa: track.coverUrl || '' })
    if (artistas.length >= limit) break
  }

  const comCanal = artistas.filter((artista) => artista.channelId)
  const fotos = new Map()
  const key = youtubeApiKey()
  if (key && comCanal.length) {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        id: comCanal.map((artista) => artista.channelId).join(','),
        key,
      })
      const response = await fetch(`${YOUTUBE_CHANNELS_API}?${params}`)
      const result = await response.json()
      if (response.ok) {
        for (const canal of result.items || []) fotos.set(canal.id, thumbnails(canal.snippet))
      }
    } catch {
      // Rede fora: as capas dos vídeos continuam valendo.
    }
  }

  return artistas.map((artista, index) => ({
    id: artista.channelId || `artist-${index}-${artista.nome.toLowerCase().replace(/\W+/g, '-')}`,
    name: artista.nome,
    image: (artista.channelId && fotos.get(artista.channelId)) || artista.capa || '',
    genre: 'YouTube Music',
  }))
}

export function loadYoutubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (playerApiPromise) return playerApiPromise

  playerApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    const timeout = window.setTimeout(() => {
      playerApiPromise = null
      reject(new Error('O player do YouTube demorou para carregar. Verifique sua conexão ou bloqueadores.'))
    }, 15000)
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout)
      try {
        previousReady?.()
      } catch (error) {
        console.error('Erro no callback anterior do YouTube:', error)
      } finally {
        resolve(window.YT)
      }
    }

    let script = document.querySelector(`script[src="${YOUTUBE_PLAYER_API}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = YOUTUBE_PLAYER_API
      script.async = true
      script.addEventListener('error', () => {
        window.clearTimeout(timeout)
        script.remove()
        playerApiPromise = null
        reject(new Error('Não foi possível carregar o player do YouTube.'))
      }, { once: true })
      document.head.appendChild(script)
    } else {
      script.addEventListener('error', () => {
        window.clearTimeout(timeout)
        script.remove()
        playerApiPromise = null
        reject(new Error('Não foi possível carregar o player do YouTube.'))
      }, { once: true })
    }
  })

  return playerApiPromise
}
