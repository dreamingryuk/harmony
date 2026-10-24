import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Heart, MessageCircle, Send, ThumbsDown } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page, Section } from '../components/Media'
import { AttachmentCard, PlaylistDialog, SharePicker } from '../components/PlaylistComponents'
import { loadPlaylist } from '../utils/playlist'
import { MentionComposer, MentionText } from '../components/MentionComposer'

export function Community({ app }) {
  const location = useLocation()
  const navigate = useNavigate()
  const markingNotifications = useRef(new Set())
  const [posts, setPosts] = useState([]),
    [content, setContent] = useState(''),
    [error, setError] = useState(''),
    [publishing, setPublishing] = useState(false),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null),
    [profiles, setProfiles] = useState([]),
    [openReplies, setOpenReplies] = useState(new Set()),
    [replyDrafts, setReplyDrafts] = useState({})
  const load = useCallback(async () => {
    if (!configured) return
    const { data, error: queryError } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url), post_likes(user_id), post_dislikes(user_id), post_comments(id, author_id, content, created_at, author:profiles!post_comments_author_id_fkey(id, username, display_name, avatar_url))')
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'post_comments', ascending: true })
    if (queryError) {
      setError(`Não foi possível carregar o feed: ${queryError.message}`)
      return
    }
    setError('')
    setPosts(data || [])
  }, [])
  useEffect(() => {
    load()
    if (!configured) return
    const channel = supabase
      .channel('synq-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_dislikes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])
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
    supabase.from('playlists').select('*, playlist_tracks(*)').eq('owner_id', app.user.id).eq('is_public', true).then(({ data }) => setPlaylists(data || []))
  }, [app.user.id])
  useEffect(() => {
    if (!configured) return
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .then(({ data, error: profileError }) => {
        if (profileError) {
          setError(`Não foi possível carregar pessoas para mencionar: ${profileError.message}`)
          return
        }
        setProfiles(data || [])
      })
  }, [])
  useEffect(() => {
    const notificationId = new URLSearchParams(location.search).get('notificacao')
    const notifications = app.mentionNotifications || []
    const selectedNotification = notifications.find((item) => item.id === notificationId)
    if (selectedNotification?.comment_id && !openReplies.has(selectedNotification.post_id)) {
      setOpenReplies((current) => new Set(current).add(selectedNotification.post_id))
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue
          const notification = notifications.find((item) => {
            const targetId = item.comment_id ? `comment-${item.comment_id}` : `post-${item.post_id}`
            return targetId === entry.target.id
          })
          if (!notification || markingNotifications.current.has(notification.id)) continue
          markingNotifications.current.add(notification.id)
          observer.unobserve(entry.target)
          app.markMentionAsRead(notification.id)
            .then(() => {
              if (notification.id === notificationId) navigate('/comunidade', { replace: true })
            })
            .catch((readError) => {
              markingNotifications.current.delete(notification.id)
              setError(readError.message)
            })
        }
      },
      { threshold: [0.35] }
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
  }, [app.mentionNotifications, app.markMentionAsRead, location.search, navigate, openReplies, posts])
  const publish = async (event) => {
    event.preventDefault()
    if (!content.trim() && !attachment) return
    if (!configured) return setError('Configure o Supabase para publicar na comunidade.')
    try {
      setPublishing(true)
      const { error: insertError } = await supabase
        .from('posts')
        .insert({ author_id: app.user.id, content: content.trim(), track: attachment })
      if (insertError) throw insertError
      setContent(''); setAttachment(null)
      await load()
    } catch (publishError) {
      setError(`Não foi possível publicar: ${publishError.message}`)
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
    const content = (replyDrafts[post.id] || '').trim()
    if (!content) return
    try {
      const { error: insertError } = await supabase.from('post_comments').insert({
        post_id: post.id,
        author_id: app.user.id,
        content,
      })
      if (insertError) throw insertError
      setReplyDrafts((current) => ({ ...current, [post.id]: '' }))
      await load()
    } catch (replyError) {
      setError(`Não foi possível responder à postagem: ${replyError.message}`)
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
  return (
    <Page title="Comunidade" subtitle="O que está tocando na cabeça de todo mundo?">
      <form className="composer" onSubmit={publish}>
        <Avatar profile={app.profile} />
        <MentionComposer
          className="community-composer-input"
          value={content}
          profiles={profiles}
          onChange={setContent}
          rows={3}
          placeholder="Compartilhe algo... Digite @ para mencionar alguém"
        />
        <SharePicker playlists={playlists} attachment={attachment} onChange={setAttachment} userId={app.user.id} />
        <button className="primary" disabled={publishing}>
          <Send /> Publicar
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {app.mentionNotificationError && (
        <p className="form-error" role="alert">
          {app.mentionNotificationError}
        </p>
      )}
      {app.mentionNotifications?.length > 0 && (
        <Section title="Menções">
          <div className="mention-notifications">
            {app.mentionNotifications.map((notification) => (
              <button
                className="mention-notification"
                key={notification.id}
                type="button"
                onClick={() => navigate(`/comunidade?notificacao=${encodeURIComponent(notification.id)}`)}
              >
                <Bell size={18} />
                <span>
                  <b>{notification.actor?.display_name || 'Alguém'}</b>
                  <small>
                    {notification.kind === 'comment_mention'
                      ? 'mencionou você em uma resposta'
                      : 'mencionou você em uma publicação'}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section title="Feed">
        {posts.length ? (
          posts.map((post) => (
            <article className="post" id={`post-${post.id}`} key={post.id}>
              <Avatar profile={post.author} />
              <div>
                <b>{post.author?.display_name || 'Ouvinte Harmony'}</b>
                <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
                <p><MentionText text={post.content} profiles={profiles} /></p>
                {post.track && <AttachmentCard attachment={post.track} onOpenPlaylist={openPlaylist} />}
                <div className="post-actions">
                  <button
                    type="button"
                    className={`like ${post.post_likes?.some((x) => x.user_id === app.user.id) ? 'liked' : ''}`}
                    aria-label="Curtir postagem"
                    aria-pressed={post.post_likes?.some((x) => x.user_id === app.user.id) || false}
                    onClick={() => react(post, 'like')}
                  >
                    <Heart fill={post.post_likes?.some((x) => x.user_id === app.user.id) ? 'currentColor' : 'none'} />
                    {post.post_likes?.length || 0}
                  </button>
                  <button
                    type="button"
                    className={`like dislike ${post.post_dislikes?.some((x) => x.user_id === app.user.id) ? 'disliked' : ''}`}
                    aria-label="Não curtir postagem"
                    aria-pressed={post.post_dislikes?.some((x) => x.user_id === app.user.id) || false}
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
                </div>
                {openReplies.has(post.id) && (
                  <div className="post-replies">
                    {post.post_comments?.map((comment) => (
                      <article className="post-reply" id={`comment-${comment.id}`} key={comment.id}>
                        <Avatar profile={comment.author} />
                        <div>
                          <b>{comment.author?.display_name || 'Ouvinte Harmony'}</b>
                          {comment.author?.username && <small>@{comment.author.username}</small>}
                          <p><MentionText text={comment.content} profiles={profiles} /></p>
                        </div>
                      </article>
                    ))}
                    <form className="reply-composer" onSubmit={(event) => submitReply(event, post)}>
                      <MentionComposer
                        value={replyDrafts[post.id] || ''}
                        profiles={profiles}
                        onChange={(value) => setReplyDrafts((current) => ({ ...current, [post.id]: value }))}
                        placeholder="Escreva uma resposta... Use @ para mencionar"
                        rows={2}
                        required
                      />
                      <button type="submit" className="primary"><Send /> Responder</button>
                    </form>
                  </div>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty text="Ainda não há posts. Seja a primeira voz da comunidade." />
        )}
      </Section>
      {openedPlaylist && <PlaylistDialog playlist={openedPlaylist} app={app} readOnly onClose={() => setOpenedPlaylist(null)} onSaved={() => {}} />}
    </Page>
  )
}
