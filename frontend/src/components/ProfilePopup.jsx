import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar } from './Media'
import { bannerStyle } from '../utils/profile'

// Perfil público de outra pessoa em uma janela rápida.
// Recebe o perfil que já está na tela e completa o restante pelo banco.
export function ProfilePopup({ profile, onClose }) {
  const [dados, setDados] = useState(profile || null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!configured || !profile?.id) return undefined
    let ativo = true
    setCarregando(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        setCarregando(false)
        if (error) return setErro('Não foi possível carregar o perfil completo.')
        if (data) setDados(data)
      })
      .catch(() => {
        if (!ativo) return
        setCarregando(false)
        setErro('Não foi possível carregar o perfil completo.')
      })
    return () => {
      ativo = false
    }
  }, [profile?.id])

  useEffect(() => {
    const fechar = (evento) => {
      if (evento.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [onClose])

  if (!dados) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section
        className="modal profile-popup"
        role="dialog"
        aria-modal="true"
        aria-label={`Perfil de ${dados.display_name || 'usuário'}`}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <button type="button" className="icon profile-popup-close" aria-label="Fechar perfil" onClick={() => onClose?.()}>
          <X />
        </button>
        <div className="profile-banner" style={bannerStyle(dados)} />
        <div className="profile-popup-body">
          <Avatar profile={dados} className="big" />
          <h2>{dados.display_name || 'Ouvinte Harmony'}</h2>
          {dados.username && <p className="profile-handle">@{dados.username}</p>}
          <p className="profile-bio">{dados.bio || 'Sem bio por enquanto.'}</p>
          {dados.favorite_genres?.length > 0 && (
            <ul className="genre-tags">
              {dados.favorite_genres.map((genero) => (
                <li key={genero}>{genero}</li>
              ))}
            </ul>
          )}
          {carregando && <p className="hint">Carregando perfil...</p>}
          {erro && <p className="form-error" role="alert">{erro}</p>}
        </div>
      </section>
    </div>
  )
}
