import { useState } from 'react'
import { ExternalLink, Eye, ListMusic, Play, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { searchTracks } from '../lib/spotify'
import { attachmentTrack, fromJson, isPlaylistAttachment, play, playlistAttachment, trackJson } from '../utils/track'
import { CoverArt } from './Media'

export function AttachmentCard({ attachment, onOpenPlaylist, compact = false }) {
  if (!attachment) return null
  if (isPlaylistAttachment(attachment)) {
    return (
      <button className={`attachment playlist-attachment ${compact ? 'compact' : ''}`} onClick={() => onOpenPlaylist?.(attachment.playlist_id)}>
        <span className="playlist-art small"><ListMusic /></span>
        <span><b>{attachment.title}</b><small>Playlist · {attachment.track_count || 0} faixas</small></span>
        <ExternalLink />
      </button>
    )
  }
  const track = attachmentTrack(attachment)
  if (!track) return null
  return <button className={`attachment track-attachment ${compact ? 'compact' : ''}`} onClick={() => play(track)}><CoverArt src={track.coverUrl} alt={`Capa de ${track.album}`} /><span><b>{track.title}</b><small>{track.artists}</small></span><Play fill="currentColor" /></button>
}

export function PlaylistDialog({ playlist, app, onClose, onSaved, readOnly = false }) {
  const [draft, setDraft] = useState({
    title: playlist?.title || '',
    description: playlist?.description || '',
    is_public: playlist?.is_public ?? app.preferences?.default_playlist_public ?? false,
  })
  const [tracks, setTracks] = useState(playlist?.playlist_tracks || [])
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [busy, setBusy] = useState(false)
  const isNew = !playlist?.id
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
    try { setBusy(true); setResults(await searchTracks(query.trim())) } catch (error) { alert(error.message) } finally { setBusy(false) }
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
    <div className="modal-tracks"><h3>Faixas ({tracks.length})</h3>{tracks.length ? tracks.map((item) => { const track = fromJson(item.track); return <div className="modal-track" key={item.id}><button onClick={() => play(track)}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span></button>{!readOnly && <button className="icon danger" aria-label="Remover faixa" onClick={() => removeTrack(item.id)}><Trash2 /></button>}</div> }) : <p className="hint">Nenhuma faixa adicionada ainda.</p>}</div>
    {!readOnly && !isNew && <><form className="inline-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar faixa no Spotify" /><button className="secondary" disabled={busy}>Buscar</button></form>{results.map((track) => <button className="search-result" key={track.spotifyId} onClick={() => addTrack(track)}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span><Plus /></button>)}</>}
    {!readOnly && <footer className="modal-actions">{!isNew && <button className="danger-button" onClick={removePlaylist}><Trash2 /> Excluir</button>}<span /><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy} onClick={save}>Salvar</button></footer>}
  </section></div>
}

export function SharePicker({ playlists = [], attachment, onChange }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [results, setResults] = useState([]), [busy, setBusy] = useState(false)
  const search = async (event) => {
    event.preventDefault(); if (!query.trim()) return
    try { setBusy(true); setResults(await searchTracks(query.trim())) } catch (error) { alert(error.message) } finally { setBusy(false) }
  }
  return <div className="share-picker">
    {attachment ? <div className="attached"><AttachmentCard attachment={attachment} compact /><button className="icon" aria-label="Remover anexo" onClick={() => onChange(null)}><X /></button></div> : <button type="button" className="secondary small-button" onClick={() => setOpen(!open)}><Plus /> Música ou playlist</button>}
    {open && !attachment && <div className="share-menu"><form className="inline-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar música no Spotify" /><button className="secondary" disabled={busy}>Buscar</button></form>{results.map((track) => <button type="button" className="search-result" key={track.spotifyId} onClick={() => { onChange({ type: 'track', track: trackJson(track) }); setOpen(false) }}><CoverArt src={track.coverUrl} /><span><b>{track.title}</b><small>{track.artists}</small></span><Plus /></button>)}<b className="picker-label">Suas playlists públicas</b>{playlists.length ? playlists.map((playlist) => <button type="button" className="search-result" key={playlist.id} onClick={() => { onChange(playlistAttachment(playlist)); setOpen(false) }}><span className="playlist-art small"><ListMusic /></span><span><b>{playlist.title}</b><small>{playlist.playlist_tracks?.length || 0} faixas</small></span><Plus /></button>) : <p className="hint">Marque uma playlist como pública para compartilhá-la.</p>}</div>}
  </div>
}
