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
  LogOut,
  ExternalLink,
  X,
  ListMusic,
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
  const [unreadMessages, setUnreadMessages] = useState(0)
  useEffect(() => {
    if (!configured || !app.user) return
    const channel = supabase
      .channel(`synq-notifications-${app.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.recipient_id !== app.user.id) return
          setUnreadMessages((count) => count + 1)
          if (window.Notification?.permission === 'granted') {
            new Notification('Nova mensagem no Harmony', {
              body: 'Você recebeu uma nova mensagem.',
            })
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [app.user])
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
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <button className="profile-short" onClick={() => navigate('/perfil')}>
            <span className="avatar">{initials(app.profile?.display_name)}</span>
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
            onClick={() => to === '/mensagens' && setUnreadMessages(0)}
          >
            <Icon />
            <span>{label}</span>
            {to === '/mensagens' && unreadMessages > 0 && <i className="notification-dot" />}
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
    [duration, setDuration] = useState(0),
    [showEmbed, setShowEmbed] = useState(false)
  const audio = useRef(null),
    logged = useRef(new Set())
  useEffect(() => {
    const listener = (event) => {
      setTrack(event.detail)
      setPlaying(false)
      setProgress(0)
      setShowEmbed(false)
    }
    window.addEventListener('synq-play', listener)
    return () => window.removeEventListener('synq-play', listener)
  }, [])
  const toggle = async () => {
    if (!track) return
    if (!track.previewUrl) return setShowEmbed(true)
    if (playing) {
      audio.current.pause()
      setPlaying(false)
    } else {
      try {
        await audio.current.play()
      } catch {
        setShowEmbed(true)
        return
      }
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
    <>
      {showEmbed && (
        <div className="embed-overlay" role="dialog" aria-modal="true" aria-label="Player Spotify">
          <section className="spotify-embed-panel">
            <button
              className="icon close-embed"
              onClick={() => setShowEmbed(false)}
              aria-label="Fechar player"
            >
              <X />
            </button>
            <p>Reprodução oficial do Spotify</p>
            <iframe
              title={`Player de ${track.title}`}
              src={`https://open.spotify.com/embed/track/${track.spotifyId}?utm_source=generator`}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          </section>
        </div>
      )}
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
    </>
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

function SharedMusic({ item }) {
  if (!item) return null
  const playlist = item.kind === 'playlist'
  const title = playlist ? item.title : item.title
  const subtitle = playlist ? `${item.track_count || 0} faixas · Playlist` : item.artists
  return (
    <article className="shared-music">
      <CoverArt src={item.coverUrl || item.cover_url} alt="" />
      <div>
        <b>{title}</b>
        <span>{subtitle}</span>
      </div>
      {playlist && item.spotifyUrl ? (
        <a href={item.spotifyUrl} target="_blank" rel="noreferrer">
          <ExternalLink />
        </a>
      ) : (
        !playlist && (
          <button className="icon" onClick={() => play(fromJson(item) || item)}>
            <Play />
          </button>
        )
      )}
    </article>
  )
}

function MusicPicker({ app, open, onClose, onPick }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState([]),
    [playlists, setPlaylists] = useState([]),
    [error, setError] = useState('')
  useEffect(() => {
    if (!open || !configured) return
    supabase
      .from('playlists')
      .select('id,title,imported_spotify_id,playlist_tracks(count)')
      .eq('owner_id', app.user.id)
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message)
        else setPlaylists(data || [])
      })
  }, [open, app.user])
  if (!open) return null
  const search = async (event) => {
    event.preventDefault()
    try {
      setError('')
      setResults(await searchTracks(query))
    } catch (searchError) {
      setError(searchError.message)
    }
  }
  const pickPlaylist = (playlist) =>
    onPick({
      kind: 'playlist',
      title: playlist.title,
      track_count: playlist.playlist_tracks?.[0]?.count || 0,
      coverUrl: FALLBACK_COVER,
      spotifyUrl: playlist.imported_spotify_id
        ? `https://open.spotify.com/playlist/${playlist.imported_spotify_id}`
        : '',
    })
  return (
    <div className="embed-overlay" role="dialog" aria-modal="true">
      <section className="music-picker">
        <button className="icon close-embed" onClick={onClose}>
          <X />
        </button>
        <h2>Compartilhar música ou playlist</h2>
        <form className="search" onSubmit={search}>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar música no Spotify"
          />
          <button>Buscar</button>
        </form>
        {error && <p className="form-error">{error}</p>}
        {results.map((track) => (
          <button className="picker-row" key={track.spotifyId} onClick={() => onPick(track)}>
            <CoverArt src={track.coverUrl} />
            <span>
              <b>{track.title}</b>
              <small>{track.artists}</small>
            </span>
            <Plus />
          </button>
        ))}
        <h3>Suas playlists</h3>
        {playlists.map((playlist) => (
          <button className="picker-row" key={playlist.id} onClick={() => pickPlaylist(playlist)}>
            <span className="playlist-icon">
              <ListMusic />
            </span>
            <span>
              <b>{playlist.title}</b>
              <small>Playlist</small>
            </span>
            <Plus />
          </button>
        ))}
      </section>
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

function Library({ app }) {
  const [playlists, setPlaylists] = useState([]),
    [saved, setSaved] = useState([]),
    [imports, setImports] = useState([]),
    [loading, setLoading] = useState(false)
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
        <button
          className="primary"
          onClick={async () => {
            const name = prompt('Nome da nova playlist:')
            if (name && configured) {
              await supabase.from('playlists').insert({ owner_id: app.user.id, title: name })
              load()
            }
          }}
        >
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
            <article className="playlist-card" key={item.id}>
              <div className="playlist-art">
                <Music2 />
              </div>
              <b>{item.title}</b>
              <span>{item.playlist_tracks?.length || 0} faixas</span>
            </article>
          ))}
          {!playlists.length && <Empty text="Crie uma playlist ou importe uma do Spotify." />}
        </div>
      </Section>
    </Page>
  )
}

