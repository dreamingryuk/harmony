import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Music2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { searchYoutubeTracks, youtubeApiKey, youtubePopularTracks, youtubeArtists } from '../lib/youtube'
import { useMusicConnections } from '../hooks/useMusicConnections'
import { CoverArt, Page, Section, TrackRow } from '../components/Media'
import { PlaylistCard, PlaylistDialog } from '../components/PlaylistComponents'
import { playPlaylist } from '../utils/playlist'
import { fromJson } from '../utils/track'

const featured = []

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

const platformName = (platform) => (platform === 'youtube' ? 'YouTube' : 'Harmony')

export function Discover({ app }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [activePlatform, setActivePlatform] = useState('youtube'),
    [trendPlatform, setTrendPlatform] = useState('curated'),
    [trending, setTrending] = useState(featured),
    [trendingBusy, setTrendingBusy] = useState(false),
    [trendingError, setTrendingError] = useState(''),
    [artists, setArtists] = useState(curatedArtists),
    [publicPlaylists, setPublicPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null),
    [refreshKey, setRefreshKey] = useState(0),
    [sugestoes, setSugestoes] = useState({ meus: [], novos: [], tocadas: [], carregando: true, aviso: '' })
  const sugestaoKey = useRef('')
  const { connections, connectYoutube } = useMusicConnections(app.user.id)
  const connectedPlatforms = connections.youtube ? ['youtube'] : []

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

  // No YouTube as fotos vêm dos canais dos vídeos (uma chamada para todos).
  const loadYoutubeArtistList = async (tracks) => {
    try {
      const list = await youtubeArtists(tracks)
      return list.length ? list : curatedArtists
    } catch {
      return curatedArtists
    }
  }

  // Em alta no YouTube (ou conteúdo local enquanto a integração não está ativa).
  useEffect(() => {
    let active = true
    const load = async () => {
      setTrendingBusy(true)
      setTrendingError('')
      try {
        if (trendPlatform === 'youtube') {
          const tracks = await youtubePopularTracks(12)
          if (!active) return
          setTrending(tracks)
          setArtists(await loadYoutubeArtistList(tracks))
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

  // Sugestões personalizadas: o que a pessoa mais ouve (histórico de
  // reproduções) e artistas novos a partir do gênero do artista favorito dela.
  // A chave evita repetir as buscas toda vez que a janela ganha foco e também
  // decide se o resultado que chegou ainda é o que está valendo na tela.
  useEffect(() => {
    const plataforma = connections[activePlatform]
      ? activePlatform
      : Object.entries(connections).find(([, conectado]) => conectado)?.[0] || ''

    const descobrirNovos = async (termo) => {
      if (!termo || !plataforma) return []
      return youtubeArtists(await searchYoutubeTracks(termo, { limit: 12 }), 8)
    }

    const load = async () => {
      const chave = `${app.user.id}:${plataforma}`
      if (sugestaoKey.current === chave) return
      sugestaoKey.current = chave
      const vigente = () => sugestaoKey.current === chave

      if (!configured) {
        setSugestoes({ meus: [], novos: [], tocadas: [], carregando: false, aviso: 'Configure o Supabase para ver sugestões.' })
        return
      }
      setSugestoes((current) => ({ ...current, carregando: true, aviso: '' }))
      try {
        const { data: eventos, error } = await supabase
          .from('listening_events')
          .select('artist_name, genres, track, played_at')
          .eq('user_id', app.user.id)
          .order('played_at', { ascending: false })
          .limit(400)
        if (error) throw error

        const artistas = new Map()
        const faixas = new Map()
        const generos = new Map()
        for (const evento of eventos || []) {
          const nome = String(evento.artist_name || evento.track?.artists || '').trim()
          if (nome) {
            const atual = artistas.get(nome) || { id: `meu-${nome}`, name: nome, count: 0, image: '', genre: '' }
            atual.count += 1
            if (!atual.image && evento.track?.cover_url) atual.image = evento.track.cover_url
            if (!atual.genre && evento.genres?.length) atual.genre = evento.genres[0]
            artistas.set(nome, atual)
          }
          const chaveFaixa = evento.track?.media_id || evento.track?.youtube_id || evento.track?.spotify_id || evento.track?.title
          if (chaveFaixa) {
            const atual = faixas.get(chaveFaixa) || { track: evento.track, count: 0 }
            atual.count += 1
            faixas.set(chaveFaixa, atual)
          }
          for (const genero of evento.genres || []) {
            generos.set(genero, (generos.get(genero) || 0) + 1)
          }
        }

        const meus = [...artistas.values()].sort((a, b) => b.count - a.count).slice(0, 6)
        const tocadas = [...faixas.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((entry) => fromJson(entry.track))
          .filter(Boolean)
        const conhecidos = new Set(meus.map((artista) => artista.name.toLowerCase()))
        const generoTop = [...generos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
        const termo = generoTop || meus[0]?.name || ''

        let novos = []
        try {
          novos = (await descobrirNovos(termo)).filter(
            (artista) => artista?.name && !conhecidos.has(artista.name.toLowerCase())
          )
        } catch {
          novos = []
        }
        if (!novos.length) {
          novos = curatedArtists.filter((artista) => !conhecidos.has(artista.name.toLowerCase()))
        }

        if (!vigente()) return
        setSugestoes({
          meus,
          novos: novos.slice(0, 6),
          tocadas,
          carregando: false,
          aviso: eventos?.length
            ? 'Sugestões a partir do que você tem ouvido no Harmony.'
            : 'Toque algumas músicas e as sugestões passam a usar o seu histórico.',
        })
      } catch {
        if (!vigente()) return
        setSugestoes((current) => ({ ...current, carregando: false }))
      }
    }
    load()
  }, [app.user.id, activePlatform, connections])

  const connectPlatform = async () => {
    try {
      connectYoutube()
      setActivePlatform('youtube')
    } catch (error) {
      alert(error.message)
    }
  }
  const runSearch = async (term) => {
    const clean = (term || '').trim()
    if (!clean) return
    try {
      setBusy(true)
      setResults(await searchYoutubeTracks(clean))
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
  // Card de artista usado nas três grade: em alta, seus e sugeridos.
  const artistCard = (artist, fallback = 'Artista') => (
    <button type="button" className="artist-card" key={artist.id} onClick={() => runSearch(artist.name)}>
      <span className="artist-avatar">
        <CoverArt src={artist.image} alt={`Foto de ${artist.name}`} />
      </span>
      <b title={artist.name}>{artist.name}</b>
      <small>{artist.genre || artist.genres?.[0] || fallback}</small>
    </button>
  )
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
                Ative a música do YouTube e encontre gente
                que vibra na mesma frequência.
              </p>
            </>
          )}
          {!connectedPlatforms.length ? (
            <div className="music-connect">
              <button className="primary" onClick={() => connectPlatform('youtube')} disabled={!youtubeApiKey()}>
                Ativar YouTube Music
              </button>
              {!youtubeApiKey() && <p className="hint">O YouTube Music ainda não foi configurado neste site.</p>}
            </div>
          ) : (
            <div className="music-platforms">
              <span>Conectado ao YouTube Music · <Link to="/configuracoes">Gerenciar plataforma</Link></span>
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
            'Busque músicas e vídeos no YouTube...'
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
            <p className="hint">{results.length} faixas encontradas no YouTube.</p>
            <button type="button" className="secondary small-button" onClick={() => { setResults([]); setQuery('') }}>
              <X /> Limpar busca
            </button>
          </div>
          {results.map((track) => (
            <TrackRow key={track.mediaId || track.youtubeId} track={track} queue={results} />
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
              trending.map((track) => <TrackRow key={track.mediaId || track.youtubeId} track={track} queue={trending} />)
            )}
            {trendPlatform === 'curated' && !trendingError && (
              <p className="hint">
                Ative o YouTube Music na busca acima para ver as paradas atualizadas.
              </p>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Para você</h2>
              <p className="hint">{sugestoes.aviso}</p>
            </div>
            {sugestoes.carregando ? (
              <p className="hint">Montando suas sugestões...</p>
            ) : (
              <>
                {sugestoes.tocadas.length > 0 && (
                  <>
                    <div className="section-head section-subhead">
                      <h3>As músicas que você mais ouve</h3>
                    </div>
                    {sugestoes.tocadas.map((track) => (
                      <TrackRow
                        key={track.mediaId || track.youtubeId || track.title}
                        track={track}
                        queue={sugestoes.tocadas}
                      />
                    ))}
                  </>
                )}
                {sugestoes.meus.length > 0 && (
                  <>
                    <div className="section-head section-subhead">
                      <h3>Seus artistas</h3>
                    </div>
                    <div className="artist-grid">
                      {sugestoes.meus.map((artist) => artistCard(artist, 'Seu favorito'))}
                    </div>
                  </>
                )}
                {sugestoes.novos.length > 0 && (
                  <>
                    <div className="section-head section-subhead">
                      <h3>Artistas novos para você</h3>
                      {!connections[activePlatform] && (
                        <p className="hint">Ative o YouTube Music para descobrir mais gente.</p>
                      )}
                    </div>
                    <div className="artist-grid">
                      {sugestoes.novos.map((artist) => artistCard(artist))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Playlists do Harmony em alta</h2>
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
              {artists.map((artist) => artistCard(artist))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Playlists do Harmony em alta</h2>
            </div>
            <p className="hint">Crie ou publique playlists na sua Biblioteca para vê-las aqui.</p>
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
