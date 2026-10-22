import { useEffect, useRef, useState } from 'react'
import { loadYoutubePlayerApi } from '../lib/youtube'

export function YouTubePlayer({ videoId, onReady, onStateChange, onProgress, onError, onApiUnavailable }) {
  const containerRef = useRef(null)
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const callbacksRef = useRef({ onReady, onStateChange, onProgress, onError, onApiUnavailable })
  callbacksRef.current = { onReady, onStateChange, onProgress, onError, onApiUnavailable }

  useEffect(() => {
    let active = true
    let player
    let progressTimer

    loadYoutubePlayerApi()
      .then((youtube) => {
        if (!active || !containerRef.current) return
        player = new youtube.Player(containerRef.current, {
          width: '200',
          height: '200',
          videoId,
          playerVars: { playsinline: 1, origin: window.location.origin },
          events: {
            onReady: (event) => callbacksRef.current.onReady?.(event.target),
            onStateChange: (event) => callbacksRef.current.onStateChange?.(event.data),
            onError: (event) => callbacksRef.current.onError?.(event.data),
          },
        })
        progressTimer = window.setInterval(() => {
          if (!player?.getCurrentTime || !player?.getDuration) return
          callbacksRef.current.onProgress?.(player.getCurrentTime(), player.getDuration())
        }, 500)
      })
      .catch((error) => {
        if (!active) return
        setApiUnavailable(true)
        callbacksRef.current.onApiUnavailable?.(true)
        callbacksRef.current.onError?.(error.message)
      })

    return () => {
      active = false
      window.clearInterval(progressTimer)
      player?.destroy()
    }
  }, [videoId])

  if (apiUnavailable) {
    return (
      <iframe
        className="youtube-player-fallback"
        title="Player do YouTube"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0`}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return <div className="youtube-player-frame" ref={containerRef} aria-label="Player do YouTube" />
}
