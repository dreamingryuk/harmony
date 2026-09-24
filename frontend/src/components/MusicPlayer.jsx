import { useState, useRef, useEffect } from 'react'
import './MusicPlayer.css'

async function fetchTrack() {
  return {
    title: 'Sunset Lover',
    artist: 'Petit Biscuit',
    cover: '/covers/sunset-lover.jpg',
    audioUrl: '/audio/sunset-lover.mp3',
  }
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

export default function MusicPlayer() {
  const audioRef = useRef(null)
  const [track, setTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    fetchTrack().then(setTrack)
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    playing ? audioRef.current.play() : audioRef.current.pause()
  }, [playing, track])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  function togglePlay() {
    setPlaying((p) => !p)
  }

  async function playAnotherTrack() {
    setPlaying(false)
    setProgress(0)
    setTrack(await fetchTrack())
  }

  if (!track) return null

  return (
    <div className="player-bar">
      <audio
        ref={audioRef}
        src={track.audioUrl}
        onTimeUpdate={() => setProgress(audioRef.current.currentTime)}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
        onEnded={() => (repeat ? audioRef.current.play() : setPlaying(false))}
      />

      <div className="player-track">
        <img className="player-cover" src={track.cover} alt={track.title} />
        <div className="player-info">
          <span className="player-title">{track.title}</span>
          <span className="player-artist">{track.artist}</span>
        </div>
        <button className={`icon-btn ${liked ? 'active' : ''}`} onClick={() => setLiked((l) => !l)}>
          <i className={`fas fa-heart`}></i>
        </button>
      </div>

      <div className="player-controls">
        <div className="control-buttons">
          <button
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            onClick={() => setShuffle((s) => !s)}
          >
            <i className="fas fa-random"></i>
          </button>
          <button className="icon-btn" onClick={playAnotherTrack}>
            <i className="fas fa-step-backward"></i>
          </button>
          <button className="play-btn" onClick={togglePlay}>
            <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          <button className="icon-btn" onClick={playAnotherTrack}>
            <i className="fas fa-step-forward"></i>
          </button>
          <button
            className={`icon-btn ${repeat ? 'active' : ''}`}
            onClick={() => setRepeat((r) => !r)}
          >
            <i className="fas fa-redo"></i>
          </button>
        </div>

        <div className="progress-row">
          <span className="time">{formatTime(progress)}</span>
          <input
            type="range"
            className="progress-bar"
            min="0"
            max={duration || 0}
            value={progress}
            onChange={(e) => {
              audioRef.current.currentTime = Number(e.target.value)
              setProgress(Number(e.target.value))
            }}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-extra">
        <span className="icon-btn">
          <i className="fas fa-volume-up"></i>
        </span>
        <input
          type="range"
          className="volume-bar"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
        <button className="icon-btn">
          <i className="fas fa-ellipsis-v"></i>
        </button>
        <button className="icon-btn">
          <i className="fas fa-expand"></i>
        </button>
      </div>
    </div>
  )
}
