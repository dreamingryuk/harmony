import { useCallback, useEffect, useState } from 'react'
import { Hourglass, UserCheck, UserPlus, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar } from './Media'
import { bannerStyle } from '../utils/profile'
import { avisoDeMigracao, tabelaDeAmizadeAusente } from '../utils/friendship'

// Perfil público de outra pessoa em uma janela rápida.
// Recebe o perfil que já está na tela e completa o restante pelo banco.
export function ProfilePopup({ profile, onClose, userId }) {
  const [dados, setDados] = useState(profile || null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [amizade, setAmizade] = useState(null)
  const [amizadeCarregando, setAmizadeCarregando] = useState(false)
  const [amizadeBusy, setAmizadeBusy] = useState(false)
  const [amizadeErro, setAmizadeErro] = useState('')

  const outroId = profile?.id
  const proprioPerfil = Boolean(userId && outroId === userId)

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

  // Convite pendente, amizade aceita ou nada entre os dois.
  const carregarAmizade = useCallback(async () => {
    if (!configured || !userId || !outroId || userId === outroId) return
    setAmizadeCarregando(true)
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${outroId}),and(requester_id.eq.${outroId},addressee_id.eq.${userId})`
        )
        .maybeSingle()
      if (error) throw error
      setAmizade(data)
      setAmizadeErro('')
    } catch (error) {
      setAmizade(null)
      setAmizadeErro(
        tabelaDeAmizadeAusente(error)
          ? avisoDeMigracao
          : 'Não foi possível verificar a amizade com este perfil.'
      )
    } finally {
      setAmizadeCarregando(false)
    }
  }, [userId, outroId])

  // Trocar de perfil não pode deixar o botão do perfil anterior na tela.
  useEffect(() => {
    setAmizade(null)
    setAmizadeErro('')
  }, [outroId])

  useEffect(() => {
    carregarAmizade()
  }, [carregarAmizade])

  const enviarConvite = async () => {
    setAmizadeBusy(true)
    setAmizadeErro('')
    try {
      const { data, error } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: outroId, status: 'pending' })
        .select('id, requester_id, addressee_id, status')
        .single()
      if (error) {
        // Outra aba pode ter enviado o mesmo convite nesse meio tempo.
        if (error.code === '23505') {
          await carregarAmizade()
          return
        }
        throw error
      }
      setAmizade(data)
    } catch (error) {
      setAmizadeErro(
        tabelaDeAmizadeAusente(error)
          ? avisoDeMigracao
          : `Não foi possível enviar a solicitação: ${error.message}`
      )
    } finally {
      setAmizadeBusy(false)
    }
  }

  // Cancelar um convite enviado e desfazer uma amizade é a mesma ação:
  // apagar a linha. Quem participa do par pode remover (regra do banco).
  const removerVinculo = async () => {
    if (!amizade?.id) return
    setAmizadeBusy(true)
    setAmizadeErro('')
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', amizade.id)
      if (error) throw error
      setAmizade(null)
    } catch (error) {
      setAmizadeErro(`Não foi possível atualizar a amizade: ${error.message}`)
    } finally {
      setAmizadeBusy(false)
    }
  }

  const aceitarConvite = async () => {
    if (!amizade?.id) return
    setAmizadeBusy(true)
    setAmizadeErro('')
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', amizade.id)
        .eq('addressee_id', userId)
      if (error) throw error
      setAmizade((current) => (current ? { ...current, status: 'accepted' } : current))
    } catch (error) {
      setAmizadeErro(`Não foi possível aceitar a solicitação: ${error.message}`)
    } finally {
      setAmizadeBusy(false)
    }
  }

  useEffect(() => {
    const fechar = (evento) => {
      if (evento.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [onClose])

  if (!dados) return null

  const pendenteEnviado = amizade?.status === 'pending' && amizade.requester_id === userId
  const pendenteRecebido = amizade?.status === 'pending' && amizade.requester_id !== userId
  const jaSaoAmigos = amizade?.status === 'accepted'

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
          {!proprioPerfil && userId && (
            <div className="profile-popup-actions">
              {amizadeErro && <p className="form-error" role="alert">{amizadeErro}</p>}
              {amizadeCarregando && <p className="hint">Verificando amizade...</p>}
              {!amizadeCarregando && !amizade && (
                <button type="button" className="primary small-button" onClick={enviarConvite} disabled={amizadeBusy}>
                  <UserPlus /> {amizadeBusy ? 'Enviando...' : 'Adicionar amigo'}
                </button>
              )}
              {!amizadeCarregando && pendenteEnviado && (
                <button
                  type="button"
                  className="secondary small-button"
                  onClick={removerVinculo}
                  disabled={amizadeBusy}
                  title="Cancelar a solicitação enviada"
                >
                  <Hourglass /> {amizadeBusy ? 'Atualizando...' : 'Pendente'}
                </button>
              )}
              {!amizadeCarregando && pendenteRecebido && (
                <button
                  type="button"
                  className="primary small-button"
                  onClick={aceitarConvite}
                  disabled={amizadeBusy}
                >
                  <UserCheck /> {amizadeBusy ? 'Aceitando...' : 'Aceitar amizade'}
                </button>
              )}
              {!amizadeCarregando && jaSaoAmigos && (
                <button
                  type="button"
                  className="secondary small-button"
                  onClick={removerVinculo}
                  disabled={amizadeBusy}
                  title="Remover amizade"
                >
                  <UserCheck /> {amizadeBusy ? 'Atualizando...' : 'Amigo'}
                </button>
              )}
            </div>
          )}
          {carregando && <p className="hint">Carregando perfil...</p>}
          {erro && <p className="form-error" role="alert">{erro}</p>}
        </div>
      </section>
    </div>
  )
}
