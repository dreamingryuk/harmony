import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Heart,
  Home,
  Library as LibraryIcon,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  UserRound,
  BarChart3,
  Bell,
  Camera,
  Eye,
  EyeOff,
  ListMusic,
  LogOut,
  Pencil,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react'
import { configured, ensureProfile, supabase } from './lib/supabase'
import {
  connectSpotify,
  disconnectSpotify,
  finishSpotifyConnection,
  saveToSpotify,
  searchTracks,
  spotifyPlaylistTracks,
  spotifyPlaylists,
  spotifyToken,
  FALLBACK_COVER,
} from './lib/spotify'
import './App.css'

const featured = [
  {
    spotifyId: '4uLU6hMCjMI75M1A2tKUQC',
    uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
    title: 'Never Gonna Give You Up',
    artists: 'Rick Astley',
    album: 'Whenever You Need Somebody',
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b2734f0f674e1453a0a5be8e7a0e',
    previewUrl: '',
    spotifyUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    genres: ['Pop'],
  },
  {
    spotifyId: '0VjIjW4GlUZAMYd2vXMi3b',
    uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
    title: 'Blinding Lights',
    artists: 'The Weeknd',
    album: 'After Hours',
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b2738ad039bcb1d5b3b0b4155f52',
    previewUrl: '',
    spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
    genres: ['Pop'],
  },
]
const nav = [
  ['/', 'Descobrir', Home],
  ['/biblioteca', 'Biblioteca', LibraryIcon],
  ['/comunidade', 'Comunidade', Users],
  ['/mensagens', 'Mensagens', MessageCircle],
  ['/retrospectiva', 'Retrospectiva', BarChart3],
  ['/perfil', 'Perfil', UserRound],
]
const demoUser = { id: 'demo-user', email: 'demo@synq.app' }
const initials = (name = 'S') =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
const trackJson = (track) => ({
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
const fromJson = (track) =>
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
const play = (track) => window.dispatchEvent(new CustomEvent('synq-play', { detail: track }))
const normalise = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const isPlaylistAttachment = (attachment) => attachment?.type === 'playlist'
const attachmentTrack = (attachment) =>
  attachment?.type === 'track' ? fromJson(attachment.track) : fromJson(attachment)
const playlistAttachment = (playlist) => ({
  type: 'playlist',
  playlist_id: playlist.id,
  title: playlist.title,
  description: playlist.description || '',
  cover_color: playlist.cover_color || 'green',
  track_count: playlist.playlist_tracks?.length || 0,
})
const GENRES = [
  'Afrobeats', 'Alternativo', 'Ambient', 'Axé', 'Blues', 'Bossa Nova', 'Breakbeat', 'Chillout',
  'Clássica', 'Country', 'Dance', 'Disco', 'Drum and Bass', 'Dub', 'EDM', 'Eletrônica', 'Emo',
  'Folk', 'Forró', 'Funk', 'Funk carioca', 'Gospel', 'Grime', 'Heavy Metal', 'Hip Hop', 'House',
  'Indie', 'Instrumental', 'Jazz', 'K-pop', 'Lo-fi', 'Música latina', 'MPB', 'New Wave', 'Pagode',
  'Pop', 'Pop punk', 'Post-punk', 'Psicodélico', 'Punk', 'R&B', 'Rap', 'Reggae', 'Reggaeton',
  'Rock', 'Rock alternativo', 'Rock brasileiro', 'Samba', 'Sertanejo', 'Soul', 'Synthpop', 'Techno',
  'Trance', 'Trap', 'Vaporwave'
].sort((a, b) => a.localeCompare(b, 'pt-BR'))

function CoverArt({ src, alt = '', className }) {
  return (
    <img
      className={className}
      src={src || FALLBACK_COVER}
      alt={alt}
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = FALLBACK_COVER
      }}
    />
  )
}

function Avatar({ profile, className = '' }) {
  if (profile?.avatar_url) {
    return (
      <span className={`avatar avatar-image ${className}`}>
        {initials(profile.display_name)}
        <img src={profile.avatar_url} alt={`Foto de ${profile.display_name || 'usuário'}`} onError={(event) => event.currentTarget.remove()} />
      </span>
    )
  }
  return <span className={`avatar ${className}`}>{initials(profile?.display_name)}</span>
}

