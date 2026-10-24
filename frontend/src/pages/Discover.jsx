import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Music2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { connectSpotify, searchTracks, spotifyArtists, spotifyPopularSongs } from '../lib/spotify'
import { searchYoutubeTracks, youtubeApiKey, youtubePopularTracks } from '../lib/youtube'
import { useMusicConnections } from '../hooks/useMusicConnections'
import { CoverArt, Page, Section, TrackRow } from '../components/Media'
import { PlaylistCard, PlaylistDialog } from '../components/PlaylistComponents'
import { playPlaylist } from '../utils/playlist'

const featured = [
  {
    spotifyId: '4uLU6hMCjMI75M1A2tKUQC',
    uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
    title: 'Never Gonna Give You Up',
    artists: 'Rick Astley',
    album: 'Whenever You Need Somebody',
    coverUrl: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02255e131abc1410833be95673',
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
    coverUrl: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028863bc11d2aa12b54f5aeb36',
    previewUrl: '',
    spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
    genres: ['Pop'],
  },
]

// Usada enquanto nenhuma plataforma está conectada.
const curatedArtists = [
  { id: 'artist-taylor', name: 'Taylor Swift', genre: 'Pop' },
  { id: 'artist-badbunny', name: 'Bad Bunny', genre: 'Reggaeton' },
  { id: 'artist-dua', name: 'Dua Lipa', genre: 'Dance pop' },
  { id: 'artist-travis', name: 'Travis Scott', genre: 'Hip-hop' },
  { id: 'artist-billie', name: 'Billie Eilish', genre: 'Pop alternativo' },
  { id: 'artist-coldplay', name: 'Coldplay', genre: 'Rock alternativo' },
  { id: 'artist-aurora', name: 'AURORA', genre: 'Indie pop' },
  { id: 'artist-anitta', name: 'Anitta', genre: 'Pop brasileiro' },
]

const platformName = (platform) => (platform === 'youtube' ? 'YouTube' : platform === 'spotify' ? 'Spotify' : 'Harmony')

