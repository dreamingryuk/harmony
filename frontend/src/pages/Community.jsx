import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  Heart,
  LogOut,
  MessageCircle,
  Send,
  Settings,
  Shield,
  ThumbsDown,
  Trash2,
  Users,
} from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page, Section } from '../components/Media'
import { AttachmentCard, PlaylistDialog, SharePicker } from '../components/PlaylistComponents'
import { CommunityEditorDialog } from '../components/CommunityEditor'
import { loadPlaylist } from '../utils/playlist'
import { MentionComposer, MentionText } from '../components/MentionComposer'
import { ProfilePopup } from '../components/ProfilePopup'
import { erroDeComunidade, mensagemDeEntrada, PRIVACIDADES } from '../utils/community'

const POST_QUERY =
  '*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url), post_likes(user_id), post_dislikes(user_id), post_comments(id, author_id, content, created_at, author:profiles!post_comments_author_id_fkey(id, username, display_name, avatar_url))'

// Como o papel de cada membro aparece na lista do fórum.
const PAPEIS = {
  dono: 'Dono',
  admin: 'Admin',
  moderador: 'Moderação',
  membro: 'Membro',
}

// Ícone da comunidade: a imagem enviada ou as iniciais do título.
function CommunityIcon({ community, size = '' }) {
  if (community.icone_url) {
    return (
      <span className={`community-icon ${size}`}>
        <img src={community.icone_url} alt={`Ícone de ${community.nome}`} />
      </span>
    )
  }
  const iniciais = community.nome
    .split(' ')
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return <span className={`community-icon ${size}`}>{iniciais}</span>
}

