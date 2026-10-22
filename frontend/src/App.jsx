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
  ChevronDown,
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
import { configured, ensureProfile, getAccountPreferences, supabase } from './lib/supabase'
import { GENRES, highlightGenreMatch, normalizeGenre } from './lib/genres'
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
  ['/configuracoes', 'Configurações', Settings],
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

function useUnreadMessages(userId, notificationsEnabled) {
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
          notificationsEnabled &&
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
  }, [load, notificationsEnabled, userId])
  return { unreadIds, unreadSenders, unreadCount: unreadIds.size, refreshUnread: load }
}

function useSynq() {
  const [user, setUser] = useState(null),
    [profile, setProfile] = useState(null),
    [preferences, setPreferences] = useState(null),
    [passwordRecovery, setPasswordRecovery] = useState(false),
    [ready, setReady] = useState(!configured)
  const refreshProfile = useCallback(async (authUser) => {
    if (!configured)
      return setProfile({
        id: demoUser.id,
        display_name: 'Visitante Harmony',
        favorite_genres: ['Pop'],
      })
    const nextProfile = await ensureProfile(authUser)
    setProfile(nextProfile)
    window.dispatchEvent(new CustomEvent('synq-profile-updated', { detail: nextProfile }))
  }, [])
  const refreshPreferences = useCallback(async (authUser) => {
    if (!configured) {
      setPreferences({
        user_id: demoUser.id,
        chat_notifications_enabled: true,
        default_playlist_public: false,
      })
      return
    }
    setPreferences(await getAccountPreferences(authUser?.id))
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
        if (data.session?.user) {
          await Promise.all([
            refreshProfile(data.session.user).catch((profileError) => {
              console.error('Não foi possível carregar o perfil:', profileError)
            }),
            refreshPreferences(data.session.user).catch((preferencesError) => {
              console.error('Não foi possível carregar as preferências:', preferencesError)
            }),
          ])
        }
      })
      .catch((error) => console.error('Não foi possível carregar a sessão:', error))
      .finally(() => setReady(true))
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      if (session?.user) {
        queueMicrotask(() =>
          refreshProfile(session.user).catch((error) =>
            console.error('Não foi possível atualizar o perfil:', error)
          )
        )
        queueMicrotask(() =>
          refreshPreferences(session.user).catch((error) =>
            console.error('Não foi possível carregar as preferências:', error)
          )
        )
      } else {
        setProfile(null)
        setPreferences(null)
        setPasswordRecovery(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [refreshPreferences, refreshProfile])
  return {
    user,
    profile,
    preferences,
    ready,
    refreshProfile,
    refreshPreferences,
    passwordRecovery,
    setPasswordRecovery,
    demo: !configured,
  }
}

function Auth() {
  const [register, setRegister] = useState(false),
    [forgotPassword, setForgotPassword] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const [oauthBusy, setOauthBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        })
        if (error) throw error
        setMessage('Se esse endereço estiver cadastrado, você receberá um link para redefinir a senha.')
      } else {
        const result = register
          ? await supabase.auth.signUp({ email: email.trim(), password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
        setMessage(register ? 'Conta criada. Confira seu e-mail.' : 'Entrando...')
      }
    } catch (error) {
      setMessage(
        forgotPassword
          ? 'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.'
          : error.message || 'Não foi possível concluir a autenticação.'
      )
    } finally {
      setBusy(false)
    }
  }
  const signInWithGoogle = async () => {
    setOauthBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (error) {
      setMessage(error.message || 'Não foi possível iniciar a autenticação com Google.')
      setOauthBusy(false)
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
        <h2>{forgotPassword ? 'Recuperar senha' : register ? 'Crie seu espaço' : 'Bem-vindo de volta'}</h2>
        <p>{forgotPassword ? 'Enviaremos um link se a conta existir.' : 'Entre para continuar ouvindo.'}</p>
        {!forgotPassword && <div className="switch">
          <button className={!register ? 'active' : ''} onClick={() => setRegister(false)}>
            Entrar
          </button>
          <button className={register ? 'active' : ''} onClick={() => setRegister(true)}>
            Criar conta
          </button>
        </div>}
        <form onSubmit={submit}>
          <label>
            E-mail
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {!forgotPassword && <label>
            Senha
            <input
              required
              minLength={register ? 8 : undefined}
              pattern={register ? '(?=.*[A-Za-z])(?=.*\\d).{8,}' : undefined}
              title={register ? 'Use pelo menos 8 caracteres, com uma letra e um número.' : undefined}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>}
          <button className="primary" disabled={busy}>
            {busy ? 'Aguarde...' : forgotPassword ? 'Enviar link' : register ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        {!forgotPassword && <button type="button" className="secondary" onClick={signInWithGoogle} disabled={oauthBusy}>
          {oauthBusy ? 'Conectando...' : 'Continuar com Google'}
        </button>}
        <button
        type="button"
        className="text-button"
        onClick={() => {
          setForgotPassword((current) => !current)
          setMessage('')
        }}
        >
        {forgotPassword ? 'Voltar para entrar' : 'Esqueci minha senha'}
        </button>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  )
}

function Shell({ app, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const logout = async () => {
    try {
      setLogoutBusy(true)
      setLogoutError('')
      if (configured) {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
      }
      navigate('/')
    } catch (error) {
      setLogoutError(`Não foi possível sair: ${error.message}`)
    } finally {
      setLogoutBusy(false)
    }
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
          <button className="logout" onClick={logout} disabled={logoutBusy}>
            <LogOut /> {logoutBusy ? 'Saindo...' : 'Sair'}
          </button>
          {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
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
      <nav className="bottom-nav" aria-label="Navegação principal">
        {nav.map(([to, label, Icon]) => (
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
    const syncProfile = (event) => {
      const updated = event.detail
      if (updated?.id !== app.user.id) return
      setPosts((current) =>
        current.map((post) =>
          post.author_id === updated.id ? { ...post, author: { ...post.author, ...updated } } : post
        )
      )
    }
    window.addEventListener('synq-profile-updated', syncProfile)
    return () => window.removeEventListener('synq-profile-updated', syncProfile)
  }, [app.user.id])
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
  const chatRef = useRef(null)
  useEffect(() => {
    if (configured)
      supabase
        .from('profiles')
        .select('*')
        .neq('id', app.user.id)
        .then(({ data }) => setProfiles(data || []))
  }, [app.user])
  useEffect(() => {
    const syncProfile = (event) => {
      const updated = event.detail
      if (!updated?.id) return
      setProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? { ...profile, ...updated } : profile))
      )
      setSelected((current) =>
        current?.id === updated.id ? { ...current, ...updated } : current
      )
    }
    window.addEventListener('synq-profile-updated', syncProfile)
    return () => window.removeEventListener('synq-profile-updated', syncProfile)
  }, [])
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
    const chat = chatRef.current
    if (chat) chat.scrollTop = chat.scrollHeight
  }, [messages])
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
              <div className="chat" ref={chatRef}>
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

function GenrePicker({ selectedGenres, onChange }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const pickerRef = useRef(null)
  const filteredGenres = useMemo(
    () => GENRES.filter((genre) => normalizeGenre(genre).includes(normalizeGenre(query))),
    [query]
  )
  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [close, isOpen])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`genre-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  const selectGenre = (genre) => {
    onChange(
      selectedGenres.includes(genre)
        ? selectedGenres.filter((selected) => selected !== genre)
        : [...selectedGenres, genre]
    )
    setQuery('')
    setActiveIndex(-1)
  }
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      if (!filteredGenres.length) return
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= filteredGenres.length - 1 ? 0 : current + 1
        return current <= 0 ? filteredGenres.length - 1 : current - 1
      })
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectGenre(filteredGenres[activeIndex])
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab' && isOpen) {
      close()
    }
  }

  return (
    <div
      className="genre-picker"
      ref={pickerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <div className="genre-input">
        <Search aria-hidden="true" />
        <input
          id="genre-search"
          type="text"
          role="combobox"
          aria-label="Buscar gêneros favoritos"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="genre-options"
          aria-activedescendant={activeIndex >= 0 ? `genre-option-${activeIndex}` : undefined}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(-1)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Busque um gênero musical"
        />
        <button
          type="button"
          className="icon"
          tabIndex={-1}
          aria-label={isOpen ? 'Fechar gêneros' : 'Abrir gêneros'}
          aria-expanded={isOpen}
          onClick={() => (isOpen ? close() : setIsOpen(true))}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {selectedGenres.length > 0 && (
        <div className="genre-chips" aria-label="Gêneros selecionados">
          {selectedGenres.map((genre) => (
            <button
              type="button"
              key={genre}
              aria-label={`Remover ${genre}`}
              onClick={() => selectGenre(genre)}
            >
              {genre} <X aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="genre-options" id="genre-options" role="listbox" aria-multiselectable="true">
          {filteredGenres.length ? (
            filteredGenres.map((genre, index) => {
              const match = highlightGenreMatch(genre, query)
              const isSelected = selectedGenres.includes(genre)
              return (
                <button
                  type="button"
                  role="option"
                  id={`genre-option-${index}`}
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`${isSelected ? 'selected' : ''} ${activeIndex === index ? 'active' : ''}`}
                  key={genre}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectGenre(genre)}
                >
                  <span aria-hidden="true">{isSelected ? '✓ ' : ''}</span>
                  {match ? (
                    <>
                      {match.before}
                      <mark>{match.match}</mark>
                      {match.after}
                    </>
                  ) : (
                    genre
                  )}
                </button>
              )
            })
          ) : (
            <p role="status">Nenhum gênero encontrado</p>
          )}
        </div>
      )}
    </div>
  )
}

function AvatarCropDialog({ image, onSave, onCancel, busy }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const frameSize = 280

  const imageLayout = useCallback(() => {
    const scale = Math.max(frameSize / image.naturalWidth, frameSize / image.naturalHeight) * zoom
    return {
      scale,
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale,
    }
  }, [image, zoom])
  const clampOffset = useCallback((nextOffset) => {
    const { width, height } = imageLayout()
    return {
      x: Math.min(0, Math.max(frameSize - width, nextOffset.x)),
      y: Math.min(0, Math.max(frameSize - height, nextOffset.y)),
    }
  }, [imageLayout])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image.complete) return
    const context = canvas.getContext('2d')
    const { scale, width, height } = imageLayout()
    const cropOffset = clampOffset(offset)
    const imageX = (frameSize - width) / 2 + cropOffset.x
    const imageY = (frameSize - height) / 2 + cropOffset.y
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      -imageX / scale,
      -imageY / scale,
      frameSize / scale,
      frameSize / scale,
      0,
      0,
      canvas.width,
      canvas.height
    )
  }, [clampOffset, image, imageLayout, offset])

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])
  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled)'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handlePointerDown = (event) => {
    if (busy) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }
  }
  const handlePointerMove = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const frameScale = frameSize / bounds.width
    setOffset(
      clampOffset({
        x: dragRef.current.offset.x + (event.clientX - dragRef.current.startX) * frameScale,
        y: dragRef.current.offset.y + (event.clientY - dragRef.current.startY) * frameScale,
      })
    )
  }
  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setError('')
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Não foi possível preparar a foto. Tente outra imagem.')
          return
        }
        if (blob.size > 5 * 1024 * 1024) {
          setError('A imagem recortada excede o limite de 5 MB. Reduza o zoom ou escolha outra foto.')
          return
        }
        onSave(blob)
      },
      'image/webp',
      0.9
    )
  }

  return (
    <div className="modal-backdrop avatar-modal-backdrop">
      <section
        className="modal avatar-crop-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        aria-describedby="avatar-crop-help"
        onKeyDown={handleDialogKeyDown}
      >
        <header>
          <div>
            <h2 id="avatar-crop-title">Ajustar foto de perfil</h2>
            <p id="avatar-crop-help">Arraste a imagem para ajustar o recorte quadrado.</p>
          </div>
          <button
            className="icon"
            type="button"
            ref={closeButtonRef}
            aria-label="Cancelar edição da foto"
            onClick={onCancel}
            disabled={busy}
          >
            <X />
          </button>
        </header>
        <canvas
          className="avatar-crop-canvas"
          ref={canvasRef}
          width="512"
          height="512"
          aria-label="Pré-visualização do recorte da foto"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            dragRef.current = null
          }}
          onPointerCancel={() => {
            dragRef.current = null
          }}
        />
        <label className="avatar-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            aria-label="Zoom da foto"
            onChange={(event) => {
              setZoom(Number(event.target.value))
              setOffset((current) => clampOffset(current))
            }}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions avatar-modal-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <span />
          <button type="button" className="primary" onClick={save} disabled={busy}>
            {busy ? 'Salvando foto...' : 'Salvar foto'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Profile({ app }) {
  const [form, setForm] = useState({ display_name: '', bio: '', favorite_genres: [] })
  const [avatarBusy, setAvatarBusy] = useState(''),
    [avatarSource, setAvatarSource] = useState(''),
    [avatarImage, setAvatarImage] = useState(null)
  const avatarInputRef = useRef(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setForm({ display_name: app.profile?.display_name || '', bio: app.profile?.bio || '', favorite_genres: app.profile?.favorite_genres || [] })
  }, [app.profile, app.user?.email])
  useEffect(() => {
    if (!avatarSource) {
      setAvatarImage(null)
      return undefined
    }
    let active = true
    const image = new Image()
    image.onload = () => {
      if (active) setAvatarImage(image)
    }
    image.onerror = () => {
      if (active) {
        setNotice('Não foi possível abrir essa imagem. Escolha outro arquivo.')
        setAvatarSource('')
      }
    }
    image.src = avatarSource
    return () => {
      active = false
      URL.revokeObjectURL(avatarSource)
    }
  }, [avatarSource])
  const save = async (event) => {
    event.preventDefault()
    if (!configured) return setNotice('Configure o Supabase para salvar seu perfil.')
    if (!form.display_name.trim()) return setNotice('Informe um nome de exibição.')
    setProfileSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: form.display_name.trim(), bio: form.bio.trim(), favorite_genres: form.favorite_genres }).eq('id', app.user.id)
      if (error) throw error
      await app.refreshProfile(app.user)
      setNotice('Perfil salvo com sucesso.')
    } catch (error) {
      setNotice(`Não foi possível salvar o perfil: ${error.message}`)
    } finally {
      setProfileSaving(false)
    }
  }
  const chooseAvatar = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!configured) return setNotice('Configure o Supabase para enviar uma foto de perfil.')
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!extensions[file.type]) return setNotice('Formato inválido. Escolha uma imagem JPEG, PNG ou WebP.')
    if (file.size > 5 * 1024 * 1024) return setNotice('A imagem é grande demais. O limite é 5 MB.')
    setNotice('')
    setAvatarSource(URL.createObjectURL(file))
  }
  const uploadAvatar = async (blob) => {
    if (!configured) return setNotice('Configure o Supabase para enviar uma foto de perfil.')
    try {
      setAvatarBusy('upload')
      const extension = blob.type.split('/')[1] || 'webp'
      const file = new File([blob], `avatar.${extension}`, { type: blob.type || 'image/webp' })
      const body = new FormData()
      body.append('file', file)
      const { error } = await supabase.functions.invoke('avatar', { body })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        await app.refreshProfile(app.user)
        throw new Error(message)
      }
      await app.refreshProfile(app.user)
      setAvatarSource('')
      setNotice('Foto de perfil atualizada.')
    } catch (error) {
      setNotice(`Não foi possível enviar a foto: ${error.message}`)
    } finally {
      setAvatarBusy('')
    }
  }
  const removeAvatar = async () => {
    if (!app.profile?.avatar_url) return
    if (!window.confirm('Remover sua foto de perfil? Seu avatar padrão será exibido.')) return
    try {
      setAvatarBusy('remove')
      const { error } = await supabase.functions.invoke('avatar', { body: { action: 'remove' } })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        await app.refreshProfile(app.user)
        throw new Error(message)
      }
      await app.refreshProfile(app.user)
      setNotice('Foto de perfil removida.')
    } catch (error) {
      setNotice(`Não foi possível remover a foto: ${error.message}`)
    } finally {
      setAvatarBusy('')
    }
  }
  return <Page title="Seu Perfil" subtitle="Faça seu perfil soar como você.">
    <div className="profile-hero"><div><div className="avatar-editor"><button type="button" className="avatar-trigger" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Alterar foto de perfil"><Avatar profile={app.profile} className="big" /></button><button type="button" className="avatar-upload" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Selecionar nova foto"><Camera /></button><input ref={avatarInputRef} className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={Boolean(avatarBusy)} /></div><div className="avatar-actions"><button type="button" className="secondary small-button" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)}>{avatarBusy === 'upload' ? 'Enviando...' : 'Alterar foto'}</button>{app.profile?.avatar_url && <button type="button" className="text-button" onClick={removeAvatar} disabled={Boolean(avatarBusy)}>{avatarBusy === 'remove' ? 'Removendo...' : 'Remover foto'}</button>}</div></div><div><h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2><p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p></div></div>
    {avatarSource && avatarImage && <AvatarCropDialog image={avatarImage} onSave={uploadAvatar} onCancel={() => setAvatarSource('')} busy={avatarBusy === 'upload'} />}
    {notice && <p className="notice profile-notice" role="status">{notice}</p>}
    <form className="profile-form" onSubmit={save}>
      <label>Nome de exibição<input value={form.display_name} maxLength="80" onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></label>
      <label>Bio<textarea value={form.bio} maxLength="300" onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
      <label htmlFor="genre-search">Gêneros favoritos</label>
      <GenrePicker
        selectedGenres={form.favorite_genres}
        onChange={(favorite_genres) => setForm((current) => ({ ...current, favorite_genres }))}
      />
      <button className="primary" disabled={profileSaving}>{profileSaving ? 'Salvando...' : 'Salvar alterações'}</button>
    </form>
  </Page>
}

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <label className="password-field" htmlFor={id}>
      {label}
      <span className="password-control">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="icon"
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={onToggle}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </span>
    </label>
  )
}

function passwordPolicyError(password) {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'A senha precisa conter pelo menos uma letra e um número.'
  }
  return ''
}

function passwordStrength(password) {
  if (!password) return { label: 'Não informada', score: 0 }
  const score =
    Number(password.length >= 8) +
    Number(password.length >= 12) +
    Number(/[A-Z]/.test(password) && /[a-z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte']
  return { label: labels[score], score }
}

function browserDescription() {
  const agent = navigator.userAgent
  const browser = /Edg\//.test(agent)
    ? 'Microsoft Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Google Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Navegador'
  const system = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(agent)
      ? 'iOS'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : 'Sistema não identificado'
  return `${browser} · ${system}`
}

function AccountSettings({ app }) {
  const navigate = useNavigate()
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    username: '',
  })
  const [preferencesForm, setPreferencesForm] = useState({
    chat_notifications_enabled: true,
    default_playlist_public: false,
  })
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirmation: '',
  })
  const [emailForm, setEmailForm] = useState({ email: '', password: '' })
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' })
  const [pendingEmail, setPendingEmail] = useState(app.user?.new_email || '')
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState('')
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [showPasswords, setShowPasswords] = useState({})
  const strength = passwordStrength(passwordForm.next)
  const emailProvider = app.user?.app_metadata?.providers?.includes('email')

  useEffect(() => {
    setProfileForm({
      display_name: app.profile?.display_name || '',
      username: app.profile?.username || '',
    })
  }, [app.profile])

  useEffect(() => {
    setPreferencesForm({
      chat_notifications_enabled: app.preferences?.chat_notifications_enabled !== false,
      default_playlist_public: app.preferences?.default_playlist_public === true,
    })
  }, [app.preferences])

  useEffect(() => {
    setPendingEmail(app.user?.new_email || '')
  }, [app.user?.new_email])

  useEffect(() => {
    if (!configured) return undefined
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setFeedback({ type: 'error', text: 'Não foi possível carregar a sessão atual.' })
          return
        }
        if (mounted) setSession(data.session)
      })
      .catch(() => {
        if (mounted) setFeedback({ type: 'error', text: 'Não foi possível carregar a sessão atual.' })
      })
    return () => {
      mounted = false
    }
  }, [])

  const notify = (type, text) => setFeedback({ type, text })
  const togglePassword = (key) =>
    setShowPasswords((current) => ({ ...current, [key]: !current[key] }))

  const reauthenticate = async (password) => {
    if (!emailProvider || !app.user?.email) {
      throw new Error('Esta conta não possui autenticação por senha. Use o provedor de login vinculado.')
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: app.user.email,
      password,
    })
    if (error?.status === 400) {
      throw new Error('Senha atual incorreta. Confira e tente novamente.')
    }
    if (error) throw error
    if (data.user?.id !== app.user.id) throw new Error('Não foi possível confirmar sua identidade.')
  }

  const saveAccount = async (event) => {
    event.preventDefault()
    if (!configured) return notify('error', 'Configure o Supabase para salvar as configurações.')
    const username = profileForm.username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return notify('error', 'O nome de usuário deve ter de 3 a 30 caracteres: letras, números ou _.')
    }
    if (!profileForm.display_name.trim() || profileForm.display_name.trim().length > 80) {
      return notify('error', 'O nome de exibição deve ter de 1 a 80 caracteres.')
    }
    setBusy('account')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileForm.display_name.trim(),
          username,
        })
        .eq('id', app.user.id)
      if (error) {
        if (error.code === '23505') throw new Error('Esse nome de usuário já está em uso.')
        throw error
      }
      await app.refreshProfile(app.user)
      notify('success', 'Configurações da conta salvas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível salvar as configurações.')
    } finally {
      setBusy('')
    }
  }

  const savePreferences = async (event) => {
    event.preventDefault()
    if (!configured) return notify('error', 'Configure o Supabase para salvar as preferências.')
    setBusy('preferences')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.from('account_preferences').upsert(
        {
          user_id: app.user.id,
          ...preferencesForm,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      await app.refreshPreferences(app.user)
      notify('success', 'Preferências privadas salvas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível salvar as preferências.')
    } finally {
      setBusy('')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const policyError = passwordPolicyError(passwordForm.next)
    if (policyError) return notify('error', policyError)
    if (passwordForm.next === passwordForm.current) {
      return notify('error', 'A nova senha deve ser diferente da senha atual.')
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      return notify('error', 'A confirmação da nova senha não confere.')
    }
    setBusy('password')
    setFeedback({ type: '', text: '' })
    try {
      await reauthenticate(passwordForm.current)
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next })
      if (error) throw error
      setPasswordForm({ current: '', next: '', confirmation: '' })
      let signOutError
      try {
        const result = await supabase.auth.signOut({ scope: 'others' })
        signOutError = result.error
      } catch {
        signOutError = new Error('Falha de rede ao encerrar outras sessões.')
      }
      if (signOutError) {
        notify(
          'error',
          'A senha foi alterada, mas não foi possível encerrar as outras sessões. Tente novamente na seção Sessões.'
        )
        return
      }
      notify('success', 'Senha alterada. As outras sessões foram encerradas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível alterar a senha.')
    } finally {
      setBusy('')
    }
  }

  const requestEmailChange = async (event) => {
    event.preventDefault()
    const email = emailForm.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return notify('error', 'Informe um endereço de e-mail válido.')
    }
    if (email === app.user.email?.toLowerCase()) {
      return notify('error', 'Informe um e-mail diferente do atual.')
    }
    setBusy('email')
    setFeedback({ type: '', text: '' })
    try {
      await reauthenticate(emailForm.password)
      const { data, error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/configuracoes` }
      )
      if (error) throw new Error('Não foi possível solicitar a alteração. Verifique o endereço e tente novamente.')
      setPendingEmail(data.user?.new_email || email)
      setEmailForm((current) => ({ ...current, password: '' }))
      notify('success', 'Solicitação enviada. Confirme o link para o novo e-mail; o endereço atual não muda até a confirmação.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível solicitar a alteração do e-mail.')
    } finally {
      setBusy('')
    }
  }

  const resendEmailChange = async () => {
    setBusy('resend-email')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.resend({
        type: 'email_change',
        email: app.user.email,
        options: { emailRedirectTo: `${window.location.origin}/configuracoes` },
      })
      if (error) throw error
      notify('success', 'Se a solicitação ainda estiver válida, um novo link será enviado.')
    } catch {
      notify('error', 'Não foi possível reenviar o link. Solicite uma nova alteração de e-mail.')
    } finally {
      setBusy('')
    }
  }

  const cancelEmailChange = async () => {
    if (!window.confirm('Cancelar a alteração pendente de e-mail?')) return
    setBusy('cancel-email')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.functions.invoke('cancel-email-change', { body: {} })
      if (error) throw error
      setPendingEmail('')
      notify('success', 'Alteração de e-mail cancelada.')
    } catch (error) {
      notify('error', `Não foi possível cancelar a alteração: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const sendRecovery = async () => {
    setBusy('recovery')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(app.user.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (error) throw error
      notify('success', 'Se esse endereço estiver cadastrado, você receberá um link para redefinir a senha.')
    } catch {
      notify('error', 'Não foi possível solicitar o link de recuperação. Tente novamente mais tarde.')
    } finally {
      setBusy('')
    }
  }

  const endOtherSessions = async () => {
    if (!window.confirm('Encerrar todas as outras sessões da sua conta?')) return
    setBusy('sessions')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      notify('success', 'As outras sessões foram encerradas.')
    } catch (error) {
      notify('error', `Não foi possível encerrar as outras sessões: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const endCurrentSession = async () => {
    setBusy('current-session')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (error) {
      notify('error', `Não foi possível encerrar esta sessão: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const deleteAccount = async (event) => {
    event.preventDefault()
    if (deleteForm.confirmation !== 'EXCLUIR') {
      return notify('error', 'Digite EXCLUIR para confirmar a exclusão.')
    }
    if (!window.confirm('Esta ação apaga permanentemente seu perfil, playlists, mensagens e arquivos. Continuar?')) {
      return
    }
    setBusy('delete')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'EXCLUIR', password: deleteForm.password },
      })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        throw new Error(message)
      }
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) {
        notify('error', 'A conta foi excluída, mas não foi possível encerrar a sessão. Feche este navegador.')
        return
      }
      navigate('/login', { replace: true })
    } catch (error) {
      notify('error', `Não foi possível excluir a conta: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  if (!configured) {
    return (
      <Page title="Configurações" subtitle="Gerencie sua conta, segurança e sessões.">
        <p className="notice" role="status">Configure o Supabase para acessar as configurações persistentes da conta.</p>
      </Page>
    )
  }

  return (
    <Page title="Configurações" subtitle="Gerencie sua conta, segurança e sessões.">
      {feedback.text && (
        <p className={`notice settings-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
      <section className="settings-section" aria-labelledby="settings-account-title">
        <h2 id="settings-account-title">Conta</h2>
        <p className="settings-description">Seus dados públicos e preferências do Harmony.</p>
        <form className="settings-form" onSubmit={saveAccount}>
          <label htmlFor="settings-display-name">Nome de exibição</label>
          <input id="settings-display-name" value={profileForm.display_name} maxLength="80" onChange={(event) => setProfileForm({ ...profileForm, display_name: event.target.value })} required />
          <label htmlFor="settings-username">Nome de usuário</label>
          <input id="settings-username" value={profileForm.username} maxLength="30" autoComplete="username" onChange={(event) => setProfileForm({ ...profileForm, username: event.target.value })} required />
          <button className="primary" disabled={Boolean(busy)}>{busy === 'account' ? 'Salvando...' : 'Salvar configurações'}</button>
        </form>
        <form className="settings-form preferences-form" onSubmit={savePreferences}>
          <h3>Preferências privadas</h3>
          <label className="settings-toggle">
            <input type="checkbox" checked={preferencesForm.chat_notifications_enabled} onChange={(event) => setPreferencesForm({ ...preferencesForm, chat_notifications_enabled: event.target.checked })} />
            <span>Permitir notificações de novas mensagens</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={preferencesForm.default_playlist_public} onChange={(event) => setPreferencesForm({ ...preferencesForm, default_playlist_public: event.target.checked })} />
            <span>Criar playlists públicas por padrão</span>
          </label>
          <button className="secondary" disabled={Boolean(busy)}>{busy === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button>
        </form>
        <form className="settings-form settings-email-form" onSubmit={requestEmailChange}>
          <h3>Alterar e-mail de login</h3>
          <p>E-mail atual: <b>{app.user.email}</b></p>
          {pendingEmail ? (
            <div className="pending-email">
              <p role="status">Aguardando confirmação do novo e-mail: <b>{pendingEmail}</b></p>
              <div className="settings-actions">
                <button type="button" className="secondary" onClick={resendEmailChange} disabled={Boolean(busy)}>{busy === 'resend-email' ? 'Reenviando...' : 'Reenviar link'}</button>
                <button type="button" className="text-button" onClick={cancelEmailChange} disabled={Boolean(busy)}>{busy === 'cancel-email' ? 'Cancelando...' : 'Cancelar solicitação'}</button>
              </div>
            </div>
          ) : (
            <>
              {!emailProvider && <p className="hint">Esta conta usa login social e não possui senha de e-mail para reautenticação.</p>}
              <label htmlFor="settings-new-email">Novo e-mail</label>
              <input id="settings-new-email" type="email" autoComplete="email" value={emailForm.email} onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })} required />
              <PasswordField id="email-current-password" label="Senha atual" value={emailForm.password} onChange={(password) => setEmailForm({ ...emailForm, password })} show={Boolean(showPasswords.email)} onToggle={() => togglePassword('email')} autoComplete="current-password" />
              <button className="secondary" disabled={Boolean(busy) || !emailProvider}>{busy === 'email' ? 'Enviando solicitação...' : 'Solicitar alteração'}</button>
            </>
          )}
        </form>
      </section>

      <section className="settings-section" aria-labelledby="settings-security-title">
        <h2 id="settings-security-title">Segurança</h2>
        <p className="settings-description">Reautentique com a senha atual para fazer alterações sensíveis.</p>
        {!emailProvider && <p className="hint">Sua conta usa login social. A troca de senha deve ser feita pelo provedor de autenticação.</p>}
        <form className="settings-form" onSubmit={changePassword}>
          <h3>Alterar senha</h3>
          <PasswordField id="current-password" label="Senha atual" value={passwordForm.current} onChange={(current) => setPasswordForm({ ...passwordForm, current })} show={Boolean(showPasswords.current)} onToggle={() => togglePassword('current')} autoComplete="current-password" />
          <PasswordField id="new-password" label="Nova senha" value={passwordForm.next} onChange={(next) => setPasswordForm({ ...passwordForm, next })} show={Boolean(showPasswords.next)} onToggle={() => togglePassword('next')} autoComplete="new-password" />
          <div className={`password-strength strength-${strength.score}`} aria-live="polite">
            <span>Força da senha: <b>{strength.label}</b></span>
            <span className="strength-meter" aria-hidden="true"><i style={{ width: `${(strength.score / 5) * 100}%` }} /></span>
          </div>
          <PasswordField id="confirm-password" label="Confirmar nova senha" value={passwordForm.confirmation} onChange={(confirmation) => setPasswordForm({ ...passwordForm, confirmation })} show={Boolean(showPasswords.confirmation)} onToggle={() => togglePassword('confirmation')} autoComplete="new-password" />
          <p className="hint">Mínimo de 8 caracteres, com pelo menos uma letra e um número. Após a troca, as outras sessões serão encerradas.</p>
          <button className="primary" disabled={Boolean(busy) || !emailProvider}>{busy === 'password' ? 'Atualizando senha...' : 'Alterar senha'}</button>
        </form>
        <div className="settings-form recovery-card">
          <h3>Recuperação de senha</h3>
          <p>Enviaremos um link de uso único para o endereço associado à conta.</p>
          <button type="button" className="secondary" onClick={sendRecovery} disabled={Boolean(busy)}>{busy === 'recovery' ? 'Enviando...' : 'Enviar link de recuperação'}</button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-sessions-title">
        <h2 id="settings-sessions-title">Sessões</h2>
        <p className="settings-description">A sessão atual está ativa neste navegador. O Supabase permite encerrar todas as outras sessões, mas não disponibiliza pela API cliente uma lista confiável de dispositivos individuais.</p>
        <article className="active-session">
          <div><b>{browserDescription()}</b><span>Este dispositivo · sessão atual</span><small>Último login da conta: {session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString('pt-BR') : 'agora'}</small></div>
          <button className="secondary" type="button" onClick={endOtherSessions} disabled={Boolean(busy)}>{busy === 'sessions' ? 'Encerrando...' : 'Sair de todos os outros dispositivos'}</button>
        </article>
        <button className="text-button" type="button" onClick={endCurrentSession} disabled={Boolean(busy)}>{busy === 'current-session' ? 'Encerrando...' : 'Encerrar sessão deste dispositivo'}</button>
      </section>

      <section className="settings-section danger-zone settings-danger" aria-labelledby="settings-danger-title">
        <h2 id="settings-danger-title"><ShieldCheck /> Zona de perigo</h2>
        <p className="settings-description">A exclusão remove permanentemente perfil, playlists, mensagens, preferências e arquivos associados.</p>
        <form className="settings-form" onSubmit={deleteAccount}>
          {!emailProvider && <p className="hint">A exclusão exige senha de e-mail para reautenticação. Esta conta usa login social.</p>}
          <PasswordField id="delete-current-password" label="Senha atual" value={deleteForm.password} onChange={(password) => setDeleteForm({ ...deleteForm, password })} show={Boolean(showPasswords.delete)} onToggle={() => togglePassword('delete')} autoComplete="current-password" />
          <label htmlFor="delete-confirmation">Digite EXCLUIR para confirmar</label>
          <input id="delete-confirmation" value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} required />
          <button className="danger-button" disabled={Boolean(busy) || !emailProvider}>{busy === 'delete' ? 'Excluindo conta...' : 'Excluir minha conta'}</button>
        </form>
      </section>
    </Page>
  )
}

function ResetPassword({ app }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [show, setShow] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [completed, setCompleted] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const policyError = passwordPolicyError(password)
    if (policyError) return setNotice(policyError)
    if (password !== confirmation) return setNotice('A confirmação da senha não confere.')
    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setCompleted(true)
      app.setPasswordRecovery(false)
      setNotice('Senha redefinida com sucesso.')
    } catch (error) {
      setNotice(error.message || 'Não foi possível redefinir a senha. Solicite um novo link.')
    } finally {
      setBusy(false)
    }
  }

  if (completed) {
    return (
      <Page title="Senha atualizada" subtitle="Sua senha foi redefinida com sucesso.">
        <button className="primary" onClick={() => navigate('/', { replace: true })}>Continuar para o Harmony</button>
      </Page>
    )
  }
  if (!app.passwordRecovery) return <Navigate to="/" replace />
  return (
    <Page title="Redefinir senha" subtitle="Escolha uma senha nova para sua conta.">
      <form className="settings-form reset-password-form" onSubmit={submit}>
        <PasswordField id="recovery-new-password" label="Nova senha" value={password} onChange={setPassword} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <div className={`password-strength strength-${passwordStrength(password).score}`} aria-live="polite">Força da senha: <b>{passwordStrength(password).label}</b></div>
        <PasswordField id="recovery-confirm-password" label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} show={showConfirmation} onToggle={() => setShowConfirmation(!showConfirmation)} autoComplete="new-password" />
        {notice && <p className="notice" role="alert">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Redefinir senha'}</button>
      </form>
    </Page>
  )
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
  const location = useLocation()
  const baseApp = useSynq()
  const unread = useUnreadMessages(
    baseApp.user?.id,
    baseApp.preferences?.chat_notifications_enabled === true
  )
  const app = { ...baseApp, ...unread }
  if (!app.ready) return <main className="callback">Carregando Harmony...</main>
  if (configured && !app.user) return <Auth />
  if (app.passwordRecovery && location.pathname !== '/redefinir-senha') {
    return <Navigate to="/redefinir-senha" replace />
  }
  return (
    <Shell app={app}>
      <Routes>
        <Route path="/" element={<Discover app={app} />} />
        <Route path="/biblioteca" element={<Library app={app} />} />
        <Route path="/comunidade" element={<Community app={app} />} />
        <Route path="/mensagens" element={<Messages app={app} />} />
        <Route path="/retrospectiva" element={<Retrospective app={app} />} />
        <Route path="/perfil" element={<Profile app={app} />} />
        <Route path="/configuracoes" element={<AccountSettings app={app} />} />
        <Route path="/redefinir-senha" element={<ResetPassword app={app} />} />
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
