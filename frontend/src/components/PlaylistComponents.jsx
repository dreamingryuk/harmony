import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Eye, ListMusic, Play, Plus, Trash2, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { searchTracks } from '../lib/spotify'
import { searchYoutubeTracks } from '../lib/youtube'
import { useMusicConnections } from '../hooks/useMusicConnections'
import { attachmentTrack, fromJson, isPlaylistAttachment, play, playlistAttachment, trackJson } from '../utils/track'
import { CoverArt } from './Media'

const platformLabel = (platform) => (platform === 'youtube' ? 'YouTube Music' : 'Spotify')

export function AttachmentCard({ attachment, onOpenPlaylist, compact = false }) {
  if (!attachment) return null
  if (isPlaylistAttachment(attachment)) {
    return (
      <button type="button" className={`attachment playlist-attachment ${compact ? 'compact' : ''}`} onClick={() => onOpenPlaylist?.(attachment.playlist_id)}>
        <span className="playlist-art small"><ListMusic /></span>
        <span><b>{attachment.title}</b><small>Playlist · {attachment.track_count || 0} faixas</small></span>
        <ExternalLink />
      </button>
    )
  }
  const track = attachmentTrack(attachment)
  if (!track) return null
  return <button type="button" className={`attachment track-attachment ${compact ? 'compact' : ''}`} onClick={() => play(track)}><CoverArt src={track.coverUrl} alt={`Capa de ${track.album}`} /><span><b>{track.title}</b><small>{track.artists}</small></span><Play fill="currentColor" /></button>
}

