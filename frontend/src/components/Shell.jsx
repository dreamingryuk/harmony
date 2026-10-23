import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ExternalLink, Home, Library as LibraryIcon, LogOut, MessageCircle, Music2, Play, Users, UserRound, BarChart3, Settings } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { trackJson } from '../utils/track'
import { Avatar, CoverArt } from './Media'
import { YouTubePlayer } from './YouTubePlayer'

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
        {app.mentionNotifications?.[0] && (
          <aside className="mention-toast" role="status">
            <Bell size={19} />
            <p>
              <b>{app.mentionNotifications[0].actor?.display_name || 'Alguém'}</b>{' '}
              {app.mentionNotifications[0].kind === 'comment_mention'
                ? 'mencionou você em uma resposta.'
                : 'mencionou você em uma publicação.'}
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(`/comunidade?notificacao=${encodeURIComponent(app.mentionNotifications[0].id)}`)
              }
            >
              Ver postagem
            </button>
          </aside>
        )}
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
    [duration, setDuration] = useState(0),
    [playerError, setPlayerError] = useState(''),
    [playerApiUnavailable, setPlayerApiUnavailable] = useState(false)
  const youtubePlayer = useRef(null),
    playRequested = useRef(false),
    logged = useRef(new Set())
  useEffect(() => {
    const listener = (event) => {
      youtubePlayer.current = null
      playRequested.current = false
      setTrack(event.detail)
      setPlaying(false)
      setProgress(0)
      setDuration(0)
      setPlayerError('')
      setPlayerApiUnavailable(false)
    }
    window.addEventListener('synq-play', listener)
    return () => window.removeEventListener('synq-play', listener)
  }, [])

  const logPlayback = useCallback(async (playedTrack) => {
    if (!configured || logged.current.has(playedTrack.spotifyId)) return
    logged.current.add(playedTrack.spotifyId)
    try {
      const { error } = await supabase.from('listening_events').insert({
        user_id: app.user.id,
        track: trackJson(playedTrack),
        artist_name: playedTrack.artists,
        genres: playedTrack.genres || [],
      })
      if (error) console.error('Não foi possível registrar a reprodução:', error)
    } catch (error) {
      console.error('Não foi possível registrar a reprodução:', error)
    }
  }, [app.user.id])

  const handleYoutubeReady = useCallback((player) => {
    youtubePlayer.current = player
    if (playRequested.current) {
      playRequested.current = false
      try {
        player.playVideo()
      } catch (error) {
        setPlayerError(error.message || 'Não foi possível iniciar a reprodução.')
      }
    }
  }, [])

  const handleYoutubeState = useCallback((state) => {
    const youtubeStates = window.YT?.PlayerState
    const isPlaying = state === youtubeStates?.PLAYING
    setPlaying(isPlaying)
    if (state === youtubeStates?.ENDED) {
      setProgress(0)
      return
    }
    if (isPlaying && track) logPlayback(track)
  }, [logPlayback, track])

  const toggle = async () => {
    if (!track) return
    if (track.platform !== 'youtube') return
    try {
      setPlayerError('')
      if (playing) {
        youtubePlayer.current?.pauseVideo()
        setPlaying(false)
      } else if (youtubePlayer.current) {
        youtubePlayer.current.playVideo()
      } else {
        playRequested.current = true
      }
    } catch (error) {
      setPlayerError(error.message || 'Não foi possível controlar a reprodução.')
    }
  }
  if (!track) return null
  const isYoutube = track.platform === 'youtube' && track.youtubeId
  return (
    <footer className={`player ${isYoutube ? 'youtube-player' : 'spotify-player'}`}>
      {isYoutube ? (
        <YouTubePlayer
          key={track.youtubeId}
          videoId={track.youtubeId}
          onReady={handleYoutubeReady}
          onStateChange={handleYoutubeState}
          onApiUnavailable={setPlayerApiUnavailable}
          onProgress={(current, total) => {
            setProgress(current)
            setDuration(total)
          }}
          onError={(error) => {
            const messages = {
              101: 'Este vídeo não permite reprodução incorporada.',
              150: 'Este vídeo não permite reprodução incorporada.',
              5: 'O YouTube não conseguiu reproduzir este vídeo.',
              153: 'O YouTube não confirmou a origem do player. Verifique as restrições do domínio ou abra a faixa diretamente no YouTube.',
            }
            setPlayerError(
              messages[error] ||
                error ||
                'Não foi possível carregar os controles do YouTube. Tente reproduzir pelo vídeo incorporado.'
            )
            setPlaying(false)
          }}
        />
      ) : (
        <CoverArt src={track.coverUrl} />
      )}
      <div className="player-track">
        <b>{track.title}</b>
        <span>{track.artists}</span>
      </div>
      {isYoutube ? (
        <>
          {!playerApiUnavailable && (
            <>
              <button className="play" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
                {playing ? 'Ⅱ' : <Play fill="currentColor" />}
              </button>
              <input
                aria-label="Progresso"
                className="progress"
                type="range"
                min="0"
                max={duration || 1}
                value={Math.min(progress, duration || 1)}
                onChange={(event) => {
                  youtubePlayer.current?.seekTo(Number(event.target.value), true)
                  setProgress(Number(event.target.value))
                }}
              />
            </>
          )}
        </>
      ) : (
        <iframe
          className="spotify-embed"
          title={`Reproduzir ${track.title} no Spotify`}
          src={`https://open.spotify.com/embed/track/${encodeURIComponent(track.spotifyId)}?utm_source=generator&theme=0`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
      {playerError && <span className="player-error" role="status">{playerError}</span>}
      <a
        title={isYoutube ? 'Abrir no YouTube' : 'Abrir no Spotify'}
        href={track.externalUrl || track.spotifyUrl}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink />
      </a>
    </footer>
  )
}
