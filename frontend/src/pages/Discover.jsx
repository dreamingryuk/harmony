import { useState } from 'react'
import { Music2, Search, Sparkles } from 'lucide-react'
import { connectSpotify, disconnectSpotify, searchTracks, spotifyToken } from '../lib/spotify'
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
