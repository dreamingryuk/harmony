import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2 } from 'lucide-react'
import { finishSpotifyConnection } from '../lib/spotify'

export function SpotifyCallback() {
  const navigate = useNavigate(),
    [message, setMessage] = useState('Conectando ao Spotify...')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) return setMessage('Conexão cancelada.')
    finishSpotifyConnection(params.get('code'), params.get('state'))
      .then(() => {
        setMessage('Spotify conectado! Redirecionando...')
        setTimeout(() => navigate('/biblioteca'), 600)
      })
      .catch((error) => setMessage(error.message))
  }, [navigate])
  return (
    <main className="callback">
      <Music2 />
      <h1>{message}</h1>
    </main>
  )
}
