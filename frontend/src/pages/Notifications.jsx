import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Heart, MessageCircle, Trash2, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page, Section } from '../components/Media'
import { ProfilePopup } from '../components/ProfilePopup'
import { avisoDeMigracao, tabelaDeAmizadeAusente } from '../utils/friendship'
import { abrirPost } from '../utils/community'

const kinds = {
  post_like: ['curtiu sua publicação.', Heart],
  comment_reply: ['respondeu em uma publicação que você acompanha.', MessageCircle],
  post_mention: ['mencionou você em uma publicação.', MessageCircle],
  comment_mention: ['mencionou você em uma resposta.', MessageCircle],
}

const snippet = (post) => {
  if (post?.content) return post.content
  if (post?.track?.title) return `🎵 ${post.track.title}`
  return 'uma publicação sem texto'
}
const relativeTime = (date) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.round(hours / 24)} d`
}

export function Notifications({ app }) {
  const navigate = useNavigate()
  const userId = app.user?.id
  const notifications = app.mentionNotifications || []
  const [invites, setInvites] = useState([])
  const [senders, setSenders] = useState({})
  const [posts, setPosts] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [popup, setPopup] = useState(null)

  const loadInvites = useCallback(async () => {
    if (!configured || !userId) return
    const { data, error: queryError } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (queryError) {
      setInvites([])
      setError(
        tabelaDeAmizadeAusente(queryError)
          ? avisoDeMigracao
          : `Não foi possível carregar convites: ${queryError.message}`
      )
      return
    }
    const rows = data || []
    setInvites(rows)
    const ids = [...new Set(rows.map((invite) => invite.requester_id))]
    if (!ids.length) return setSenders({})
    const { data: people } = await supabase.from('profiles').select('*').in('id', ids)
    setSenders(Object.fromEntries((people || []).map((profile) => [profile.id, profile])))
  }, [userId])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  // O texto de cada postagem deixa a notificação legível: quem curtiu o quê.
  useEffect(() => {
    if (!configured || !notifications.length) return undefined
    const ids = [...new Set(notifications.map((item) => item.post_id).filter(Boolean))]
    if (!ids.length) return undefined
    let active = true
    supabase
      .from('posts')
      .select('id, content, track, created_at')
      .in('id', ids)
      .then(({ data }) => {
        if (!active || !data) return
        setPosts(Object.fromEntries(data.map((post) => [post.id, post])))
      })
    return () => {
      active = false
    }
  }, [notifications])

  const respondInvite = async (invite, accept) => {
    setBusy(invite.id)
    setError('')
    try {
      if (accept) {
        const { error: updateError } = await supabase
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', invite.id)
          .eq('addressee_id', userId)
        if (updateError) throw updateError
      } else {
        const { error: deleteError } = await supabase
          .from('friendships')
          .delete()
          .eq('id', invite.id)
          .eq('addressee_id', userId)
        if (deleteError) throw deleteError
      }
      await loadInvites()
      if (accept) window.dispatchEvent(new CustomEvent('synq-friends-changed'))
    } catch (err) {
      setError(
        tabelaDeAmizadeAusente(err)
          ? avisoDeMigracao
          : `Não foi possível responder ao convite: ${err.message}`
      )
    } finally {
      setBusy('')
    }
  }

  const markAllAsRead = async () => {
    setBusy('all')
    setError('')
    try {
      for (const item of notifications) {
        await app.markMentionAsRead(item.id)
      }
    } catch (err) {
      setError(`Não foi possível marcar tudo como lido: ${err.message}`)
    } finally {
      setBusy('')
    }
  }
  const removeNotification = async (id) => {
    if (!window.confirm('Excluir esta notificação do seu histórico?')) return
    const { error: deleteError } = await supabase.from('community_notifications').delete().eq('id', id).eq('recipient_id', userId)
    if (deleteError) return setError(`Não foi possível excluir: ${deleteError.message}`)
    window.dispatchEvent(new Event('harmony-notifications-changed'))
  }

  const openPost = (item) => {
    // A página do fórum marca como lida quando a publicação aparece.
    abrirPost(navigate, item.post_id, item.id)
  }

  const actorName = (item) => item.actor?.display_name || 'Alguém'

  return (
    <Page
      title="Notificações"
      subtitle="Curtidas, respostas e convites de amizade em um só lugar."
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <Section title="Convites de amizade">
        {invites.length ? (
          <ul className="invite-list">
            {invites.map((invite) => {
              const sender = senders[invite.requester_id] || null
              return (
                <li key={invite.id} className="invite-item">
                  <button
                    type="button"
                    className="avatar-link"
                    aria-label={`Ver perfil de ${sender?.display_name || 'alguém'}`}
                    onClick={() => sender && setPopup(sender)}
                  >
                    <Avatar profile={sender} />
                  </button>
                  <span>
                    <b>{sender?.display_name || 'Alguém'}</b> quer ser seu amigo.
                    {sender?.username && <small>@{sender.username}</small>}
                  </span>
                  <span className="invite-actions">
                    <button
                      type="button"
                      className="primary small-button"
                      disabled={busy === invite.id}
                      onClick={() => respondInvite(invite, true)}
                    >
                      <Check /> Aceitar
                    </button>
                    <button
                      type="button"
                      className="secondary small-button"
                      disabled={busy === invite.id}
                      onClick={() => respondInvite(invite, false)}
                    >
                      <X /> Recusar
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty text="Nenhum convite de amizade pendente." />
        )}
      </Section>

      <Section title="Avisos">
        <div className="notification-toolbar">
          <button
            type="button"
            className="secondary small-button"
            disabled={busy === 'all' || !notifications.length}
            onClick={markAllAsRead}
          >
            {busy === 'all' ? 'Marcando...' : 'Marcar tudo como lido'}
          </button>
        </div>
        {notifications.length ? (
          <ul className="notification-list">
            {notifications.map((item) => {
              const [text, Icon] = kinds[item.kind] || kinds.post_mention
              const post = posts[item.post_id]
              return (
                <li key={item.id} className={`notification-item ${item.read_at ? 'read' : 'unread'}`}>
                  <button
                    type="button"
                    className="avatar-link"
                    aria-label={`Ver perfil de ${actorName(item)}`}
                    onClick={() => item.actor && setPopup(item.actor)}
                  >
                    <Avatar profile={item.actor} />
                  </button>
                  <button
                    type="button"
                    className={`notification-open ${item.kind === 'post_like' ? 'liked' : ''}`}
                    onClick={() => openPost(item)}
                  >
                    <span>
                      <b>{actorName(item)}</b> {text}
                      <small>{snippet(post)}</small>
                      <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
                    </span>
                    <Icon />
                  </button>
                  <button type="button" className="icon" aria-label="Excluir notificação" onClick={() => removeNotification(item.id)}><Trash2 /></button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty text="Quem curtir ou responder algo seu aparece aqui." />
        )}
      </Section>

      {popup && <ProfilePopup profile={popup} userId={userId} onClose={() => setPopup(null)} />}
    </Page>
  )
}
