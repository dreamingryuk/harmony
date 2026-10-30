import { useCallback, useEffect, useState } from 'react'
import { configured, supabase } from '../lib/supabase'

// O histórico exibido na aba Notificações: as últimas 20 recebidas.
const HISTORICO = 20

export function useMentionNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!configured || !userId) {
      setNotifications([])
      setError('')
      return
    }
    const { data, error: queryError } = await supabase
      .from('community_notifications')
      .select(
        'id, post_id, comment_id, kind, created_at, read_at, actor:profiles!community_notifications_actor_id_fkey(id, username, display_name, avatar_url)'
      )
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORICO)
    if (queryError) {
      setError(`Não foi possível carregar notificações de menção: ${queryError.message}`)
      return
    }
    // O texto da publicação e a comunidade de origem vêm em uma consulta à
    // parte: se o post não estiver mais visível, a notificação continua na lista.
    const linhas = data || []
    const postIds = [...new Set(linhas.map((item) => item.post_id).filter(Boolean))]
    let posts = {}
    if (postIds.length) {
      const { data: publicacoes } = await supabase
        .from('posts')
        .select('id, content, track, comunidade:comunidades(nome, slug)')
        .in('id', postIds)
      posts = Object.fromEntries((publicacoes || []).map((post) => [post.id, post]))
    }
    setError('')
    setNotifications(linhas.map((item) => ({ ...item, post: posts[item.post_id] || null })))
  }, [userId])

  useEffect(() => {
    load()
    if (!configured || !userId) return undefined
    const channel = supabase
      .channel(`community-mentions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        load
      )
      // Marcar como lida em outra aba também atualiza o contador daqui.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'community_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        load
      )
      .subscribe()
    window.addEventListener('harmony-notifications-changed', load)
    return () => {
      window.removeEventListener('harmony-notifications-changed', load)
      supabase.removeChannel(channel)
    }
  }, [load, userId])

  const markAsRead = useCallback(
    async (notificationId) => {
      const lidaEm = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('community_notifications')
        .update({ read_at: lidaEm })
        .eq('id', notificationId)
        .eq('recipient_id', userId)
        .is('read_at', null)
      if (updateError) {
        setError(`Não foi possível marcar a menção como vista: ${updateError.message}`)
        throw updateError
      }
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read_at: item.read_at || lidaEm } : item
        )
      )
      window.dispatchEvent(new Event('harmony-notifications-changed'))
    },
    [userId]
  )

  // Uma única atualização evita que a lista volte a aparecer como não lida
  // no meio do caminho de um laço com várias chamadas.
  const markAllAsRead = useCallback(async () => {
    const lidaEm = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('community_notifications')
      .update({ read_at: lidaEm })
      .eq('recipient_id', userId)
      .is('read_at', null)
    if (updateError) {
      setError(`Não foi possível marcar as notificações como vistas: ${updateError.message}`)
      throw updateError
    }
    setNotifications((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: lidaEm }))
    )
    window.dispatchEvent(new Event('harmony-notifications-changed'))
  }, [userId])

  return {
    mentionNotifications: notifications,
    unreadMentionCount: notifications.filter((item) => !item.read_at).length,
    mentionNotificationError: error,
    markMentionAsRead: markAsRead,
    markAllMentionsAsRead: markAllAsRead,
  }
}
