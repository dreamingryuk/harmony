import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ExternalLink, Home, Library as LibraryIcon, ListMusic, LogOut, MessageCircle, MoonStar, Music2, Plus, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SunMedium, Trash2, Users, UserRound, BarChart3, Settings } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { nextLoopMode, playNext, playPrevious, queueState, setLoop, setShuffle, trackJson } from '../utils/track'
import { Avatar, CoverArt, MarqueeText } from './Media'
import { AddToPlaylistDialog } from './PlaylistComponents'
import { YouTubePlayer } from './YouTubePlayer'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

const trackKey = (track) => track?.youtubeId || track?.mediaId

// O último item é o rótulo curto usado na barra inferior de telas pequenas.
const nav = [
  ['/', 'Descobrir', Home, 'Descobrir'],
  ['/biblioteca', 'Biblioteca', LibraryIcon, 'Biblioteca'],
  ['/comunidade', 'Comunidade', Users, 'Comunidade'],
  ['/mensagens', 'Mensagens', MessageCircle, 'Mensagens'],
  ['/notificacoes', 'Notificações', Bell, 'Avisos'],
  ['/retrospectiva', 'Retrospectiva', BarChart3, 'Resumo'],
  ['/perfil', 'Perfil', UserRound, 'Perfil'],
  ['/configuracoes', 'Configurações', Settings, 'Ajustes'],
]

// O que aconteceu na notificação mais recente.
const toastText = (notification) => {
  if (notification.kind === 'post_like') return 'curtiu sua publicação.'
  if (notification.kind === 'comment_reply') return 'respondeu em uma publicação que você acompanha.'
  if (notification.kind === 'comment_mention') return 'mencionou você em uma resposta.'
  return 'mencionou você em uma publicação.'
}