export function Community({ app }) {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const markingNotifications = useRef(new Set())
  // undefined = carregando, null = fórum inexistente.
  const [community, setCommunity] = useState(undefined)
  const [posts, setPosts] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [isMember, setIsMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [myRequest, setMyRequest] = useState(false)
  const [requests, setRequests] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(''),
    [publishing, setPublishing] = useState(false),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null),
    [profiles, setProfiles] = useState([]),
    [openReplies, setOpenReplies] = useState(new Set()),
    [replyDrafts, setReplyDrafts] = useState({}),
    [profilePopup, setProfilePopup] = useState(null),
    [senha, setSenha] = useState('')

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }
    const { data: comunidade, error: comunidadeError } = await supabase
      .from('comunidades')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (comunidadeError) {
      setError(erroDeComunidade(comunidadeError, 'Não foi possível abrir a comunidade'))
      setLoading(false)
      return
    }
    if (!comunidade) {
      setCommunity(null)
      setLoading(false)
      return
    }

    const [membro, contagem, pedido, pedidos, lista, feed] = await Promise.all([
      supabase
        .from('comunidade_membros')
        .select('papel')
        .eq('comunidade_id', comunidade.id)
        .eq('usuario_id', app.user.id)
        .maybeSingle(),
      supabase
        .from('comunidade_membros')
        .select('usuario_id', { count: 'exact', head: true })
        .eq('comunidade_id', comunidade.id),
      supabase
        .from('comunidade_pedidos')
        .select('status')
        .eq('comunidade_id', comunidade.id)
        .eq('usuario_id', app.user.id)
        .eq('status', 'pendente')
        .maybeSingle(),
      supabase
        .from('comunidade_pedidos')
        .select('usuario_id, criado_em, usuario:profiles(username, display_name, avatar_url)')
        .eq('comunidade_id', comunidade.id)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true }),
      // Lista de membros: o dono precisa dela para remover alguém do fórum.
      supabase
        .from('comunidade_membros')
        .select(
          'usuario_id, papel, entrou_em, usuario:profiles(username, display_name, avatar_url)'
        )
        .eq('comunidade_id', comunidade.id)
        .order('entrou_em', { ascending: true }),
      // O RLS devolve só os posts dos fóruns em que a pessoa é membro.
      supabase
        .from('posts')
        .select(POST_QUERY)
        .eq('comunidade_id', comunidade.id)
        .order('created_at', { ascending: false })
        .order('created_at', { foreignTable: 'post_comments', ascending: true }),
    ])

    setCommunity(comunidade)
    const membroProprio = membro.data || comunidade.dono_id === app.user.id
    setIsMember(Boolean(membroProprio))
    setIsOwner(comunidade.dono_id === app.user.id)
    setMemberCount(contagem.count ?? 0)
    setMyRequest(Boolean(pedido.data))
    setRequests(comunidade.dono_id === app.user.id ? pedidos.data || [] : [])
    setMembers(lista.data || [])

    const falha =
      membro.error ||
      contagem.error ||
      pedido.error ||
      pedidos.error ||
      lista.error ||
      feed.error ||
      comunidadeError
    if (falha) {
      setError(erroDeComunidade(falha, 'Não foi possível carregar a comunidade'))
      setLoading(false)
      return
    }
    setError('')
    setPosts(feed.data || [])
    setLoading(false)
  }, [slug, app.user.id])

  useEffect(() => {
    load()
  }, [load])

  // O feed atualiza sozinho quando alguém publica ou reage no fórum.
  useEffect(() => {
    if (!configured || !isMember || !community) return undefined
    const channel = supabase
      .channel(`synq-posts-${community.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `comunidade_id=eq.${community.id}`,
        },
        load
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_dislikes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, isMember, community])

  useEffect(() => {
    const syncProfile = (event) => {
      const updated = event.detail
      if (updated?.id !== app.user.id) return
      setPosts((current) =>
        current.map((post) =>
          post.author_id === updated.id ? { ...post, author: { ...post.author, ...updated } } : post
        )
      )
    }
    window.addEventListener('synq-profile-updated', syncProfile)
    return () => window.removeEventListener('synq-profile-updated', syncProfile)
  }, [app.user.id])

  useEffect(() => {
    if (!configured) return
    supabase
      .from('playlists')
      .select('*, playlist_tracks(*)')
      .eq('owner_id', app.user.id)
      .eq('is_public', true)
      .then(({ data }) => setPlaylists(data || []))
  }, [app.user.id])

  // Menções precisam conhecer os apelidos públicos para renderizar e compor.
  useEffect(() => {
    if (!configured) return
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .then(({ data }) => setProfiles(data || []))
  }, [])

  useEffect(() => {
    if (!isMember) return undefined
    const notificationId = new URLSearchParams(location.search).get('notificacao')
    const notifications = app.mentionNotifications || []
    const selectedNotification = notifications.find((item) => item.id === notificationId)
    if (selectedNotification?.comment_id && !openReplies.has(selectedNotification.post_id)) {
      setOpenReplies((current) => new Set(current).add(selectedNotification.post_id))
    }
    // Quem abriu o link da notificação já leu o aviso: marca na hora, mesmo
    // que o post ainda não tenha aparecido na tela.
    if (
      selectedNotification &&
      !selectedNotification.read_at &&
      !markingNotifications.current.has(selectedNotification.id)
    ) {
      markingNotifications.current.add(selectedNotification.id)
      app
        .markMentionAsRead(selectedNotification.id)
        .then(() => navigate(location.pathname, { replace: true }))
        .catch((readError) => {
          markingNotifications.current.delete(selectedNotification.id)
          setError(readError.message)
        })
    }
    // Um post mais alto que a tela nunca chega a 35% de visibilidade: o aviso
    // também conta como visto quando o post cobre boa parte da janela.
    const postVisivel = (entry) =>
      entry.intersectionRatio >= 0.35 ||
      entry.intersectionRect.height >= window.innerHeight * 0.6
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !postVisivel(entry)) continue
          const notification = notifications.find((item) => {
            const targetId = item.comment_id ? `comment-${item.comment_id}` : `post-${item.post_id}`
            return targetId === entry.target.id
          })
          if (!notification || markingNotifications.current.has(notification.id)) continue
          markingNotifications.current.add(notification.id)
          observer.unobserve(entry.target)
          app
            .markMentionAsRead(notification.id)
            .then(() => {
              if (notification.id === notificationId) navigate(location.pathname, { replace: true })
            })
            .catch((readError) => {
              markingNotifications.current.delete(notification.id)
              setError(readError.message)
            })
        }
      },
      { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] }
    )
    for (const notification of notifications) {
      const targetId = notification.comment_id
        ? `comment-${notification.comment_id}`
        : `post-${notification.post_id}`
      const target = document.getElementById(targetId)
      if (!target) continue
      observer.observe(target)
      if (notification.id === notificationId) {
        requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
    }
    return () => observer.disconnect()
  }, [
    app.mentionNotifications,
    app.markMentionAsRead,
    isMember,
    location.pathname,
    location.search,
    navigate,
    openReplies,
    posts,
  ])

  const publish = async (event) => {
    event.preventDefault()
    if (!content.trim() && !attachment) return
    if (!configured) return setError('Configure o Supabase para publicar na comunidade.')
    try {
      setPublishing(true)
      const { error: insertError } = await supabase.from('posts').insert({
        author_id: app.user.id,
        content: content.trim(),
        track: attachment,
        comunidade_id: community.id,
      })
      if (insertError) throw insertError
      setContent('')
      setAttachment(null)
      await load()
    } catch (publishError) {
      setError(erroDeComunidade(publishError, 'Não foi possível publicar'))
    } finally {
      setPublishing(false)
    }
  }

  const react = async (post, reaction) => {
    const currentTable = reaction === 'like' ? 'post_likes' : 'post_dislikes'
    const oppositeTable = reaction === 'like' ? 'post_dislikes' : 'post_likes'
    const currentReactions = reaction === 'like' ? post.post_likes : post.post_dislikes
    const exists = currentReactions?.some((item) => item.user_id === app.user.id)
    try {
      if (exists) {
        const { error } = await supabase
          .from(currentTable)
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', app.user.id)
        if (error) throw error
      } else {
        const { error: oppositeError } = await supabase
          .from(oppositeTable)
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', app.user.id)
        if (oppositeError) throw oppositeError
        const { error } = await supabase
          .from(currentTable)
          .insert({ post_id: post.id, user_id: app.user.id })
        if (error) throw error
      }
      await load()
    } catch (reactionError) {
      setError(`Não foi possível atualizar a reação: ${reactionError.message}`)
    }
  }

  const submitReply = async (event, post) => {
    event.preventDefault()
    const reply = (replyDrafts[post.id] || '').trim()
    if (!reply) return
    try {
      const { error: insertError } = await supabase.from('post_comments').insert({
        post_id: post.id,
        author_id: app.user.id,
        content: reply,
      })
      if (insertError) throw insertError
      setReplyDrafts((current) => ({ ...current, [post.id]: '' }))
      await load()
    } catch (replyError) {
      setError(erroDeComunidade(replyError, 'Não foi possível responder à postagem'))
    }
  }

  const toggleReplies = (postId) => {
    setOpenReplies((current) => {
      const next = new Set(current)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  const openPlaylist = async (id) => {
    if (!id) return
    const data = await loadPlaylist(id)
    if (!data) return setError('Esta playlist não está mais pública ou foi removida.')
    setOpenedPlaylist(data)
  }

  const SUCESSO = ['ok', 'pendente', 'aceito', 'recusado']
  const acaoDeEntrada = async (rota, params, mensagemDeFalha) => {
    setBusy(rota)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc(rota, params)
      if (rpcError) throw rpcError
      if (SUCESSO.includes(data)) {
        await load()
        return data
      }
      setError(mensagemDeEntrada(data))
      return data
    } catch (actionError) {
      setError(erroDeComunidade(actionError, mensagemDeFalha))
      return null
    } finally {
      setBusy('')
    }
  }

  const entrar = (event) => {
    event?.preventDefault()
    return acaoDeEntrada(
      'entrar_comunidade',
      { p_slug: slug, p_senha: senha || null },
      'Não foi possível entrar'
    )
  }

  const pedir = () =>
    acaoDeEntrada('pedir_entrar_comunidade', { p_slug: slug }, 'Não foi possível pedir entrada')

  const sair = () =>
    acaoDeEntrada('sair_comunidade', { p_slug: slug }, 'Não foi possível sair da comunidade')

  const responderPedido = (pedido, aceitar) =>
    acaoDeEntrada(
      'responder_pedido',
      { p_slug: slug, p_usuario_id: pedido.usuario_id, p_aceitar: aceitar },
      'Não foi possível responder ao pedido'
    )

  // Ações do dono: todas passam pelas funções SECURITY DEFINER do banco,
  // que conferem se quem chamou é o dono do fórum.
  const removerMembro = (membro) => {
    const nome = membro.usuario?.display_name || 'esta pessoa'
    if (!window.confirm(`Remover ${nome} da comunidade?`)) return null
    return acaoDeEntrada(
      'remover_membro_comunidade',
      { p_slug: slug, p_usuario_id: membro.usuario_id },
      'Não foi possível remover o membro'
    )
  }

  const apagarPost = (post) => {
    if (!window.confirm('Apagar esta publicação do fórum?')) return null
    return acaoDeEntrada(
      'apagar_post_comunidade',
      { p_slug: slug, p_post_id: post.id },
      'Não foi possível apagar a publicação'
    )
  }

  if (loading) {
    return (
      <Page title="Comunidades" subtitle="Abrindo o fórum...">
        <p className="hint">Carregando comunidade...</p>
      </Page>
    )
  }

  if (!community) {
    return (
      <Page
        title="Comunidade não encontrada"
        subtitle="Este fórum não existe, foi removido ou ainda não foi liberado."
      >
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Empty text="Não encontramos esta comunidade." />
        <p>
          <Link className="text-button" to="/comunidades">
            Ver todas as comunidades
          </Link>
        </p>
      </Page>
    )
  }

  const info = PRIVACIDADES[community.visibilidade] || PRIVACIDADES.publica

  return (
    <Page
      title={community.nome}
      subtitle={`${info.rotulo} · ${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}`}
    >
      <p className="community-back">
        <Link className="text-button" to="/comunidades">
          ← Todas as comunidades
        </Link>
      </p>
      <div className="community-hero">
        <div
          className="community-hero-banner"
          style={
            community.banner_url ? { backgroundImage: `url(${community.banner_url})` } : undefined
          }
        />
        <div className="community-hero-body">
          <CommunityIcon community={community} size="big" />
          <div className="community-hero-copy">
            <p>{community.descricao || 'Esta comunidade ainda não tem descrição.'}</p>
            <span className="community-meta">
              <span className={`privacy-badge privacy-${community.visibilidade}`}>
                <info.icone size={13} /> {info.rotulo}
              </span>
              <span>
                <Users size={13} /> {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
              </span>
              {isOwner && (
                <span className="community-role">
                  <Shield size={13} /> Você é o dono
                </span>
              )}
            </span>
          </div>
          <div className="community-hero-actions">
            {isMember && !isOwner && (
              <button
                type="button"
                className="secondary"
                disabled={busy === 'sair_comunidade'}
                onClick={sair}
              >
                <LogOut /> Sair
              </button>
            )}
            {isOwner && (
              <button type="button" className="secondary" onClick={() => setEditing(true)}>
                <Settings /> Configurar
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!isMember ? (
        <section className="community-gate">
          <h2>Entrar em {community.nome}</h2>
          <p className="hint">{info.resumo}</p>
          {community.visibilidade === 'privada' && (
            <form onSubmit={entrar}>
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Senha da comunidade"
                required
                aria-label="Senha da comunidade"
              />
              <button type="submit" className="primary" disabled={busy === 'entrar_comunidade'}>
                {busy === 'entrar_comunidade' ? 'Entrando...' : 'Entrar com senha'}
              </button>
            </form>
          )}
          {community.visibilidade === 'publica' && (
            <button
              type="button"
              className="primary"
              disabled={busy === 'entrar_comunidade'}
              onClick={entrar}
            >
              {busy === 'entrar_comunidade' ? 'Entrando...' : 'Entrar agora'}
            </button>
          )}
          {community.visibilidade === 'por_convite' &&
            (myRequest ? (
              <p className="playlist-status">
                <Check /> Pedido enviado: o dono ainda não respondeu.
              </p>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={busy === 'pedir_entrar_comunidade'}
                onClick={pedir}
              >
                {busy === 'pedir_entrar_comunidade' ? 'Enviando...' : 'Pedir para entrar'}
              </button>
            ))}
        </section>
      ) : (
        <>
          {isOwner && community.visibilidade === 'por_convite' && requests.length > 0 && (
            <Section title={`Pedidos de entrada (${requests.length})`}>
              <ul className="invite-list">
                {requests.map((pedido) => (
                  <li className="invite-item" key={pedido.usuario_id}>
                    <Avatar profile={pedido.usuario} />
                    <span>
                      <b>{pedido.usuario?.display_name || 'Ouvinte Harmony'}</b>
                      <small>
                        @{pedido.usuario?.username} ·{' '}
                        {new Date(pedido.criado_em).toLocaleString('pt-BR')}
                      </small>
                    </span>
                    <span className="invite-actions">
                      <button
                        type="button"
                        className="primary small-button"
                        disabled={Boolean(busy)}
                        onClick={() => responderPedido(pedido, true)}
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        className="secondary small-button"
                        disabled={Boolean(busy)}
                        onClick={() => responderPedido(pedido, false)}
                      >
                        Recusar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title={`Membros (${members.length || memberCount})`}>
            {members.length ? (
              <ul className="invite-list">
                {members.map((membro) => (
                  <li className="invite-item" key={membro.usuario_id}>
                    <button
                      type="button"
                      className="avatar-link"
                      aria-label={`Ver perfil de ${membro.usuario?.display_name || 'Ouvinte Harmony'}`}
                      onClick={() => membro.usuario && setProfilePopup(membro.usuario)}
                    >
                      <Avatar profile={membro.usuario} />
                    </button>
                    <span>
                      <b>{membro.usuario?.display_name || 'Ouvinte Harmony'}</b>
                      <small>
                        @{membro.usuario?.username || 'ouvinte'} ·{' '}
                        {PAPEIS[membro.papel] || PAPEIS.membro}
                      </small>
                    </span>
                    {isOwner && membro.usuario_id !== app.user.id && (
                      <span className="invite-actions">
                        <button
                          type="button"
                          className="secondary small-button"
                          disabled={Boolean(busy)}
                          onClick={() => removerMembro(membro)}
                        >
                          <Trash2 size={14} /> Remover
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Nenhum membro nesta comunidade." />
            )}
          </Section>
          <form className="composer" onSubmit={publish}>
            <Avatar profile={app.profile} />
            <MentionComposer
              className="community-composer-input"
              value={content}
              profiles={profiles}
              onChange={setContent}
              onSubmit={() => publish({ preventDefault() {} })}
              rows={3}
              disabled={publishing}
              placeholder={`Publique em ${community.nome}. Digite @ para mencionar`}
            />
            <SharePicker
              playlists={playlists}
              attachment={attachment}
              onChange={setAttachment}
              userId={app.user.id}
            />
            <button className="primary" disabled={publishing}>
              <Send /> Publicar
            </button>
          </form>
          <Section title="Feed">
            {posts.length ? (
              posts.map((post) => (
                <article className="post" id={`post-${post.id}`} key={post.id}>
                  <button
                    type="button"
                    className="avatar-link"
                    aria-label={`Ver perfil de ${post.author?.display_name || 'Ouvinte Harmony'}`}
                    onClick={() => setProfilePopup(post.author)}
                  >
                    <Avatar profile={post.author} />
                  </button>
                  <div>
                    <button
                      type="button"
                      className="name-link"
                      onClick={() => setProfilePopup(post.author)}
                    >
                      <b>{post.author?.display_name || 'Ouvinte Harmony'}</b>
                    </button>
                    <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
                    {post.content?.trim() && (
                      <p>
                        <MentionText text={post.content} profiles={profiles} />
                      </p>
                    )}
                    {post.track && (
                      <AttachmentCard attachment={post.track} onOpenPlaylist={openPlaylist} />
                    )}
                    <div className="post-actions">
                      <button
                        type="button"
                        className={`like ${post.post_likes?.some((x) => x.user_id === app.user.id) ? 'liked' : ''}`}
                        aria-label="Curtir postagem"
                        aria-pressed={
                          post.post_likes?.some((x) => x.user_id === app.user.id) || false
                        }
                        onClick={() => react(post, 'like')}
                      >
                        <Heart
                          fill={
                            post.post_likes?.some((x) => x.user_id === app.user.id)
                              ? 'currentColor'
                              : 'none'
                          }
                        />
                        {post.post_likes?.length || 0}
                      </button>
                      <button
                        type="button"
                        className={`like dislike ${post.post_dislikes?.some((x) => x.user_id === app.user.id) ? 'disliked' : ''}`}
                        aria-label="Não curtir postagem"
                        aria-pressed={
                          post.post_dislikes?.some((x) => x.user_id === app.user.id) || false
                        }
                        onClick={() => react(post, 'dislike')}
                      >
                        <ThumbsDown />
                        {post.post_dislikes?.length || 0}
                      </button>
                      <button
                        type="button"
                        className="like reply-toggle"
                        aria-expanded={openReplies.has(post.id)}
                        onClick={() => toggleReplies(post.id)}
                      >
                        <MessageCircle />
                        {post.post_comments?.length || 0} Responder
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          className="like post-delete"
                          disabled={busy === 'apagar_post_comunidade'}
                          onClick={() => apagarPost(post)}
                        >
                          <Trash2 /> Apagar
                        </button>
                      )}
                    </div>
                    {openReplies.has(post.id) && (
                      <div className="post-replies">
                        {post.post_comments?.map((comment) => (
                          <article
                            className="post-reply"
                            id={`comment-${comment.id}`}
                            key={comment.id}
                          >
                            <button
                              type="button"
                              className="avatar-link"
                              aria-label={`Ver perfil de ${comment.author?.display_name || 'Ouvinte Harmony'}`}
                              onClick={() => setProfilePopup(comment.author)}
                            >
                              <Avatar profile={comment.author} />
                            </button>
                            <div>
                              <button
                                type="button"
                                className="name-link"
                                onClick={() => setProfilePopup(comment.author)}
                              >
                                <b>{comment.author?.display_name || 'Ouvinte Harmony'}</b>
                              </button>
                              {comment.author?.username && (
                                <small>@{comment.author.username}</small>
                              )}
                              <p>
                                <MentionText text={comment.content} profiles={profiles} />
                              </p>
                            </div>
                          </article>
                        ))}
                        <form
                          className="reply-composer"
                          onSubmit={(event) => submitReply(event, post)}
                        >
                          <MentionComposer
                            value={replyDrafts[post.id] || ''}
                            profiles={profiles}
                            onChange={(value) =>
                              setReplyDrafts((current) => ({ ...current, [post.id]: value }))
                            }
                            onSubmit={() => submitReply({ preventDefault() {} }, post)}
                            placeholder="Escreva uma resposta... Use @ para mencionar"
                            rows={2}
                            required
                          />
                          <button type="submit" className="primary">
                            <Send /> Responder
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <Empty text="Ainda não há posts neste fórum. Seja a primeira voz da comunidade." />
            )}
          </Section>
        </>
      )}

      {editing && (
        <CommunityEditorDialog
          app={app}
          community={community}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
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
      {profilePopup && (
        <ProfilePopup
          profile={profilePopup}
          userId={app.user.id}
          onClose={() => setProfilePopup(null)}
        />
      )}
      {/*
        A menção marcada como lida tira o ?notificacao da URL; o restante das
        notificações fica na lista de comunidades.
      */}
      {app.mentionNotificationError && (
        <p className="form-error" role="alert">
          {app.mentionNotificationError}
        </p>
      )}
    </Page>
  )
}
