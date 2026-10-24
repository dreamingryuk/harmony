import { configured, supabase } from '../lib/supabase'
import { fromJson, playAll } from './track'

// A ordem das faixas dentro de uma playlist vem do campo `position`.
export const sortedRows = (rows) =>
  [...(Array.isArray(rows) ? rows : [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0))

// Converte as linhas salvas em faixas prontas para o player.
export const playlistQueue = (playlist) =>
  sortedRows(playlist?.playlist_tracks)
    .map((row) => fromJson(row.track))
    .filter(Boolean)

// A capa da playlist é a capa da primeira faixa da lista.
export const playlistCover = (playlist) => playlistQueue(playlist)[0]?.coverUrl || ''

export const playPlaylist = (playlist, options) => playAll(playlistQueue(playlist), options)

// Busca uma playlist (própria ou pública) já com as faixas na ordem certa.
export async function loadPlaylist(id) {
  if (!configured || !id) return null
  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_tracks(*)')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return { ...data, playlist_tracks: sortedRows(data.playlist_tracks) }
}
