import {
  isShuffleEnabled,
  nextLoopMode,
  nextQueueTrack,
  previousQueueTrack,
  queueState,
  setLoop,
  setShuffle,
  startQueue,
} from './queue'

export const trackJson = (track) => ({
  platform: track.platform || 'youtube',
  media_id: track.mediaId || track.youtubeId || track.spotifyId,
  youtube_id: track.youtubeId || null,
  uri: track.uri,
  title: track.title,
  artists: track.artists,
  album: track.album,
  cover_url: track.coverUrl,
  preview_url: track.previewUrl,
  external_url: track.externalUrl || null,
  genres: track.genres || [],
})

export const fromJson = (track) =>
  track && {
    platform: track.platform || 'youtube',
    mediaId: track.media_id || track.youtube_id || track.spotify_id,
    youtubeId: track.youtube_id || null,
    uri: track.uri,
    title: track.title,
    artists: track.artists,
    album: track.album,
    coverUrl: track.cover_url,
    previewUrl: track.preview_url,
    externalUrl: track.external_url || null,
    genres: track.genres || [],
  }

// Toca uma faixa. Quando a lista de origem é informada, ela vira a fila do
// player para que os botões de próxima/anterior naveguem nela.
export const play = (track, tracks) => {
  if (!track) return
  startQueue(tracks, track)
  window.dispatchEvent(new CustomEvent('synq-play', { detail: track }))
}

// Reproduz uma lista inteira começando pela primeira faixa. Com
// `shuffle: true` o modo aleatório é ligado e a faixa inicial é sorteada.
export const playAll = (tracks, options = {}) => {
  const items = (Array.isArray(tracks) ? tracks : []).filter(Boolean)
  if (!items.length) return false
  if (typeof options.shuffle === 'boolean') setShuffle(options.shuffle)
  const shuffled = typeof options.shuffle === 'boolean' ? options.shuffle : isShuffleEnabled()
  const start = shuffled ? items[Math.floor(Math.random() * items.length)] : items[0]
  play(start, items)
  return true
}

export const playNext = () => {
  const track = nextQueueTrack()
  if (!track) return false
  window.dispatchEvent(new CustomEvent('synq-play', { detail: track }))
  return true
}

// Retorna false quando não há faixa anterior: quem chama reinicia a atual.
export const playPrevious = () => {
  const track = previousQueueTrack()
  if (!track) return false
  window.dispatchEvent(new CustomEvent('synq-play', { detail: track }))
  return true
}

export { nextLoopMode, queueState, setLoop, setShuffle }

export const isPlaylistAttachment = (attachment) => attachment?.type === 'playlist'

export const attachmentTrack = (attachment) =>
  attachment?.type === 'track' ? fromJson(attachment.track) : fromJson(attachment)

export const playlistAttachment = (playlist) => ({
  type: 'playlist',
  playlist_id: playlist.id,
  title: playlist.title,
  description: playlist.description || '',
  cover_color: playlist.cover_color || 'green',
  track_count: playlist.playlist_tracks?.length || 0,
})
