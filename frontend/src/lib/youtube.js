import { FALLBACK_COVER } from './spotify'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/search'
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

export async function searchYoutubeTracks(query) {
  const key = youtubeApiKey()
  if (!key) throw new Error('A busca no YouTube não está configurada neste site.')

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '10',
    q: `${query} music`,
    key,
  })
  const response = await fetch(`${YOUTUBE_API}?${params}`)
  const result = await response.json()
  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded') {
      throw new Error('A cota diária de busca do YouTube foi atingida. Tente novamente amanhã.')
    }
    throw new Error(result.error?.message || 'Não foi possível buscar no YouTube.')
  }

  return (result.items || [])
    .filter((item) => item.id?.videoId && item.snippet)
    .map((item) => {
      const videoId = item.id.videoId
      return {
        platform: 'youtube',
        youtubeId: videoId,
        spotifyId: `youtube:${videoId}`,
        uri: `https://www.youtube.com/watch?v=${videoId}`,
        title: item.snippet.title,
        artists: item.snippet.channelTitle || 'YouTube',
        album: 'YouTube Music',
        coverUrl:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          FALLBACK_COVER,
        previewUrl: '',
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        genres: [],
      }
    })
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