export function Discover({ app }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [activePlatform, setActivePlatform] = useState('spotify'),
    [showPlatformOptions, setShowPlatformOptions] = useState(false),
    [trendPlatform, setTrendPlatform] = useState('curated'),
    [trending, setTrending] = useState(featured),
    [trendingBusy, setTrendingBusy] = useState(false),
    [trendingError, setTrendingError] = useState(''),
    [artists, setArtists] = useState(curatedArtists),
    [publicPlaylists, setPublicPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null),
    [refreshKey, setRefreshKey] = useState(0)
  const { connections, connectYoutube } = useMusicConnections(app.user.id)
  const connectedPlatforms = Object.entries(connections)
    .filter(([, connected]) => connected)
    .map(([platform]) => platform)

  useEffect(() => {
    if (!connections[activePlatform] && connectedPlatforms.length) {
      setActivePlatform(connectedPlatforms[0])
    }
  }, [activePlatform, connections, connectedPlatforms])

  // Escolhe a fonte das paradas: a plataforma conectada, ou o conteúdo curado.
  useEffect(() => {
    setTrendPlatform((current) =>
      current !== 'curated' && connections[current] ? current : connectedPlatforms[0] || 'curated'
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections])

  const loadArtists = async (tracks) => {
    try {
      const ids = [...new Set(tracks.flatMap((track) => track.artistIds || []))]
      const list = await spotifyArtists(ids)
      return list.length ? list : curatedArtists
    } catch {
      return curatedArtists
    }
  }

  // Em alta no Spotify/YouTube (ou no conteúdo curado quando nada está conectado).
  useEffect(() => {
    let active = true
    const load = async () => {
      setTrendingBusy(true)
      setTrendingError('')
      try {
        if (trendPlatform === 'spotify') {
          const tracks = await spotifyPopularSongs(12)
          if (!active) return
          setTrending(tracks)
          setArtists(await loadArtists(tracks))
        } else if (trendPlatform === 'youtube') {
          const tracks = await youtubePopularTracks(12)
          if (!active) return
          setTrending(tracks)
          setArtists(curatedArtists)
        } else {
          setTrending(featured)
          setArtists(curatedArtists)
        }
      } catch (error) {
        if (!active) return
        setTrending(featured)
        setArtists(curatedArtists)
        setTrendingError(error.message)
      } finally {
        if (active) setTrendingBusy(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [trendPlatform, refreshKey])

  // Playlists públicas da comunidade: quem está no Harmony está ouvindo agora.
  useEffect(() => {
    if (!configured) return
    supabase
      .from('playlists')
      .select('*, playlist_tracks(*)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setPublicPlaylists(data || []))
      .catch(() => {})
  }, [])

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
  const runSearch = async (term) => {
    const clean = (term || '').trim()
    if (!clean) return
    try {
      setBusy(true)
      setResults(
        activePlatform === 'youtube'
          ? await searchYoutubeTracks(clean)
          : await searchTracks(clean)
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  const search = (event) => {
    event.preventDefault()
    runSearch(query)
  }
  const openPlaylist = (playlist) => setOpenedPlaylist(playlist)
  const trendLabel = `no ${platformName(trendPlatform)}`
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
          onChange={(event) => setQuery(event.target.value)}
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
      {results.length ? (
        <Section title="Resultados da busca">
          <div className="section-head">
            <p className="hint">{results.length} faixas encontradas em {platformName(activePlatform)}.</p>
            <button type="button" className="secondary small-button" onClick={() => { setResults([]); setQuery('') }}>
              <X /> Limpar busca
            </button>
          </div>
          {results.map((track) => (
            <TrackRow key={track.spotifyId} track={track} queue={results} />
          ))}
        </Section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>Em alta {trendLabel}</h2>
              <div className="chart-controls">
                {connectedPlatforms.map((platform) => (
                  <button
                    type="button"
                    key={platform}
                    className={trendPlatform === platform ? 'active' : ''}
                    onClick={() => setTrendPlatform(platform)}
                  >
                    {platformName(platform)}
                  </button>
                ))}
                <button
                  type="button"
                  className="chart-refresh"
                  onClick={() => setRefreshKey((key) => key + 1)}
                  disabled={trendingBusy || trendPlatform === 'curated'}
                  aria-label="Atualizar parada"
                  title="Atualizar parada"
                >
                  <RefreshCw />
                </button>
              </div>
            </div>
            {trendingError && <p className="hint">{trendingError}</p>}
            {trendingBusy ? (
              <p className="hint">Buscando as faixas mais tocadas...</p>
            ) : (
              trending.map((track) => <TrackRow key={track.spotifyId} track={track} queue={trending} />)
            )}
            {trendPlatform === 'curated' && !trendingError && (
              <p className="hint">
                Conecte o Spotify ou o YouTube na busca acima para ver as paradas atualizadas.
              </p>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Playlists em alta</h2>
              <p className="hint">As playlists públicas mais recentes da comunidade.</p>
            </div>
            {publicPlaylists.length ? (
              <div className="playlist-grid">
                {publicPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onOpen={openPlaylist}
                    onShuffle={(item) => playPlaylist(item, { shuffle: true })}
                  />
                ))}
              </div>
            ) : (
              <p className="hint">
                Ainda não há playlists públicas por aqui. Marque uma como pública na sua Biblioteca
                para ela aparecer para todo mundo.
              </p>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Artistas em alta</h2>
              <p className="hint">Toque em um artista para ver as faixas dele.</p>
            </div>
            <div className="artist-grid">
              {artists.map((artist) => (
                <button type="button" className="artist-card" key={artist.id} onClick={() => runSearch(artist.name)}>
                  <span className="artist-avatar">
                    <CoverArt src={artist.image} alt={`Foto de ${artist.name}`} />
                  </span>
                  <b title={artist.name}>{artist.name}</b>
                  <small>{artist.genre || artist.genres?.[0] || 'Artista'}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Playlists do Spotify para você</h2>
            </div>
            <div className="embed-grid">
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
            </div>
          </section>
        </>
      )}
      {openedPlaylist && (
        <PlaylistDialog
          playlist={openedPlaylist}
          app={app}
          readOnly
          onClose={() => setOpenedPlaylist(null)}
          onSaved={() => {}}
        />
      )}
    </Page>
  )
}
