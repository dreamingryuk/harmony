import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, Home, Library as LibraryIcon, LogOut, MessageCircle, Music2, Play, Users, UserRound, BarChart3, Settings } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { trackJson } from '../utils/track'
import { Avatar, CoverArt } from './Media'

const nav = [
  ['/', 'Descobrir', Home],
  ['/biblioteca', 'Biblioteca', LibraryIcon],
  ['/comunidade', 'Comunidade', Users],
  ['/mensagens', 'Mensagens', MessageCircle],
  ['/retrospectiva', 'Retrospectiva', BarChart3],
  ['/perfil', 'Perfil', UserRound],
  ['/configuracoes', 'Configurações', Settings],
]

export function Shell({ app, children }) {
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

export function Player({ app }) {
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
