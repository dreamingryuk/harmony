

export const trackJson = (track) => ({
  spotify_id: track.spotifyId,
  uri: track.uri,
  title: track.title,
  artists: track.artists,
  album: track.album,
  cover_url: track.coverUrl,
  preview_url: track.previewUrl,
  spotify_url: track.spotifyUrl,
  genres: track.genres || [],
})

export const fromJson = (track) =>
  track && {
    spotifyId: track.spotify_id,
    uri: track.uri,
    title: track.title,
    artists: track.artists,
    album: track.album,
    coverUrl: track.cover_url,
    previewUrl: track.preview_url,
    spotifyUrl: track.spotify_url,
    genres: track.genres || [],
  }

export const play = (track) => window.dispatchEvent(new CustomEvent('synq-play', { detail: track }))

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