function getThemePreference() {
  const stored = localStorage.getItem('harmony-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'auto'
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getThemePreference())

  useEffect(() => {
    const sync = () => setTheme(getThemePreference())
    sync()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', sync)
    window.addEventListener('storage', (event) => {
      if (event.key === 'harmony-theme') sync()
    })
    return () => {
      media.removeEventListener?.('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const cycleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('harmony-theme', nextTheme)
    const root = document.documentElement
    root.dataset.theme = nextTheme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : nextTheme
  }

  const label = theme === 'dark' ? 'Tema escuro' : theme === 'light' ? 'Tema claro' : 'Tema automático'
  return (
    <button type="button" className="theme-toggle" onClick={cycleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <MoonStar size={18} /> : <SunMedium size={18} />}
    </button>
  )
}

export function Shell({ app, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [accountsOpen, setAccountsOpen] = useState(false)
  // A altura real do player reposiciona a barra inferior e o fim da página.
  const [playerHeight, setPlayerHeight] = useState(0)
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
  const switchAccount = async (account) => {
    if (account.id === app.user?.id) return setAccountsOpen(false)
    const changed = await app.switchAccount(account)
    if (!changed) setLogoutError('Essa sessão expirou. Entre novamente para adicioná-la de volta.')
    setAccountsOpen(false)
  }
  const addAccount = async () => {
    if ((app.accounts?.length || 0) >= app.accountLimit) return setLogoutError(`Você pode salvar no máximo ${app.accountLimit} contas neste navegador.`)
    if (configured) await supabase.auth.signOut({ scope: 'local' })
    setAccountsOpen(false)
    navigate('/')
  }
  return (
    <div className="shell" style={{ '--player-h': `${playerHeight}px` }}>
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
              {to === '/notificacoes' && app.unreadMentionCount > 0 && (
                <span
                  className="nav-badge"
                  aria-label={`${app.mentionNotifications.length} notificações não lidas`}
                >
                  {app.unreadMentionCount > 99 ? '99+' : app.unreadMentionCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="sidebar-top-actions">
            <ThemeToggle />
          </div>
          <button className="profile-short" onClick={() => navigate('/perfil')}>
            <Avatar profile={app.profile} />
            {app.profile?.display_name || 'Ouvinte'}
          </button>
          <div className="account-switcher">
            <button type="button" className="text-button" onClick={() => setAccountsOpen((open) => !open)}>Alternar conta</button>
            {accountsOpen && <div className="account-menu">
              {(app.accounts || []).map((account) => <div className={`account-row ${account.id === app.user?.id ? 'current' : ''}`} key={account.id}>
                <button type="button" onClick={() => switchAccount(account)}>{account.email || 'Conta sem e-mail'}{account.id === app.user?.id && <small>Conta atual</small>}</button>
                {account.id !== app.user?.id && <button type="button" className="icon" aria-label="Remover conta deste navegador" onClick={() => app.removeAccount(account.id)}><Trash2 /></button>}
              </div>)}
              <button type="button" className="account-add" onClick={addAccount}><Plus /> Adicionar outra conta</button>
              <button type="button" className="account-all-out" onClick={() => app.signOutAllAccounts()}>Sair de todas</button>
            </div>}
          </div>
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
              {toastText(app.mentionNotifications[0])}
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
        {nav.map(([to, label, Icon, short]) => (
          <NavLink
            end={to === '/'}
            key={to}
            to={to}
            aria-label={label}
            className={location.pathname === to ? 'active' : ''}
          >
            <Icon />
            <span className="nav-text">
              <span className="nav-full">{label}</span>
              <span className="nav-short">{short}</span>
            </span>
            {to === '/mensagens' && app.unreadCount > 0 && <i className="nav-dot" />}
            {to === '/notificacoes' && app.unreadMentionCount > 0 && (
              <i className="nav-dot" />
            )}
          </NavLink>
        ))}
      </nav>
      <Player app={app} onHeightChange={setPlayerHeight} />
    </div>
  )
}

export function Player({ app, onHeightChange }) {
  const [track, setTrack] = useState(null),
    [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(0),
    [playerError, setPlayerError] = useState(''),
    [playerApiUnavailable, setPlayerApiUnavailable] = useState(false),
    [queueNav, setQueueNav] = useState(() => queueState()),
    [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const youtubePlayer = useRef(null),
    playRequested = useRef(false),
    logged = useRef(new Set()),
    activeTrack = useRef(null),
    footer = useRef(null)
  // Comunica a altura do player para o Shell: barra inferior e fim da página
  // acompanham qualquer mudança de layout (uma ou duas linhas de controles).
  useEffect(() => {
    const element = footer.current
    if (!onHeightChange) return
    if (!element) {
      onHeightChange(0)
      return
    }
    const update = () => onHeightChange(element.offsetHeight)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onHeightChange, track])
  useEffect(() => {
    const listener = (event) => {
      const next = event.detail
      const nextKey = trackKey(next)
      const isSameTrack = Boolean(nextKey && nextKey === trackKey(activeTrack.current))
      activeTrack.current = next
      setQueueNav(queueState())
      // Escolher de novo a faixa que já está no player apenas retoma a reprodução.
      if (isSameTrack) {
        if (youtubePlayer.current) {
          try {
            youtubePlayer.current.playVideo()
            setPlaying(true)
            setPlayerError('')
          } catch (error) {
            setPlayerError(error.message || 'Não foi possível iniciar a reprodução.')
          }
        } else {
          playRequested.current = true
        }
        return
      }
      youtubePlayer.current = null
      playRequested.current = true
      setTrack(next)
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
    const id = trackKey(playedTrack)
    if (!configured || !id || logged.current.has(id)) return
    logged.current.add(id)
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
      // Repetir uma faixa: recomeça a mesma música antes de avançar a fila.
      if (queueState().loop === 'one' && youtubePlayer.current) {
        try {
          youtubePlayer.current.seekTo(0, true)
          youtubePlayer.current.playVideo()
          setProgress(0)
          setPlaying(true)
          return
        } catch (error) {
          setPlayerError(error.message || 'Não foi possível repetir a faixa.')
        }
      }
      // Fim da faixa: segue para a próxima da fila, quando houver.
      if (playNext()) return
      setProgress(0)
      setPlaying(false)
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
  const goPrevious = () => {
    if (!track) return
    if (playPrevious()) return
    try {
      if (track.platform === 'youtube' && track.youtubeId) {
        if (!youtubePlayer.current) {
          playRequested.current = true
          return
        }
        youtubePlayer.current.seekTo(0, true)
        youtubePlayer.current.playVideo()
        setProgress(0)
        setPlaying(true)
        setPlayerError('')
      }
    } catch (error) {
      setPlayerError(error.message || 'Não foi possível reiniciar a faixa.')
    }
  }

  const goNext = () => {
    if (track) playNext()
  }

  const toggleShuffle = () => {
    setShuffle(!queueNav.shuffle)
    setQueueNav(queueState())
  }

  const cycleLoop = () => {
    setLoop(nextLoopMode(queueNav.loop))
    setQueueNav(queueState())
  }

  const loopLabel =
    queueNav.loop === 'one'
      ? 'Repetir esta faixa'
      : queueNav.loop === 'all'
        ? 'Repetir a fila inteira'
        : 'Repetição desligada'

  if (!track) return null
  const isYoutube = track.platform === 'youtube' && track.youtubeId
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  return (
    <footer className="player youtube-player" ref={footer}>
      <div className="player-media">
        {isYoutube && (
          <div className="player-audio">
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
                    'Não foi possível carregar os controles do YouTube. Tente abrir a faixa no YouTube.'
                )
                setPlaying(false)
              }}
            />
          </div>
        )}
        <CoverArt className="player-cover" src={track.coverUrl} alt={`Capa de ${track.album || track.title}`} />
      </div>
      <div className="player-track">
        <MarqueeText text={track.title} ariaLabel={track.title} className="player-title" />
        <span>{track.artists}</span>
      </div>
      <div className="player-controls">
        <button
          type="button"
          className={`icon player-mode ${queueNav.shuffle ? 'active' : ''}`}
          onClick={toggleShuffle}
          aria-pressed={Boolean(queueNav.shuffle)}
          aria-label={queueNav.shuffle ? 'Desligar reprodução aleatória' : 'Ligar reprodução aleatória'}
          title="Aleatório"
        >
          <Shuffle />
        </button>
        <button type="button" className="icon player-skip" onClick={goPrevious} aria-label="Música anterior">
          <SkipBack fill="currentColor" />
        </button>
        {isYoutube && !playerApiUnavailable && (
          <button type="button" className="play" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
            {playing ? 'Ⅱ' : <Play fill="currentColor" />}
          </button>
        )}
        <button
          type="button"
          className="icon player-skip"
          onClick={goNext}
          disabled={!queueNav.canNext}
          aria-label="Próxima música"
        >
          <SkipForward fill="currentColor" />
        </button>
        <button
          type="button"
          className={`icon player-mode ${queueNav.loop !== 'off' ? 'active' : ''}`}
          onClick={cycleLoop}
          aria-pressed={queueNav.loop !== 'off'}
          aria-label={loopLabel}
          title={loopLabel}
        >
          {queueNav.loop === 'one' ? <Repeat1 /> : <Repeat />}
        </button>
      </div>
      {isYoutube && !playerApiUnavailable ? (
        <div className="player-progress">
          <span className="player-time">{formatTime(progress)}</span>
          <input
            aria-label="Progresso"
            className="progress"
            type="range"
            min="0"
            max={duration || 1}
            step="1"
            value={Math.min(progress, duration || 1)}
            style={{ '--progress': `${percent}%` }}
            onChange={(event) => {
              const value = Number(event.target.value)
              youtubePlayer.current?.seekTo(value, true)
              setProgress(value)
            }}
          />
          <span className="player-time">{formatTime(duration)}</span>
        </div>
      ) : isYoutube ? (
        <a
          className="player-hint"
          title="Não foi possível carregar os controles do YouTube."
          aria-label="Abrir no YouTube"
          href={track.externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no YouTube
        </a>
      ) : null}
      {playerError && <span className="player-error" role="status">{playerError}</span>}
      <button
        type="button"
        className="icon player-add"
        onClick={() => setShowPlaylistPicker(true)}
        aria-label="Adicionar à playlist"
        title="Adicionar à playlist"
      >
        <ListMusic />
      </button>
      <a
        className="player-external"
        title="Abrir no YouTube"
        aria-label="Abrir no YouTube"
        href={track.externalUrl}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink />
      </a>
      {showPlaylistPicker && <AddToPlaylistDialog track={track} app={app} onClose={() => setShowPlaylistPicker(false)} />}
    </footer>
  )
}
