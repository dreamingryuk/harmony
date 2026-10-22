import { useCallback, useEffect, useState } from 'react'
import { disconnectSpotify, spotifyToken } from '../lib/spotify'
import { connectYoutube, disconnectYoutube, isYoutubeConnected } from '../lib/youtube'

function readConnections(userId) {
  return {
    spotify: Boolean(spotifyToken()),
    youtube: isYoutubeConnected(userId),
  }
}

export function useMusicConnections(userId) {
  const [connections, setConnections] = useState(() => readConnections(userId))
  const refresh = useCallback(() => setConnections(readConnections(userId)), [userId])

  useEffect(() => {
    refresh()
    window.addEventListener('harmony-music-connections-changed', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('harmony-music-connections-changed', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return {
    connections,
    refresh,
    disconnectSpotify,
    connectYoutube: () => connectYoutube(userId),
    disconnectYoutube: () => disconnectYoutube(userId),
  }
}
