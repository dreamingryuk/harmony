import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Music2, Search, Sparkles } from 'lucide-react'
import { connectSpotify, searchTracks } from '../lib/spotify'
import { searchYoutubeTracks, youtubeApiKey } from '../lib/youtube'
import { useMusicConnections } from '../hooks/useMusicConnections'
import { Page, Section, TrackRow } from '../components/Media'

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

export function Discover({ app }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [activePlatform, setActivePlatform] = useState('spotify'),
    [showPlatformOptions, setShowPlatformOptions] = useState(false)
  const { connections, connectYoutube } = useMusicConnections(app.user.id)
  const connectedPlatforms = Object.entries(connections)
    .filter(([, connected]) => connected)
    .map(([platform]) => platform)

  useEffect(() => {
    if (!connections[activePlatform] && connectedPlatforms.length) {
      setActivePlatform(connectedPlatforms[0])
    }
  }, [activePlatform, connections, connectedPlatforms])

  const connectPlatform = async (platform) => {
    try {
      if (platform === 'spotify') {
        await connectSpotify()
      } else {
        connectYoutube()
        setActivePlatform('youtube')
      }
      setShowPlatformOptions(false)
    } catch (error) {
      alert(error.message)
    }
  }
  const search = async (event) => {
    event.preventDefault()
    if (!query.trim()) return
    try {
      setBusy(true)
      setResults(
        activePlatform === 'youtube'
          ? await searchYoutubeTracks(query.trim())
          : await searchTracks(query.trim())
      )
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
      <section className={`hero ${connectedPlatforms.length ? 'hero-connected' : ''}`}>
        <div>
          {!connectedPlatforms.length && (
            <>
              <span className="eyebrow">
                <Sparkles /> DESCOBERTA DIÁRIA
              </span>
              <h2>O próximo som que vai virar seu favorito.</h2>
              <p>
                Conecte uma plataforma de música, importe playlists do Spotify e encontre gente
                que vibra na mesma frequência.
              </p>
            </>
          )}
          {!connectedPlatforms.length ? (
            <div className="music-connect">
              <button className="primary" onClick={() => setShowPlatformOptions((open) => !open)}>
                Conectar com plataforma de música
              </button>
              {showPlatformOptions && (
                <div className="music-connect-options">
                  <button className="secondary" onClick={() => connectPlatform('spotify')}>
                    Conectar Spotify
                  </button>
                  <button
                    className="secondary"
                    onClick={() => connectPlatform('youtube')}
                    disabled={!youtubeApiKey()}
                    title={!youtubeApiKey() ? 'O site ainda precisa configurar a chave da API do YouTube.' : undefined}
                  >
                    Ativar YouTube Music
                  </button>
                  {!youtubeApiKey() && (
                    <p className="hint">O YouTube Music ainda não foi configurado neste site.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="music-platforms">
              {connectedPlatforms.length > 1 ? (
                connectedPlatforms.map((platform) => (
                  <button
                    type="button"
                    className={activePlatform === platform ? 'active' : ''}
                    key={platform}
                    onClick={() => {
                      setActivePlatform(platform)
                      setResults([])
                    }}
                  >
                    {platform === 'youtube' ? 'YouTube Music' : 'Spotify'}
                  </button>
                ))
              ) : (
                <span>
                  Conectado a {activePlatform === 'youtube' ? 'YouTube Music' : 'Spotify'} ·{' '}
                  <Link to="/configuracoes">Gerenciar plataformas</Link>
                </span>
              )}
            </div>
          )}
        </div>
        <Music2 className="hero-icon" />
      </section>
      <form className="search" onSubmit={search}>
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            activePlatform === 'youtube'
              ? 'Busque músicas e vídeos no YouTube...'
              : 'Busque uma faixa, álbum ou artista...'
          }
          disabled={!connections[activePlatform]}
        />
        <button disabled={busy || !connections[activePlatform]}>
          {busy ? 'Buscando...' : 'Buscar'}
        </button>
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
