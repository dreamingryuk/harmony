import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { spotifyPlaylists, spotifyPlaylistTracks } from '../lib/spotify'
import { fromJson, trackJson } from '../utils/track'
import { playPlaylist } from '../utils/playlist'
import { CoverArt, Empty, Page, Section, TrackRow } from '../components/Media'
import { PlaylistCard, PlaylistDialog } from '../components/PlaylistComponents'

export function Library({ app }) {
  const [playlists, setPlaylists] = useState([]),
    [saved, setSaved] = useState([]),
    [imports, setImports] = useState([]),
    [loading, setLoading] = useState(false),
    [editor, setEditor] = useState(null)
  const load = useCallback(async () => {
    if (!configured) return
    const [p, s] = await Promise.all([
      supabase
        .from('playlists')
        .select('*, playlist_tracks(*)')
        .eq('owner_id', app.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('saved_tracks').select('*').eq('user_id', app.user.id),
    ])
    setPlaylists(p.data || [])
    setSaved(s.data || [])
  }, [app.user])
  useEffect(() => {
    load()
  }, [load])
  const toggle = async (track) => {
    if (!configured) return alert('Configure o Supabase para favoritar.')
    const existing = saved.find((item) => item.spotify_id === track.spotifyId)
    if (existing) await supabase.from('saved_tracks').delete().eq('id', existing.id)
    else
      await supabase.from('saved_tracks').insert({
        user_id: app.user.id,
        spotify_id: track.spotifyId,
        track: trackJson(track),
      })
    load()
  }
  const importList = async () => {
    try {
      setLoading(true)
      setImports(await spotifyPlaylists())
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }
  const importPlaylist = async (source) => {
    try {
      setLoading(true)
      const tracks = await spotifyPlaylistTracks(source.id)
      const { data: playlist, error } = await supabase
        .from('playlists')
        .insert({
          owner_id: app.user.id,
          title: source.name,
          description: source.description || '',
          is_public: app.preferences?.default_playlist_public ?? false,
          imported_spotify_id: source.id,
        })
        .select()
        .single()
      if (error) throw error
      if (tracks.length)
        await supabase.from('playlist_tracks').insert(
          tracks.map((track, position) => ({
            playlist_id: playlist.id,
            position,
            track: trackJson(track),
            spotify_id: track.spotifyId,
          }))
        )
      await load()
      setImports([])
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }
  const savedQueue = saved.map((item) => fromJson(item.track)).filter(Boolean)
  return (
    <Page title="Sua Biblioteca" subtitle="Suas playlists e favoritas, do seu jeito.">
      <div className="page-actions">
        <button className="primary" onClick={() => setEditor({})}>
          <Plus /> Nova playlist
        </button>
        <button className="secondary" onClick={importList} disabled={loading}>
          Importar do Spotify
        </button>
      </div>
      {imports.length > 0 && (
        <Section title="Escolha playlists para importar">
          {imports.map((item) => (
            <article className="import-row" key={item.id}>
              <CoverArt src={item.images?.[0]?.url} alt={`Capa de ${item.name}`} />
              <span>
                <b>{item.name}</b>
                <small>{item.tracks.total} faixas</small>
              </span>
              <button className="secondary" onClick={() => importPlaylist(item)}>
                Importar
              </button>
            </article>
          ))}
        </Section>
      )}
      <Section title={`Suas playlists${playlists.length ? ` (${playlists.length})` : ''}`}>
        {playlists.length ? (
          <div className="playlist-grid">
            {playlists.map((item) => (
              <PlaylistCard
                key={item.id}
                playlist={item}
                onOpen={setEditor}
                onEdit={setEditor}
                onShuffle={(playlist) => playPlaylist(playlist, { shuffle: true })}
              />
            ))}
          </div>
        ) : (
          <Empty text="Crie uma playlist ou importe uma do Spotify." />
        )}
      </Section>
      <Section title="Favoritas">
        {saved.length ? (
          saved.map((item) => (
            <TrackRow key={item.id} track={fromJson(item.track)} queue={savedQueue} saved onToggleSave={toggle} />
          ))
        ) : (
          <Empty text="Você ainda não favoritou nenhuma música." />
        )}
      </Section>
      {editor && <PlaylistDialog playlist={editor.id ? editor : null} app={app} onClose={() => setEditor(null)} onSaved={load} />}
    </Page>
  )
}