export function PlaylistDialog({ playlist, app, onClose, onSaved, readOnly = false }) {
  const [draft, setDraft] = useState({
    title: playlist?.title || '',
    description: playlist?.description || '',
    is_public: playlist?.is_public ?? app.preferences?.default_playlist_public ?? false,
  })
  const [tracks, setTracks] = useState(playlist?.playlist_tracks || [])
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [busy, setBusy] = useState(false), [platform, setPlatform] = useState('spotify')
  const isNew = !playlist?.id
  const { connections } = useMusicConnections(app.user.id)
  const availablePlatforms = Object.entries(connections).filter(([, connected]) => connected).map(([name]) => name)

  useEffect(() => {
    if (!connections[platform] && availablePlatforms.length) setPlatform(availablePlatforms[0])
  }, [availablePlatforms, connections, platform])

  const modalTracks = tracks
    .map((item) => ({ id: item.id, track: fromJson(item.track) }))
    .filter((entry) => entry.track)
  const modalQueue = modalTracks.map((entry) => entry.track)
  const save = async () => {
    if (!draft.title.trim()) return alert('Dê um nome à playlist.')
    try {
      setBusy(true)
      const data = { title: draft.title.trim(), description: draft.description.trim(), is_public: draft.is_public }
      const response = isNew ? await supabase.from('playlists').insert({ ...data, owner_id: app.user.id }).select('*, playlist_tracks(*)').single() : await supabase.from('playlists').update(data).eq('id', playlist.id).select('*, playlist_tracks(*)').single()
      if (response.error) throw response.error
      onSaved(response.data); onClose()
    } catch (error) { alert(`Não foi possível salvar: ${error.message}`) } finally { setBusy(false) }
  }
  const removePlaylist = async () => {
    if (!window.confirm(`Excluir “${playlist.title}”? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('playlists').delete().eq('id', playlist.id)
    if (error) return alert(error.message)
    onSaved(null); onClose()
  }
  const search = async (event) => {
    event.preventDefault(); if (!query.trim()) return
    if (!connections[platform]) return alert('Conecte uma plataforma de música para buscar faixas.')
    try {
      setBusy(true)
      setResults(
        platform === 'youtube'
          ? await searchYoutubeTracks(query.trim())
          : await searchTracks(query.trim())
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  const addTrack = async (track) => {
    if (isNew) return alert('Salve a playlist antes de adicionar faixas.')
    const { data, error } = await supabase.from('playlist_tracks').insert({ playlist_id: playlist.id, spotify_id: track.spotifyId, position: tracks.length, track: trackJson(track) }).select().single()
    if (error) return alert(error.message.includes('unique') ? 'Essa faixa já está na playlist.' : error.message)
    setTracks((items) => [...items, data]); setResults([]); setQuery('')
  }
  const removeTrack = async (id) => {
    const { error } = await supabase.from('playlist_tracks').delete().eq('id', id)
    if (error) return alert(error.message)
    setTracks((items) => items.filter((item) => item.id !== id))
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal playlist-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className="eyebrow"><ListMusic /> PLAYLIST</span><h2>{readOnly ? playlist.title : isNew ? 'Nova playlist' : 'Editar playlist'}</h2></div><button className="icon" aria-label="Fechar" onClick={onClose}><X /></button></header>
    {readOnly ? <><p className="playlist-description">{playlist.description || 'Sem descrição.'}</p><p className="playlist-status"><Eye /> Playlist pública</p></> : <div className="editor-fields"><label>Nome<input value={draft.title} maxLength="100" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Descrição<textarea value={draft.description} maxLength="500" onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className="toggle"><input type="checkbox" checked={draft.is_public} onChange={(event) => setDraft({ ...draft, is_public: event.target.checked })} /> <span>Playlist pública</span></label>{playlist?.imported_spotify_id && <p className="hint">Esta é uma cópia importada. Alterações não são enviadas ao Spotify.</p>}</div>}
    <div className="modal-tracks"><h3>Faixas ({modalTracks.length})</h3>{modalTracks.length ? modalTracks.map(({ id, track }) => <div className="modal-track" key={id}><button onClick={() => play(track, modalQueue)}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span></button>{!readOnly && <button className="icon danger" aria-label="Remover faixa" onClick={() => removeTrack(id)}><Trash2 /></button>}</div>) : <p className="hint">Nenhuma faixa adicionada ainda.</p>}</div>
    {!readOnly && !isNew && <>{availablePlatforms.length > 1 && <label className="music-source">Buscar em
      <select value={platform} onChange={(event) => { setPlatform(event.target.value); setResults([]) }}>
        {availablePlatforms.map((name) => <option key={name} value={name}>{platformLabel(name)}</option>)}
      </select>
    </label>}{!availablePlatforms.length && <p className="hint">Conecte uma plataforma na aba Descobrir para buscar faixas.</p>}<form className="inline-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={platform === 'youtube' ? 'Buscar faixa no YouTube' : 'Buscar faixa no Spotify'} disabled={!connections[platform]} /><button className="secondary" disabled={busy || !connections[platform]}>Buscar</button></form>{results.map((track) => <button className="search-result" key={track.spotifyId} onClick={() => addTrack(track)}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span><Plus /></button>)}</>}
    {!readOnly && <footer className="modal-actions">{!isNew && <button className="danger-button" onClick={removePlaylist}><Trash2 /> Excluir</button>}<span /><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy} onClick={save}>Salvar</button></footer>}
  </section></div>
}

export function SharePicker({ playlists = [], attachment, onChange, userId }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [results, setResults] = useState([]), [busy, setBusy] = useState(false), [platform, setPlatform] = useState('spotify')
  const { connections } = useMusicConnections(userId)
  const availablePlatforms = Object.entries(connections).filter(([, connected]) => connected).map(([name]) => name)

  useEffect(() => {
    if (!connections[platform] && availablePlatforms.length) setPlatform(availablePlatforms[0])
  }, [availablePlatforms, connections, platform])

  const search = async () => {
    if (!query.trim()) return
    if (!connections[platform]) return alert('Conecte uma plataforma de música para pesquisar.')
    try {
      setBusy(true)
      setResults(
        platform === 'youtube'
          ? await searchYoutubeTracks(query.trim())
          : await searchTracks(query.trim())
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    search()
  }
  return <div className="share-picker">
    {attachment ? <div className="attached"><AttachmentCard attachment={attachment} compact /><button type="button" className="icon" aria-label="Remover anexo" onClick={() => onChange(null)}><X /></button></div> : <button type="button" className="secondary small-button" onClick={() => setOpen(!open)}><Plus /> Música ou playlist</button>}
    {open && !attachment && <div className="share-menu">
      {availablePlatforms.length > 1 && <label className="music-source">Pesquisar em
        <select value={platform} onChange={(event) => { setPlatform(event.target.value); setResults([]) }}>
          {availablePlatforms.map((name) => <option key={name} value={name}>{platformLabel(name)}</option>)}
        </select>
      </label>}
      <div className="inline-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder={platform === 'youtube' ? 'Buscar música no YouTube' : 'Buscar música no Spotify'} disabled={!connections[platform]} /><button type="button" className="secondary" onClick={search} disabled={busy || !connections[platform]}>Buscar</button></div>
      {!availablePlatforms.length && <p className="hint">Conecte uma plataforma na aba Descobrir para pesquisar músicas.</p>}
      {results.map((track) => <button type="button" className="search-result" key={track.spotifyId} onClick={() => { onChange({ type: 'track', track: trackJson(track) }); setOpen(false) }}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span><Plus /></button>)}
      <b className="picker-label">Suas playlists públicas</b>
      {playlists.length ? playlists.map((playlist) => <button type="button" className="search-result" key={playlist.id} onClick={() => { onChange(playlistAttachment(playlist)); setOpen(false) }}><span className="playlist-art small"><ListMusic /></span><span><b>{playlist.title}</b><small>{playlist.playlist_tracks?.length || 0} faixas</small></span><Plus /></button>) : <p className="hint">Marque uma playlist como pública para compartilhá-la.</p>}
    </div>}
  </div>
}

// Anexa a faixa que está no player a uma playlist existente ou a uma nova.
export function AddToPlaylistDialog({ track, app, onClose }) {
  const [playlists, setPlaylists] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(''),
    [isPublic, setIsPublic] = useState(app.preferences?.default_playlist_public ?? false),
    [feedback, setFeedback] = useState(null)

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('playlists')
      .select('id, title, is_public, playlist_tracks(position)')
      .eq('owner_id', app.user.id)
      .order('created_at', { ascending: false })
    if (error) setFeedback({ text: `Não foi possível carregar suas playlists: ${error.message}`, error: true })
    else setPlaylists(data || [])
    setLoading(false)
  }, [app.user.id])

  useEffect(() => {
    load()
  }, [load])

  const nextPosition = (playlist) =>
    (playlist.playlist_tracks || []).reduce((max, item) => Math.max(max, (item.position ?? 0) + 1), 0)

  const insertTrack = async (playlist) => {
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlist.id,
      spotify_id: track.spotifyId,
      position: nextPosition(playlist),
      track: trackJson(track),
    })
    if (error) throw error
  }

  const addTo = async (playlist) => {
    if (!configured || busy) return
    try {
      setBusy(true)
      setFeedback(null)
      await insertTrack(playlist)
      setFeedback({ text: `“${track.title}” foi adicionada à playlist “${playlist.title}”.`, error: false })
      await load()
    } catch (error) {
      setFeedback({
        text: error.message.includes('unique')
          ? `“${track.title}” já está na playlist “${playlist.title}”.`
          : `Não foi possível adicionar: ${error.message}`,
        error: true,
      })
    } finally {
      setBusy(false)
    }
  }

  const createAndAdd = async (event) => {
    event.preventDefault()
    const name = title.trim()
    if (!name) return setFeedback({ text: 'Dê um nome à playlist.', error: true })
    if (!configured || busy) return
    try {
      setBusy(true)
      setFeedback(null)
      const { data: playlist, error } = await supabase
        .from('playlists')
        .insert({ owner_id: app.user.id, title: name, description: '', is_public: isPublic })
        .select('id, title, is_public, playlist_tracks(position)')
        .single()
      if (error) throw error
      await insertTrack(playlist)
      setCreating(false)
      setTitle('')
      setFeedback({ text: `Playlist “${name}” criada com “${track.title}”.`, error: false })
      await load()
    } catch (error) {
      setFeedback({ text: `Não foi possível criar a playlist: ${error.message}`, error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal playlist-modal add-to-playlist"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-playlist-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow"><ListMusic /> PLAYLIST</span>
            <h2 id="add-to-playlist-title">Adicionar à playlist</h2>
          </div>
          <button className="icon" aria-label="Fechar" onClick={onClose}><X /></button>
        </header>
        <div className="attachment add-to-playlist-track">
          <CoverArt src={track.coverUrl} alt={`Capa de ${track.album}`} />
          <span><b>{track.title}</b><small>{track.artists}</small></span>
        </div>
        {!configured ? (
          <p className="hint">Configure o Supabase para salvar em playlists.</p>
        ) : (
          <>
            <div className="modal-tracks">
              <h3>Suas playlists</h3>
              {loading ? (
                <p className="hint">Carregando playlists...</p>
              ) : playlists.length ? (
                playlists.map((playlist) => (
                  <div className="modal-track" key={playlist.id}>
                    <button type="button" onClick={() => addTo(playlist)} disabled={busy}>
                      <span className="playlist-art small"><ListMusic /></span>
                      <span>
                        <b>{playlist.title}</b>
                        <small>{playlist.playlist_tracks?.length || 0} faixas · {playlist.is_public ? 'Pública' : 'Privada'}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Adicionar à playlist ${playlist.title}`}
                      disabled={busy}
                      onClick={() => addTo(playlist)}
                    >
                      <Plus />
                    </button>
                  </div>
                ))
              ) : (
                <p className="hint">Você ainda não tem playlists. Crie a primeira abaixo.</p>
              )}
            </div>
            {!creating ? (
              <button type="button" className="secondary" onClick={() => setCreating(true)}>
                <Plus /> Nova playlist
              </button>
            ) : (
              <form className="editor-fields add-to-playlist-form" onSubmit={createAndAdd}>
                <label>
                  Nome da playlist
                  <input value={title} maxLength="100" autoFocus onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />{' '}
                  <span>Playlist pública</span>
                </label>
                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={() => { setCreating(false); setFeedback(null) }}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? 'Adicionando...' : 'Criar e adicionar'}
                  </button>
                </div>
              </form>
            )}
            {feedback && (
              <p className={feedback.error ? 'form-error' : 'playlist-status'} role="status">
                {feedback.text}
              </p>
            )}
          </>
        )}
        <footer className="modal-actions">
          <span />
          <button type="button" className="secondary" onClick={onClose}>Concluir</button>
        </footer>
      </section>
    </div>
  )
}
