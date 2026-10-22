import { useCallback, useEffect, useState } from 'react'
import { Heart, Send } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page, Section } from '../components/Media'
import { AttachmentCard, PlaylistDialog, SharePicker } from '../components/PlaylistComponents'

export function Community({ app }) {
  const [posts, setPosts] = useState([]),
    [content, setContent] = useState(''),
    [error, setError] = useState(''),
    [publishing, setPublishing] = useState(false),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [openedPlaylist, setOpenedPlaylist] = useState(null)
  const load = useCallback(async () => {
    if (!configured) return
    const { data, error: queryError } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(display_name, avatar_url), post_likes(user_id)')
      .order('created_at', { ascending: false })
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
  const like = async (post) => {
    try {
      const exists = post.post_likes?.some((like) => like.user_id === app.user.id)
      const { error: likeError } = exists
        ? await supabase
            .from('post_likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', app.user.id)
        : await supabase.from('post_likes').insert({ post_id: post.id, user_id: app.user.id })
      if (likeError) throw likeError
      await load()
    } catch (likeError) {
      setError(`Não foi possível atualizar a curtida: ${likeError.message}`)
    }
  }
  const openPlaylist = async (id) => {
    if (!id) return
    const { data, error: playlistError } = await supabase.from('playlists').select('*, playlist_tracks(*)').eq('id', id).maybeSingle()
    if (playlistError || !data) return setError('Esta playlist não está mais pública ou foi removida.')
    setOpenedPlaylist(data)
  }
  return (
    <Page title="Comunidade" subtitle="O que está tocando na cabeça de todo mundo?">
      <form className="composer" onSubmit={publish}>
        <Avatar profile={app.profile} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compartilhe uma descoberta, um álbum ou uma sensação..."
        />
        <SharePicker playlists={playlists} attachment={attachment} onChange={setAttachment} />
        <button className="primary" disabled={publishing}>
          <Send /> Publicar
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Section title="Feed">
        {posts.length ? (
          posts.map((post) => (
            <article className="post" key={post.id}>
              <Avatar profile={post.author} />
              <div>
                <b>{post.author?.display_name || 'Ouvinte Harmony'}</b>
                <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
                <p>{post.content}</p>
                {post.track && <AttachmentCard attachment={post.track} onOpenPlaylist={openPlaylist} />}
                <button
                  className={`like ${post.post_likes?.some((x) => x.user_id === app.user.id) ? 'liked' : ''}`}
                  onClick={() => like(post)}
                >
                  <Heart
                    fill={
                      post.post_likes?.some((x) => x.user_id === app.user.id)
                        ? 'currentColor'
                        : 'none'
                    }
                  />{' '}
                  {post.post_likes?.length || 0}
                </button>
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
