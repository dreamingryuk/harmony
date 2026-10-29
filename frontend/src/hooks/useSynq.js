import { useCallback, useEffect, useState } from 'react'
import { configured, ensureProfile, getAccountPreferences, supabase } from '../lib/supabase'
import { ACCOUNT_LIMIT, clearAccounts, forgetAccount, rememberAccount, savedAccounts } from '../utils/accounts'

const demoUser = { id: 'demo-user', email: 'demo@synq.app' }

export function useUnreadMessages(userId, notificationsEnabled) {
  const [unreadIds, setUnreadIds] = useState(new Set())
  const [unreadSenders, setUnreadSenders] = useState(new Set())
  const load = useCallback(async () => {
    if (!configured || !userId) return
    const [{ data: received, error: messagesError }, { data: receipts, error: receiptsError }] =
      await Promise.all([
        supabase.from('messages').select('id, sender_id').eq('recipient_id', userId),
        supabase.from('message_reads').select('message_id').eq('user_id', userId),
      ])
    // A migration ainda não executada não deve impedir o restante do aplicativo de abrir.
    if (messagesError || receiptsError) return
    const readIds = new Set((receipts || []).map((receipt) => receipt.message_id))
    const unread = (received || []).filter((message) => !readIds.has(message.id))
    setUnreadIds(new Set(unread.map((message) => message.id)))
    setUnreadSenders(new Set(unread.map((message) => message.sender_id)))
  }, [userId])
  useEffect(() => {
    load()
    if (!configured || !userId) return undefined
    const channel = supabase
      .channel(`synq-unread-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (
          notificationsEnabled &&
          payload.new.recipient_id === userId &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('Harmony', { body: 'Você recebeu uma nova mensagem.' })
        }
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, notificationsEnabled, userId])
  return { unreadIds, unreadSenders, unreadCount: unreadIds.size, refreshUnread: load }
}

export function useSynq() {
  // Sem Supabase configurado o app entra em modo demo: o usuário precisa
  // existir já na primeira renderização, antes do efeito preencher o estado.
  const [user, setUser] = useState(() => (configured ? null : demoUser)),
    [profile, setProfile] = useState(null),
    [preferences, setPreferences] = useState(null),
    [passwordRecovery, setPasswordRecovery] = useState(false),
    [accounts, setAccounts] = useState(() => savedAccounts()),
    [ready, setReady] = useState(!configured)
  const refreshProfile = useCallback(async (authUser) => {
    if (!configured)
      return setProfile({
        id: demoUser.id,
        display_name: 'Visitante Harmony',
        favorite_genres: ['Pop'],
      })
    const nextProfile = await ensureProfile(authUser)
    setProfile(nextProfile)
    window.dispatchEvent(new CustomEvent('synq-profile-updated', { detail: nextProfile }))
  }, [])
  const refreshPreferences = useCallback(async (authUser) => {
    if (!configured) {
      setPreferences({
        user_id: demoUser.id,
        chat_notifications_enabled: true,
        default_playlist_public: false,
      })
      return
    }
    setPreferences(await getAccountPreferences(authUser?.id))
  }, [])
  useEffect(() => {
    if (!configured) {
      setUser(demoUser)
      return
    }
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error
        setUser(data.session?.user || null)
        if (data.session?.user) {
          setAccounts(rememberAccount(data.session))
          await Promise.all([
            refreshProfile(data.session.user).catch((profileError) => {
              console.error('Não foi possível carregar o perfil:', profileError)
            }),
            refreshPreferences(data.session.user).catch((preferencesError) => {
              console.error('Não foi possível carregar as preferências:', preferencesError)
            }),
          ])
        }
      })
      .catch((error) => console.error('Não foi possível carregar a sessão:', error))
      .finally(() => setReady(true))
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session) setAccounts(rememberAccount(session))
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      if (session?.user) {
        queueMicrotask(() =>
          refreshProfile(session.user).catch((error) =>
            console.error('Não foi possível atualizar o perfil:', error)
          )
        )
        queueMicrotask(() =>
          refreshPreferences(session.user).catch((error) =>
            console.error('Não foi possível carregar as preferências:', error)
          )
        )
      } else {
        setProfile(null)
        setPreferences(null)
        setPasswordRecovery(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [refreshPreferences, refreshProfile])
  const switchAccount = useCallback(async (account) => {
    if (!configured || !account?.access_token || !account?.refresh_token) return false
    const { error } = await supabase.auth.setSession({ access_token: account.access_token, refresh_token: account.refresh_token })
    if (error) { setAccounts(forgetAccount(account.id)); return false }
    return true
  }, [])
  const removeAccount = useCallback((id) => setAccounts(forgetAccount(id)), [])
  const signOutAllAccounts = useCallback(async () => {
    clearAccounts(); setAccounts([])
    if (configured) await supabase.auth.signOut({ scope: 'global' })
  }, [])
  return {
    user,
    profile,
    preferences,
    ready,
    refreshProfile,
    refreshPreferences,
    passwordRecovery,
    setPasswordRecovery,
    accounts,
    accountLimit: ACCOUNT_LIMIT,
    switchAccount,
    removeAccount,
    signOutAllAccounts,
    demo: !configured,
  }
}