function useUnreadMessages(userId) {
  const [unreadIds, setUnreadIds] = useState(new Set())
  const [unreadSenders, setUnreadSenders] = useState(new Set())
  const load = useCallback(async () => {
    if (!configured || !userId) return
    const [{ data: received, error: messagesError }, { data: receipts, error: receiptsError }] =
      await Promise.all([
        supabase.from('messages').select('id, sender_id').eq('recipient_id', userId),
        supabase.from('message_reads').select('message_id').eq('user_id', userId),
      ])
    // A migration ainda não executada não deve impedir o restante do aplicativo de abrir.
    if (messagesError || receiptsError) return
    const readIds = new Set((receipts || []).map((receipt) => receipt.message_id))
    const unread = (received || []).filter((message) => !readIds.has(message.id))
    setUnreadIds(new Set(unread.map((message) => message.id)))
    setUnreadSenders(new Set(unread.map((message) => message.sender_id)))
  }, [userId])
  useEffect(() => {
    load()
    if (!configured || !userId) return undefined
    const channel = supabase
      .channel(`synq-unread-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (
          payload.new.recipient_id === userId &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('Harmony', { body: 'Você recebeu uma nova mensagem.' })
        }
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, userId])
  return { unreadIds, unreadSenders, unreadCount: unreadIds.size, refreshUnread: load }
}

function useSynq() {
  const [user, setUser] = useState(null),
    [profile, setProfile] = useState(null),
    [ready, setReady] = useState(!configured)
  const refreshProfile = useCallback(async (authUser) => {
    if (!configured)
      return setProfile({
        id: demoUser.id,
        display_name: 'Visitante Harmony',
        favorite_genres: ['Pop'],
      })
    setProfile(await ensureProfile(authUser))
  }, [])
  useEffect(() => {
    if (!configured) {
      setUser(demoUser)
      return
    }
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error
        setUser(data.session?.user || null)
        if (data.session?.user) await refreshProfile(data.session.user)
      })
      .catch((error) => console.error('Não foi possível carregar a sessão:', error))
      .finally(() => setReady(true))
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      if (session?.user) await refreshProfile(session.user)
      else setProfile(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [refreshProfile])
  return { user, profile, ready, refreshProfile, demo: !configured }
}

function Auth() {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = register
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setMessage(
        result.error?.message || (register ? 'Conta criada. Confira seu e-mail.' : 'Entrando...')
      )
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir a autenticação.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth">
      <section className="auth-art">
        <div className="brand">
          <Music2 /> Harmony
        </div>
        <div className="equalizer">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ height: `${18 + ((i * 13) % 70)}px` }} />
          ))}
        </div>
        <h1>
          Seu som.
          <br />
          Sua comunidade.
        </h1>
        <p>Descubra, compartilhe e guarde os momentos que viraram trilha sonora.</p>
      </section>
      <section className="auth-form">
        <h2>{register ? 'Crie seu espaço' : 'Bem-vindo de volta'}</h2>
        <p>Entre para continuar ouvindo.</p>
        <div className="switch">
          <button className={!register ? 'active' : ''} onClick={() => setRegister(false)}>
            Entrar
          </button>
          <button className={register ? 'active' : ''} onClick={() => setRegister(true)}>
            Criar conta
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Senha
            <input
              required
              minLength="6"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Aguarde...' : register ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        <button
          className="secondary"
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin },
            })
          }
        >
          Continuar com Google
        </button>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  )
}

function Shell({ app, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = async () => {
    if (configured) await supabase.auth.signOut()
    navigate('/')
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Music2 /> Harmony
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink end={to === '/'} key={to} to={to}>
              <Icon />
              {label}
              {to === '/mensagens' && app.unreadCount > 0 && (
                <span className="nav-badge" aria-label={`${app.unreadCount} mensagens não lidas`}>
                  {app.unreadCount > 99 ? '99+' : app.unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <button className="profile-short" onClick={() => navigate('/perfil')}>
            <Avatar profile={app.profile} />
            {app.profile?.display_name || 'Ouvinte'}
          </button>
          <button className="logout" onClick={logout}>
            <LogOut /> Sair
          </button>
        </div>
      </aside>
      <main className="content">
        {app.demo && (
          <div className="demo-banner">
            Modo demonstração: configure o Supabase para salvar e conversar de verdade.
          </div>
        )}
        {children}
      </main>
      <nav className="bottom-nav">
        {nav.slice(0, 5).map(([to, label, Icon]) => (
          <NavLink
            end={to === '/'}
            key={to}
            to={to}
            className={location.pathname === to ? 'active' : ''}
          >
            <Icon />
            <span>{label}</span>
            {to === '/mensagens' && app.unreadCount > 0 && <i className="nav-dot" />}
          </NavLink>
        ))}
      </nav>
      <Player app={app} />
    </div>
  )
}

function Player({ app }) {
  const [track, setTrack] = useState(null),
    [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(0)
  const audio = useRef(null),
    logged = useRef(new Set())
  useEffect(() => {
    const listener = (event) => {
      setTrack(event.detail)
      setPlaying(false)
      setProgress(0)
    }
    window.addEventListener('synq-play', listener)
    return () => window.removeEventListener('synq-play', listener)
  }, [])
  const toggle = async () => {
    if (!track) return
    if (!track.previewUrl) return window.open(track.spotifyUrl, '_blank', 'noopener')
    if (playing) {
      audio.current.pause()
      setPlaying(false)
    } else {
      await audio.current.play()
      setPlaying(true)
      if (configured && !logged.current.has(track.spotifyId)) {
        logged.current.add(track.spotifyId)
        await supabase.from('listening_events').insert({
          user_id: app.user.id,
          track: trackJson(track),
          artist_name: track.artists,
          genres: track.genres || [],
        })
      }
    }
  }
  if (!track) return null
  return (
    <footer className="player">
      <audio
        ref={audio}
        src={track.previewUrl}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <CoverArt src={track.coverUrl} />
      <div className="player-track">
        <b>{track.title}</b>
        <span>{track.artists}</span>
      </div>
      <button className="play" onClick={toggle}>
        {playing ? 'Ⅱ' : <Play fill="currentColor" />}
      </button>
      <input
        aria-label="Progresso"
        className="progress"
        type="range"
        min="0"
        max={duration || 1}
        value={progress}
        onChange={(e) => {
          audio.current.currentTime = +e.target.value
          setProgress(+e.target.value)
        }}
      />
      <a title="Abrir no Spotify" href={track.spotifyUrl} target="_blank" rel="noreferrer">
        <ExternalLink />
      </a>
    </footer>
  )
}

function TrackRow({ track, saved, onToggleSave }) {
  const [saving, setSaving] = useState(false)
  const spotifySave = async () => {
    try {
      setSaving(true)
      await saveToSpotify(track)
      alert('Faixa salva nos seus favoritos do Spotify!')
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <article className="track-row">
      <CoverArt src={track.coverUrl} alt={`Capa de ${track.album}`} />
      <button className="track-copy" onClick={() => play(track)}>
        <b>{track.title}</b>
        <span>
          {track.artists} · {track.album}
        </span>
      </button>
      <button className="icon" onClick={() => play(track)}>
        <Play />
      </button>
      {onToggleSave && (
        <button className={`icon ${saved ? 'liked' : ''}`} onClick={() => onToggleSave(track)}>
          <Heart fill={saved ? 'currentColor' : 'none'} />
        </button>
      )}
      <button disabled={saving} className="icon spotify" onClick={spotifySave}>
        <Music2 />
      </button>
    </article>
  )
}
function Page({ title, subtitle, children }) {
  return (
    <div className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      {children}
    </div>
  )
}
function Section({ title, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
function Empty({ text }) {
  return (
    <div className="empty">
      <Music2 />
      <p>{text}</p>
    </div>
  )
}

function Discover({ app }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [spotifyConnected, setSpotifyConnected] = useState(Boolean(spotifyToken()))
  const handleSpotifyConnection = async () => {
    try {
      if (spotifyConnected) {
        disconnectSpotify()
        setSpotifyConnected(false)
        return
      }
      await connectSpotify()
    } catch (error) {
      alert(error.message)
    }
  }
  const search = async (event) => {
    event.preventDefault()
    if (!query.trim()) return
    try {
      setBusy(true)
      setResults(await searchTracks(query))
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Page
      title={`Olá, ${(app.profile?.display_name || 'ouvinte').split(' ')[0]}`}
      subtitle="Encontre algo que combine com o seu momento."
    >
      <section className="hero">
        <div>
          <span className="eyebrow">
            <Sparkles /> DESCOBERTA DIÁRIA
          </span>
          <h2>O próximo som que vai virar seu favorito.</h2>
          <p>
            Conecte seu Spotify, importe suas playlists e encontre gente que vibra na mesma
            frequência.
          </p>
          <button className="primary" onClick={handleSpotifyConnection}>
            {spotifyConnected ? 'Desconectar Spotify' : 'Conectar Spotify'}
          </button>
        </div>
        <Music2 className="hero-icon" />
      </section>
      <form className="search" onSubmit={search}>
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            spotifyConnected
              ? 'Busque uma faixa, álbum ou artista...'
              : 'Conecte o Spotify para buscar no catálogo'
          }
          disabled={!spotifyConnected}
        />
        <button disabled={busy || !spotifyConnected}>Buscar</button>
      </form>
      <Section title={results.length ? 'Resultados da busca' : 'Em alta no Harmony'}>
        {(results.length ? results : featured).map((track) => (
          <TrackRow key={track.spotifyId} track={track} />
        ))}
      </Section>
      <section className="embed-grid">
        <iframe
          title="Today’s Top Hits"
          src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
        <iframe
          title="RapCaviar"
          src="https://open.spotify.com/embed/playlist/37i9dQZF1DX0XUsuxWHRQd?utm_source=generator"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </section>
    </Page>
  )
}

function AttachmentCard({ attachment, onOpenPlaylist, compact = false }) {
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

function PlaylistDialog({ playlist, app, onClose, onSaved, readOnly = false }) {
  const [draft, setDraft] = useState({ title: playlist?.title || '', description: playlist?.description || '', is_public: playlist?.is_public || false })
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

function Library({ app }) {
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
          is_public: false,
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
  return (
    <Page title="Sua Biblioteca" subtitle="Suas músicas e coleções, do seu jeito.">
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
      <Section title="Favoritas">
        {saved.length ? (
          saved.map((item) => (
            <TrackRow key={item.id} track={fromJson(item.track)} saved onToggleSave={toggle} />
          ))
        ) : (
          <Empty text="Você ainda não favoritou nenhuma música." />
        )}
      </Section>
      <Section title="Suas playlists">
        <div className="playlist-grid">
          {playlists.map((item) => (
            <button className="playlist-card" key={item.id} onClick={() => setEditor(item)}>
              <div className="playlist-art">
                <Music2 />
              </div>
              <b>{item.title}</b>
              <span>{item.playlist_tracks?.length || 0} faixas · {item.is_public ? 'Pública' : 'Privada'}</span>
              <i><Pencil /> Editar</i>
            </button>
          ))}
          {!playlists.length && <Empty text="Crie uma playlist ou importe uma do Spotify." />}
        </div>
      </Section>
      {editor && <PlaylistDialog playlist={editor.id ? editor : null} app={app} onClose={() => setEditor(null)} onSaved={load} />}
    </Page>
  )
}

function SharePicker({ playlists = [], attachment, onChange }) {
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

function Community({ app }) {
  const [posts, setPosts] = useState([]),
    [content, setContent] = useState(''),
    [error, setError] = useState(''),
    [publishing, setPublishing] = useState(false),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null)
  const load = useCallback(async () => {
    if (!configured) return
    const { data, error: queryError } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(display_name, avatar_url), post_likes(user_id)')
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(`Não foi possível carregar o feed: ${queryError.message}`)
      return
    }
    setError('')
    setPosts(data || [])
  }, [])
  useEffect(() => {
    load()
    if (!configured) return
    const channel = supabase
      .channel('synq-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])
  useEffect(() => {
    if (!configured) return
    supabase.from('playlists').select('*, playlist_tracks(*)').eq('owner_id', app.user.id).eq('is_public', true).then(({ data }) => setPlaylists(data || []))
  }, [app.user.id])
  const publish = async (event) => {
    event.preventDefault()
    if (!content.trim() && !attachment) return
    if (!configured) return setError('Configure o Supabase para publicar na comunidade.')
    try {
      setPublishing(true)
      const { error: insertError } = await supabase
        .from('posts')
        .insert({ author_id: app.user.id, content: content.trim(), track: attachment })
      if (insertError) throw insertError
      setContent(''); setAttachment(null)
      await load()
    } catch (publishError) {
      setError(`Não foi possível publicar: ${publishError.message}`)
    } finally {
      setPublishing(false)
    }
  }
  const like = async (post) => {
    try {
      const exists = post.post_likes?.some((like) => like.user_id === app.user.id)
      const { error: likeError } = exists
        ? await supabase
            .from('post_likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', app.user.id)
        : await supabase.from('post_likes').insert({ post_id: post.id, user_id: app.user.id })
      if (likeError) throw likeError
      await load()
    } catch (likeError) {
      setError(`Não foi possível atualizar a curtida: ${likeError.message}`)
    }
  }
  const openPlaylist = async (id) => {
    if (!id) return
    const { data, error: playlistError } = await supabase.from('playlists').select('*, playlist_tracks(*)').eq('id', id).maybeSingle()
    if (playlistError || !data) return setError('Esta playlist não está mais pública ou foi removida.')
    setOpenedPlaylist(data)
  }
  return (
    <Page title="Comunidade" subtitle="O que está tocando na cabeça de todo mundo?">
      <form className="composer" onSubmit={publish}>
        <Avatar profile={app.profile} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compartilhe uma descoberta, um álbum ou uma sensação..."
        />
        <SharePicker playlists={playlists} attachment={attachment} onChange={setAttachment} />
        <button className="primary" disabled={publishing}>
          <Send /> Publicar
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Section title="Feed">
        {posts.length ? (
          posts.map((post) => (
            <article className="post" key={post.id}>
              <Avatar profile={post.author} />
              <div>
                <b>{post.author?.display_name || 'Ouvinte Harmony'}</b>
                <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
                <p>{post.content}</p>
                {post.track && <AttachmentCard attachment={post.track} onOpenPlaylist={openPlaylist} />}
                <button
                  className={`like ${post.post_likes?.some((x) => x.user_id === app.user.id) ? 'liked' : ''}`}
                  onClick={() => like(post)}
                >
                  <Heart
                    fill={
                      post.post_likes?.some((x) => x.user_id === app.user.id)
                        ? 'currentColor'
                        : 'none'
                    }
                  />{' '}
                  {post.post_likes?.length || 0}
                </button>
              </div>
            </article>
          ))
        ) : (
          <Empty text="Ainda não há posts. Seja a primeira voz da comunidade." />
        )}
      </Section>
      {openedPlaylist && <PlaylistDialog playlist={openedPlaylist} app={app} readOnly onClose={() => setOpenedPlaylist(null)} onSaved={() => {}} />}
    </Page>
  )
}

function Messages({ app }) {
  const userId = app.user.id
  const refreshUnread = app.refreshUnread
  const [profiles, setProfiles] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [notice, setNotice] = useState(''),
    [openedPlaylist, setOpenedPlaylist] = useState(null)
  useEffect(() => {
    if (configured)
      supabase
        .from('profiles')
        .select('*')
        .neq('id', app.user.id)
        .then(({ data }) => setProfiles(data || []))
  }, [app.user])
  useEffect(() => {
    if (!configured) return
    supabase.from('playlists').select('*, playlist_tracks(*)').eq('owner_id', app.user.id).eq('is_public', true).then(({ data }) => setPlaylists(data || []))
  }, [app.user.id])
  const load = useCallback(async () => {
    if (!configured || !selected) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${app.user.id},recipient_id.eq.${selected.id}),and(sender_id.eq.${selected.id},recipient_id.eq.${app.user.id})`
      )
      .order('created_at')
    setMessages(data || [])
  }, [app.user, selected])
  useEffect(() => {
    load()
    if (!configured) return
    const channel = supabase
      .channel('synq-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])
  useEffect(() => {
    if (!configured || !selected || !messages.length) return
    const unread = messages.filter((message) => message.recipient_id === userId)
    if (!unread.length) return
    supabase.from('message_reads').upsert(unread.map((message) => ({ message_id: message.id, user_id: userId })), { onConflict: 'message_id,user_id', ignoreDuplicates: true }).then(({ error }) => {
      if (error) setNotice('Execute a migration de notificações no Supabase para marcar mensagens como lidas.')
      else refreshUnread()
    })
  }, [messages, refreshUnread, selected, userId])
  const send = async (event) => {
    event.preventDefault()
    if ((!text.trim() && !attachment) || !selected) return
    const { error } = await supabase.from('messages').insert({
      sender_id: app.user.id,
      recipient_id: selected.id,
      content: text.trim(),
      track: attachment,
    })
    if (error) return setNotice(`Não foi possível enviar: ${error.message}`)
    setText(''); setAttachment(null); load()
  }
  const requestNotifications = async () => {
    if (!('Notification' in window)) return setNotice('Este navegador não suporta notificações.')
    const result = await Notification.requestPermission()
    setNotice(result === 'granted' ? 'Notificações ativadas.' : 'As notificações continuam desativadas no navegador.')
  }
  const openPlaylist = async (id) => {
    const { data, error } = await supabase.from('playlists').select('*, playlist_tracks(*)').eq('id', id).maybeSingle()
    if (error || !data) return setNotice('Esta playlist não está mais pública ou foi removida.')
    setOpenedPlaylist(data)
  }
  return (
    <Page title="Mensagens" subtitle="Converse sobre o que está te fazendo ouvir no repeat.">
      <div className="message-tools"><button className="secondary small-button" onClick={requestNotifications}><Bell /> Ativar notificações</button>{notice && <span className="hint">{notice}</span>}</div>
      <div className="messages">
        <aside>
          {profiles.length ? (
            profiles.map((profile) => (
              <button
                onClick={() => setSelected(profile)}
                className={selected?.id === profile.id ? 'active' : ''}
                key={profile.id}
              >
                <Avatar profile={profile} />
                <span>{profile.display_name}{app.unreadSenders?.has(profile.id) && <i className="unread-dot" />}</span>
              </button>
            ))
          ) : (
            <Empty text="Outros membros aparecerão aqui." />
          )}
        </aside>
        <section className="conversation">
          {selected ? (
            <>
              <header>
                <Avatar profile={selected} />
                <b>{selected.display_name}</b>
              </header>
              <div className="chat">
                {messages.map((message) => <div className={`message-bubble ${message.sender_id === app.user.id ? 'mine' : ''}`} key={message.id}>{message.content && <p>{message.content}</p>}{message.track && <AttachmentCard attachment={message.track} compact onOpenPlaylist={openPlaylist} />}</div>)}
              </div>
              <form onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Digite uma mensagem..."
                />
                <SharePicker playlists={playlists} attachment={attachment} onChange={setAttachment} />
                <button className="primary">
                  <Send />
                </button>
              </form>
            </>
          ) : (
            <Empty text="Escolha alguém para iniciar uma conversa." />
          )}
        </section>
      </div>
      {openedPlaylist && <PlaylistDialog playlist={openedPlaylist} app={app} readOnly onClose={() => setOpenedPlaylist(null)} onSaved={() => {}} />}
    </Page>
  )
}

function Retrospective({ app }) {
  const [period, setPeriod] = useState('30d'),
    [events, setEvents] = useState([])
  useEffect(() => {
    if (configured)
      supabase
        .from('listening_events')
        .select('*')
        .eq('user_id', app.user.id)
        .order('played_at', { ascending: false })
        .then(({ data }) => setEvents(data || []))
  }, [app.user])
  const filtered = useMemo(() => {
    const date = new Date()
    if (period === '7d') date.setDate(date.getDate() - 7)
    if (period === '30d') date.setDate(date.getDate() - 30)
    if (period === 'month') date.setDate(1)
    return period === 'all' ? events : events.filter((event) => new Date(event.played_at) >= date)
  }, [events, period])
  const top = useMemo(
    () =>
      Object.values(
        filtered.reduce((all, event) => {
          const key = event.track.spotify_id
          all[key] ||= { name: event.track.title, count: 0 }
          all[key].count += 1
          return all
        }, {})
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    [filtered]
  )
  const artists = useMemo(
    () =>
      Object.entries(
        filtered.reduce(
          (all, event) => ({
            ...all,
            [event.artist_name]: (all[event.artist_name] || 0) + 1,
          }),
          {}
        )
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [filtered]
  )
  const genres = new Set(filtered.flatMap((event) => event.genres || []))
  return (
    <Page title="Sua Retrospectiva" subtitle="O que você ouviu no Harmony, período a período.">
      <div className="periods">
        {[
          ['7d', '7 dias'],
          ['30d', '30 dias'],
          ['month', 'Este mês'],
          ['all', 'Tudo'],
        ].map(([key, label]) => (
          <button
            className={period === key ? 'active' : ''}
            key={key}
            onClick={() => setPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <Empty text="Toque músicas no Harmony para a sua retrospectiva ganhar vida!" />
      ) : (
        <>
          <div className="metrics">
            {[
              ['Reproduções', filtered.length],
              ['Músicas diferentes', top.length],
              ['Artistas', artists.length],
              ['Gêneros', genres.size],
            ].map(([label, value]) => (
              <article className="metric" key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <div className="charts">
            <section>
              <h2>Top 5 músicas</h2>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={top} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={130} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#14b881" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section>
              <h2>Top artistas</h2>
              {artists.map(([name, count], index) => (
                <div className="rank" key={name}>
                  <span>{index + 1}</span>
                  <b>{name}</b>
                  <i style={{ width: `${(count / artists[0][1]) * 100}%` }} />
                  <small>{count} plays</small>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </Page>
  )
}

function Profile({ app }) {
  const [form, setForm] = useState({ display_name: '', bio: '', favorite_genres: [] })
  const [genreQuery, setGenreQuery] = useState(''), [genresOpen, setGenresOpen] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false), [settingsOpen, setSettingsOpen] = useState(false)
  const [account, setAccount] = useState({ email: '', password: '', passwordConfirmation: '', deletion: '' })
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setForm({ display_name: app.profile?.display_name || '', bio: app.profile?.bio || '', favorite_genres: app.profile?.favorite_genres || [] })
    setAccount((current) => ({ ...current, email: app.user?.email || '' }))
  }, [app.profile, app.user?.email])
  const save = async (event) => {
    event.preventDefault()
    if (!configured) return setNotice('Configure o Supabase para salvar seu perfil.')
    if (!form.display_name.trim()) return setNotice('Informe um nome de exibição.')
    const { error } = await supabase.from('profiles').update({ display_name: form.display_name.trim(), bio: form.bio.trim(), favorite_genres: form.favorite_genres }).eq('id', app.user.id)
    if (error) setNotice(error.message)
    else { await app.refreshProfile(app.user); setNotice('Perfil salvo com sucesso.') }
  }
  const toggleGenre = (genre) => setForm((current) => ({ ...current, favorite_genres: current.favorite_genres.includes(genre) ? current.favorite_genres.filter((item) => item !== genre) : [...current.favorite_genres, genre] }))
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!configured) return setNotice('Configure o Supabase para enviar uma foto de perfil.')
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) return setNotice('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.')
    try {
      setAvatarBusy(true)
      const path = `${app.user.id}/avatar-${Date.now()}.${extensions[file.type]}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: profileError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', app.user.id)
      if (profileError) { await supabase.storage.from('avatars').remove([path]); throw profileError }
      const oldPath = app.profile?.avatar_url?.split('/avatars/')[1]
      if (oldPath?.startsWith(`${app.user.id}/`)) await supabase.storage.from('avatars').remove([oldPath])
      await app.refreshProfile(app.user); setNotice('Foto de perfil atualizada.')
    } catch (error) { setNotice(`Não foi possível enviar a foto: ${error.message}`) } finally { setAvatarBusy(false) }
  }
  const updateEmail = async (event) => {
    event.preventDefault()
    if (!configured) return setNotice('Configure o Supabase para alterar o e-mail.')
    if (!account.email.trim() || account.email.trim() === app.user.email) return setNotice('Digite um novo e-mail para alterá-lo.')
    const { error } = await supabase.auth.updateUser({ email: account.email.trim() }, { emailRedirectTo: `${window.location.origin}/perfil` })
    setNotice(error ? error.message : 'Confira os e-mails de confirmação para concluir a alteração.')
  }
  const updatePassword = async (event) => {
    event.preventDefault()
    if (!configured) return setNotice('Configure o Supabase para alterar a senha.')
    if (account.password.length < 8) return setNotice('A nova senha deve ter pelo menos 8 caracteres.')
    if (account.password !== account.passwordConfirmation) return setNotice('A confirmação da senha não confere.')
    const { error } = await supabase.auth.updateUser({ password: account.password })
    setNotice(error ? error.message : 'Senha atualizada com sucesso.')
    if (!error) setAccount((current) => ({ ...current, password: '', passwordConfirmation: '' }))
  }
  const sendRecovery = async () => {
    if (!configured) return setNotice('Configure o Supabase para recuperar a senha.')
    const { error } = await supabase.auth.resetPasswordForEmail(app.user.email, { redirectTo: `${window.location.origin}/perfil` })
    setNotice(error ? error.message : 'Se o e-mail estiver configurado, enviamos um link de recuperação.')
  }
  const deleteAccount = async () => {
    if (!configured) return setNotice('Configure o Supabase para excluir a conta.')
    if (account.deletion !== 'EXCLUIR') return setNotice('Digite EXCLUIR para confirmar a exclusão definitiva.')
    if (!window.confirm('Última confirmação: deseja apagar sua conta e todos os seus dados?')) return
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'EXCLUIR' } })
    if (error) return setNotice(`Não foi possível excluir: ${error.message}. Confirme se a Edge Function foi publicada.`)
    await supabase.auth.signOut()
  }
  const filteredGenres = GENRES.filter((genre) => normalise(genre).includes(normalise(genreQuery)))
  return <Page title="Seu Perfil" subtitle="Faça seu perfil soar como você.">
    <div className="profile-hero"><div className="avatar-editor"><Avatar profile={app.profile} className="big" /><label className="avatar-upload"><Camera /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} /></label></div><div><h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2><p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p></div></div>
    {notice && <p className="notice profile-notice" role="status">{notice}</p>}
    <form className="profile-form" onSubmit={save}>
      <label>Nome de exibição<input value={form.display_name} maxLength="80" onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></label>
      <label>Bio<textarea value={form.bio} maxLength="300" onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
      <label>Gêneros favoritos</label>
      <div className="genre-picker"><div className="genre-input"><Search /><input value={genreQuery} onFocus={() => setGenresOpen(true)} onChange={(event) => { setGenreQuery(event.target.value); setGenresOpen(true) }} placeholder="Busque um gênero musical" /><button type="button" className="icon" aria-label="Abrir gêneros" onClick={() => setGenresOpen(!genresOpen)}>{genresOpen ? <EyeOff /> : <Eye />}</button></div>{form.favorite_genres.length > 0 && <div className="genre-chips">{form.favorite_genres.map((genre) => <button type="button" key={genre} onClick={() => toggleGenre(genre)}>{genre} <X /></button>)}</div>}{genresOpen && <div className="genre-options">{filteredGenres.length ? filteredGenres.map((genre) => <button type="button" className={form.favorite_genres.includes(genre) ? 'selected' : ''} key={genre} onClick={() => toggleGenre(genre)}>{form.favorite_genres.includes(genre) ? '✓ ' : ''}{genre}</button>) : <p>Nenhum gênero encontrado.</p>}</div>}</div>
      <button className="primary">Salvar alterações</button>
    </form>
    <section className="account-settings"><header><div><h2><Settings /> Configurações da conta</h2><p>Gerencie seu acesso e dados de segurança.</p></div><button className="secondary" onClick={() => setSettingsOpen(!settingsOpen)}>{settingsOpen ? 'Fechar' : 'Abrir'}</button></header>{settingsOpen && <div className="settings-grid"><form onSubmit={updateEmail}><h3>Alterar e-mail</h3><p>E-mail atual: <b>{app.user?.email}</b></p><input type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} /><button className="secondary">Solicitar alteração</button></form><form onSubmit={updatePassword}><h3>Alterar senha</h3><input type="password" minLength="8" value={account.password} placeholder="Nova senha" onChange={(event) => setAccount({ ...account, password: event.target.value })} /><input type="password" minLength="8" value={account.passwordConfirmation} placeholder="Confirmar nova senha" onChange={(event) => setAccount({ ...account, passwordConfirmation: event.target.value })} /><button className="secondary">Salvar nova senha</button><button type="button" className="text-button" onClick={sendRecovery}>Enviar link de recuperação</button></form><form className="danger-zone" onSubmit={(event) => { event.preventDefault(); deleteAccount() }}><h3><ShieldCheck /> Excluir conta</h3><p>Isso remove permanentemente seus dados, mensagens, playlists e avatar.</p><input value={account.deletion} placeholder="Digite EXCLUIR" onChange={(event) => setAccount({ ...account, deletion: event.target.value })} /><button className="danger-button">Excluir definitivamente</button></form></div>}</section>
  </Page>
}
function SpotifyCallback() {
  const navigate = useNavigate(),
    [message, setMessage] = useState('Conectando ao Spotify...')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) return setMessage('Conexão cancelada.')
    finishSpotifyConnection(params.get('code'), params.get('state'))
      .then(() => {
        setMessage('Spotify conectado! Redirecionando...')
        setTimeout(() => navigate('/biblioteca'), 600)
      })
      .catch((error) => setMessage(error.message))
  }, [navigate])
  return (
    <main className="callback">
      <Music2 />
      <h1>{message}</h1>
    </main>
  )
}
function AppRoutes() {
  const baseApp = useSynq()
  const unread = useUnreadMessages(baseApp.user?.id)
  const app = { ...baseApp, ...unread }
  if (!app.ready) return <main className="callback">Carregando Harmony...</main>
  if (configured && !app.user) return <Auth />
  return (
    <Shell app={app}>
      <Routes>
        <Route path="/" element={<Discover app={app} />} />
        <Route path="/biblioteca" element={<Library app={app} />} />
        <Route path="/comunidade" element={<Community app={app} />} />
        <Route path="/mensagens" element={<Messages app={app} />} />
        <Route path="/retrospectiva" element={<Retrospective app={app} />} />
        <Route path="/perfil" element={<Profile app={app} />} />
        <Route path="/spotify/callback" element={<SpotifyCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
