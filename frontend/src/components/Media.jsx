import { useEffect, useRef, useState } from 'react'
import { Heart, Play } from 'lucide-react'
import { FALLBACK_COVER } from '../lib/spotify'
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

export function MarqueeText({ text, subtitle, ariaLabel, className = '' }) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const shouldAnimate = element.scrollWidth > element.clientWidth + 3
    setActive(shouldAnimate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [text, subtitle])

  return (
    <div className={`marquee-wrap ${className}`} aria-label={ariaLabel || text} title={ariaLabel || text}>
      <div ref={ref} className={`marquee-text ${active ? 'is-active' : ''}`}>
        <span>{text}</span>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  )
}

export function TrackRow({ track, saved, onToggleSave, queue }) {
  return (
    <article className="track-row">
      <CoverArt src={track.coverUrl} alt={`Capa de ${track.album}`} />
      <button className="track-copy" onClick={() => play(track, queue)}>
        <MarqueeText text={track.title} ariaLabel={track.title} />
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
