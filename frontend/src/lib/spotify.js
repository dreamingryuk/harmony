const API = 'https://api.spotify.com/v1'
const AUTH = 'https://accounts.spotify.com/authorize'
const TOKEN = 'https://accounts.spotify.com/api/token'
const KEYS = {
  verifier: 'synq_pkce_verifier',
  state: 'synq_pkce_state',
  token: 'synq_spotify_token',
}
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative', 'user-library-modify']

const redirectUri = () => `${window.location.origin}/spotify/callback`
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
  if (!code || state !== sessionStorage.getItem(KEYS.state))
    throw new Error('Não foi possível validar a conexão com Spotify.')
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: sessionStorage.getItem(KEYS.verifier),
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
}

export function disconnectSpotify() {
  Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key))
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
    spotifyId: track.id,
    uri: track.uri,
    title: track.name,
    artists: track.artists?.map((artist) => artist.name).join(', ') || 'Artista desconhecido',
    album: track.album?.name || '',
    coverUrl: track.album?.images?.[0]?.url || '',
    previewUrl: track.preview_url || '',
    spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    genres: track.genres || [],
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
