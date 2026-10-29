import { useCallback, useEffect, useState } from 'react'
import { configured, supabase } from '../lib/supabase'

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
        'id, post_id, comment_id, kind, created_at, actor:profiles!community_notifications_actor_id_fkey(id, username, display_name, avatar_url)'
      )
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (queryError) {
      setError(`Não foi possível carregar notificações de menção: ${queryError.message}`)
      return
    }
    setError('')
    setNotifications(data || [])
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
      .subscribe()
    window.addEventListener('harmony-notifications-changed', load)
    return () => {
      window.removeEventListener('harmony-notifications-changed', load)
      supabase.removeChannel(channel)
    }
  }, [load, userId])

  const markAsRead = useCallback(
    async (notificationId) => {
      const { error: updateError } = await supabase
        .from('community_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_id', userId)
      if (updateError) {
        setError(`Não foi possível marcar a menção como vista: ${updateError.message}`)
        throw updateError
      }
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item
        )
      )
    },
    [userId]
  )

  return {
    mentionNotifications: notifications,
    unreadMentionCount: notifications.filter((item) => !item.read_at).length,
    mentionNotificationError: error,
    markMentionAsRead: markAsRead,
  }
}
