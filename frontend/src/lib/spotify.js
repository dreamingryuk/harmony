const API = 'https://api.spotify.com/v1'
const AUTH = 'https://accounts.spotify.com/authorize'
const TOKEN = 'https://accounts.spotify.com/api/token'
const KEYS = {
  verifier: 'synq_pkce_verifier',
  state: 'synq_pkce_state',
  token: 'synq_spotify_token',
}
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative', 'user-library-modify']

export const FALLBACK_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%2314b881'/%3E%3Cstop offset='1' stop-color='%2310251f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' rx='18' fill='url(%23g)'/%3E%3Cpath d='M98 37v65.5a20 20 0 1 1-10-17.3V52l35-8v48.5a20 20 0 1 1-10-17.3V37z' fill='white' fill-opacity='.92'/%3E%3C/svg%3E"

const redirectUri = () =>
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${window.location.origin}/spotify/callback`
const base64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function challenge(verifier) {
  return base64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  )
}

export function spotifyToken() {
  const raw = sessionStorage.getItem(KEYS.token)
  if (!raw) return null
  try {
    const token = JSON.parse(raw)
    if (!token.accessToken || !Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now()) {
      disconnectSpotify()
      return null
    }
    return token
  } catch {
    disconnectSpotify()
    return null
  }
}

export async function connectSpotify() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  if (!clientId) throw new Error('Configure VITE_SPOTIFY_CLIENT_ID no arquivo .env.')
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)))
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)))
  sessionStorage.setItem(KEYS.verifier, verifier)
  sessionStorage.setItem(KEYS.state, state)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
  })
  window.location.assign(`${AUTH}?${params}`)
}

export async function finishSpotifyConnection(code, state) {
  const verifier = sessionStorage.getItem(KEYS.verifier)
  if (!code || !verifier || state !== sessionStorage.getItem(KEYS.state))
    throw new Error('Não foi possível validar a conexão com Spotify.')
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error_description || 'Spotify recusou a conexão.')
  sessionStorage.setItem(
    KEYS.token,
    JSON.stringify({
      accessToken: result.access_token,
      expiresAt: Date.now() + result.expires_in * 1000,
    })
  )
  sessionStorage.removeItem(KEYS.verifier)
  sessionStorage.removeItem(KEYS.state)
  window.dispatchEvent(new Event('harmony-music-connections-changed'))
}

export function disconnectSpotify() {
  Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key))
  window.dispatchEvent(new Event('harmony-music-connections-changed'))
}

async function spotifyFetch(path, options = {}) {
  const token = spotifyToken()
  if (!token) throw new Error('Conecte sua conta Spotify para continuar.')
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(options.headers || {}),
    },
  })
  if (response.status === 401) {
    disconnectSpotify()
    throw new Error('Sua conexão Spotify expirou. Conecte novamente.')
  }
  if (response.status === 429)
    throw new Error('Spotify limitou temporariamente as buscas. Tente em instantes.')
  const body = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(body?.error?.message || 'Falha ao falar com Spotify.')
  return body
}

export function toTrack(track) {
  return {
    platform: 'spotify',
    spotifyId: track.id,
    uri: track.uri,
    title: track.name,
    artists: track.artists?.map((artist) => artist.name).join(', ') || 'Artista desconhecido',
    artistIds: (track.artists || []).map((artist) => artist.id).filter(Boolean),
    album: track.album?.name || '',
    coverUrl: track.album?.images?.find((image) => image?.url)?.url || FALLBACK_COVER,
    previewUrl: track.preview_url || '',
    spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    genres: track.genres || [],
  }
}

export function toArtist(artist) {
  return {
    id: artist.id,
    name: artist.name,
    image: artist.images?.find((image) => image?.url)?.url || '',
    url: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
    followers: artist.followers?.total ?? null,
    genres: artist.genres || [],
  }
}

export async function searchTracks(query) {
  const data = await spotifyFetch(
    `/search?${new URLSearchParams({ q: query, type: 'track', limit: '10' })}`
  )
  return data.tracks.items.map(toTrack)
}
export async function spotifyPlaylists() {
  const data = await spotifyFetch('/me/playlists?limit=50')
  return data.items
}
export async function spotifyPlaylistTracks(id) {
  const data = await spotifyFetch(`/playlists/${id}/items?limit=50`)
  return data.items
    .map((item) => item.item || item.track)
    .filter(Boolean)
    .map(toTrack)
}
export async function saveToSpotify(track) {
  return spotifyFetch('/me/library', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [track.uri] }),
  })
}

// Faixas em alta: a playlist "Today's Top Hits" funciona como termômetro do que
// está tocando no Spotify agora.
export async function spotifyPopularSongs(limit = 12) {
  const tracks = await spotifyPlaylistTracks('37i9dQZF1DXcBWIGoYBM5M')
  return tracks.slice(0, limit)
}

// Carrega até 8 artistas em uma única chamada (usado com as faixas em alta).
export async function spotifyArtists(ids) {
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean).slice(0, 8)
  if (!list.length) return []
  const data = await spotifyFetch(`/artists?ids=${list.map(encodeURIComponent).join(',')}`)
  return (data.artists || []).filter(Boolean).map(toArtist)
}

// Artistas de um gênero: o campo "genre:" do search do Spotify devolve perfis
// com foto, então dá para sugerir gente nova a partir do que a pessoa ouve.
export async function spotifyGenreArtists(genre, limit = 8) {
  const clean = String(genre || '').trim()
  if (!clean) return []
  const data = await spotifyFetch(
    `/search?${new URLSearchParams({ q: `genre:${clean}`, type: 'artist', limit: String(limit) })}`
  )
  return (data.artists?.items || []).filter(Boolean).map(toArtist)
}