function Community({ app }) {
  const [posts, setPosts] = useState([]),
    [content, setContent] = useState(''),
    [error, setError] = useState(''),
    [publishing, setPublishing] = useState(false),
    [sharedMusic, setSharedMusic] = useState(null),
    [pickerOpen, setPickerOpen] = useState(false)
  const load = useCallback(async () => {
    if (!configured) return
    const { data, error: queryError } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(display_name), post_likes(user_id)')
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
  const publish = async (event) => {
    event.preventDefault()
    if (!content.trim()) return
    if (!configured) return setError('Configure o Supabase para publicar na comunidade.')
    try {
      setPublishing(true)
      const { error: insertError } = await supabase.from('posts').insert({
        author_id: app.user.id,
        content: content.trim(),
        track: sharedMusic
          ? sharedMusic.kind === 'playlist'
            ? sharedMusic
            : trackJson(sharedMusic)
          : null,
      })
      if (insertError) throw insertError
      setContent('')
      setSharedMusic(null)
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
  return (
    <Page title="Comunidade" subtitle="O que está tocando na cabeça de todo mundo?">
      <form className="composer" onSubmit={publish}>
        <span className="avatar">{initials(app.profile?.display_name)}</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compartilhe uma descoberta, um álbum ou uma sensação..."
        />
        <button
          type="button"
          className="icon"
          onClick={() => setPickerOpen(true)}
          aria-label="Adicionar música ou playlist"
        >
          <Music2 />
        </button>
        <button className="primary" disabled={publishing}>
          <Send /> Publicar
        </button>
      </form>
      {sharedMusic && <SharedMusic item={sharedMusic} />}
      <MusicPicker
        app={app}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(item) => {
          setSharedMusic(item)
          setPickerOpen(false)
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Section title="Feed">
        {posts.length ? (
          posts.map((post) => (
            <article className="post" key={post.id}>
              <span className="avatar">{initials(post.author?.display_name)}</span>
              <div>
                <b>{post.author?.display_name || 'Ouvinte Harmony'}</b>
                <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
                <p>{post.content}</p>
                {post.track && <SharedMusic item={post.track} />}
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
    </Page>
  )
}

function Messages({ app }) {
  const [profiles, setProfiles] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [sharedMusic, setSharedMusic] = useState(null),
    [pickerOpen, setPickerOpen] = useState(false)
  useEffect(() => {
    if (configured)
      supabase
        .from('profiles')
        .select('*')
        .neq('id', app.user.id)
        .then(({ data }) => setProfiles(data || []))
  }, [app.user])
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
  const send = async (event) => {
    event.preventDefault()
    if ((!text.trim() && !sharedMusic) || !selected) return
    await supabase.from('messages').insert({
      sender_id: app.user.id,
      recipient_id: selected.id,
      content: text.trim(),
      track: sharedMusic
        ? sharedMusic.kind === 'playlist'
          ? sharedMusic
          : trackJson(sharedMusic)
        : null,
    })
    setText('')
    setSharedMusic(null)
    load()
  }
  return (
    <Page title="Mensagens" subtitle="Converse sobre o que está te fazendo ouvir no repeat.">
      <div className="messages">
        <aside>
          {profiles.length ? (
            profiles.map((profile) => (
              <button
                onClick={() => setSelected(profile)}
                className={selected?.id === profile.id ? 'active' : ''}
                key={profile.id}
              >
                <span className="avatar">{initials(profile.display_name)}</span>
                {profile.display_name}
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
                <span className="avatar">{initials(selected.display_name)}</span>
                <b>{selected.display_name}</b>
              </header>
              <div className="chat">
                {messages.map((message) => (
                  <div
                    className={`message-bubble ${message.sender_id === app.user.id ? 'mine' : ''}`}
                    key={message.id}
                  >
                    {message.content}
                    {message.track && <SharedMusic item={message.track} />}
                  </div>
                ))}
              </div>
              <form onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Digite uma mensagem..."
                />
                <button
                  type="button"
                  className="icon"
                  onClick={() => setPickerOpen(true)}
                  aria-label="Compartilhar música ou playlist"
                >
                  <Music2 />
                </button>
                <button className="primary">
                  <Send />
                </button>
              </form>
              {sharedMusic && <SharedMusic item={sharedMusic} />}
              <MusicPicker
                app={app}
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onPick={(item) => {
                  setSharedMusic(item)
                  setPickerOpen(false)
                }}
              />
            </>
          ) : (
            <Empty text="Escolha alguém para iniciar uma conversa." />
          )}
        </section>
      </div>
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
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    favorite_genres: '',
  })
  useEffect(
    () =>
      setForm({
        display_name: app.profile?.display_name || '',
        bio: app.profile?.bio || '',
        favorite_genres: (app.profile?.favorite_genres || []).join(', '),
      }),
    [app.profile]
  )
  const save = async (event) => {
    event.preventDefault()
    if (!configured) return alert('Configure o Supabase para salvar seu perfil.')
    if (!form.display_name.trim()) return alert('Informe um nome de exibição.')
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name,
        bio: form.bio,
        favorite_genres: form.favorite_genres
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      .eq('id', app.user.id)
    if (error) alert(error.message)
    else {
      await app.refreshProfile(app.user)
      alert('Perfil salvo!')
    }
  }
  return (
    <Page title="Seu Perfil" subtitle="Faça seu perfil soar como você.">
      <div className="profile-hero">
        <span className="avatar big">{initials(app.profile?.display_name)}</span>
        <div>
          <h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2>
          <p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p>
        </div>
      </div>
      <form className="profile-form" onSubmit={save}>
        <label>
          Nome de exibição
          <input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </label>
        <label>
          Bio
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </label>
        <label>
          Gêneros favoritos
          <input
            value={form.favorite_genres}
            onChange={(e) => setForm({ ...form, favorite_genres: e.target.value })}
            placeholder="Pop, Rock, MPB..."
          />
        </label>
        <button className="primary">Salvar alterações</button>
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
  const app = useSynq()
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
