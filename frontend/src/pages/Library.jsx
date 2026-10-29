import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { fromJson, trackJson } from '../utils/track'
import { playPlaylist } from '../utils/playlist'
import { Empty, Page, Section, TrackRow } from '../components/Media'
import { PlaylistCard, PlaylistDialog } from '../components/PlaylistComponents'

export function Library({ app }) {
  const [playlists, setPlaylists] = useState([]),
    [saved, setSaved] = useState([]),
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
    const existing = saved.find((item) => item.spotify_id === (track.mediaId || track.youtubeId))
    if (existing) await supabase.from('saved_tracks').delete().eq('id', existing.id)
    else
      await supabase.from('saved_tracks').insert({
        user_id: app.user.id,
        spotify_id: track.mediaId || track.youtubeId,
        track: trackJson(track),
      })
    load()
  }
  const savedQueue = saved.map((item) => fromJson(item.track)).filter(Boolean)
  return (
    <Page title="Sua Biblioteca" subtitle="Suas playlists e favoritas, do seu jeito.">
      <div className="page-actions">
        <button className="primary" onClick={() => setEditor({})}>
          <Plus /> Nova playlist
        </button>
      </div>
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
          <Empty text="Crie uma playlist para guardar suas músicas." />
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
