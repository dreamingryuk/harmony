import { useEffect, useState } from 'react'
import { Heart, Music2, Play } from 'lucide-react'
import { saveToSpotify, FALLBACK_COVER } from '../lib/spotify'
import { play } from '../utils/track'

const initials = (name = 'S') =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export function CoverArt({ src, alt = '', className }) {
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

export function Avatar({ profile, className = '' }) {
  const [fotoQuebrada, setFotoQuebrada] = useState(false)
  const foto = profile?.avatar_url
  // Uma foto que não carrega volta ao estado normal quando o perfil muda.
  useEffect(() => setFotoQuebrada(false), [foto])
  if (foto && !fotoQuebrada) {
    return (
      <span className={`avatar avatar-image ${className}`}>
        {initials(profile.display_name)}
        <img
          src={foto}
          alt={`Foto de ${profile.display_name || 'usuário'}`}
          onError={() => setFotoQuebrada(true)}
        />
      </span>
    )
  }
  return <span className={`avatar ${className}`}>{initials(profile?.display_name)}</span>
}

export function TrackRow({ track, saved, onToggleSave, queue }) {
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
      <button className="track-copy" onClick={() => play(track, queue)}>
        <b>{track.title}</b>
        <span>
          {track.artists} · {track.album}
        </span>
      </button>
      <button className="icon" onClick={() => play(track, queue)}>
        <Play />
      </button>
      {onToggleSave && (
        <button className={`icon ${saved ? 'liked' : ''}`} onClick={() => onToggleSave(track)}>
          <Heart fill={saved ? 'currentColor' : 'none'} />
        </button>
      )}
      {track.platform !== 'youtube' && (
        <button disabled={saving} className="icon spotify" onClick={spotifySave} aria-label="Salvar no Spotify">
          <Music2 />
        </button>
      )}
    </article>
  )
}

export function Page({ title, subtitle, children }) {
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

export function Section({ title, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Empty({ text }) {
  return (
    <div className="empty">
      <Music2 />
      <p>{text}</p>
    </div>
  )
}
