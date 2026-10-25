import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Send, UserPlus } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page } from '../components/Media'
import { AttachmentCard, PlaylistDialog, SharePicker } from '../components/PlaylistComponents'
import { MentionComposer, MentionText } from '../components/MentionComposer'
import { ProfilePopup } from '../components/ProfilePopup'

export function Messages({ app }) {
  const userId = app.user.id
  const refreshUnread = app.refreshUnread
  const [profiles, setProfiles] = useState([]),
    [friendships, setFriendships] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [notice, setNotice] = useState(''),
    [openedPlaylist, setOpenedPlaylist] = useState(null),
    [invite, setInvite] = useState(null),
    [inviteBusy, setInviteBusy] = useState(false),
    [search, setSearch] = useState(''),
    [profilePopup, setProfilePopup] = useState(null)
  const chatRef = useRef(null)

  useEffect(() => {
    if (configured)
      supabase
        .from('profiles')
        .select('*')
        .neq('id', app.user.id)
        .then(({ data }) => setProfiles(data || []))
  }, [app.user])

  // Amizades: quem pediu, quem aceitou e quem ainda está esperando.
  const loadFriendships = useCallback(() => {
    if (!configured) return Promise.resolve()
    return supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => setFriendships(data || []))
      .catch(() => setFriendships([]))
  }, [userId])

  useEffect(() => {
    loadFriendships()
  }, [loadFriendships])

  const friends = friendships
    .filter((friendship) => friendship.status === 'accepted')
    .map((friendship) => {
      const otherId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
      return profiles.find((profile) => profile.id === otherId)
    })
    .filter(Boolean)

  useEffect(() => {
    const syncProfile = (event) => {
      const updated = event.detail
      if (!updated?.id) return
      setProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? { ...profile, ...updated } : profile))
      )
      setSelected((current) =>
        current?.id === updated.id ? { ...current, ...updated } : current
      )
    }
    window.addEventListener('synq-profile-updated', syncProfile)
    return () => window.removeEventListener('synq-profile-updated', syncProfile)
  }, [])
  useEffect(() => {
    if (!configured) return
    supabase.from('playlists').select('*, playlist_tracks(*)').eq('owner_id', app.user.id).eq('is_public', true).then(({ data }) => setPlaylists(data || []))
  }, [app.user.id])
  const load = useCallback(async () => {
    if (!configured || !selected) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${app.user.id},recipient_id.eq.${selected.id}),and(sender_id.eq.${selected.id},recipient_id.eq.${app.user.id})`
      )
      .order('created_at')
    setMessages(data || [])
  }, [app.user, selected])
  useEffect(() => {
    load()
    if (!configured) return
    const channel = supabase
      .channel('synq-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])
  useEffect(() => {
    const chat = chatRef.current
    if (chat) chat.scrollTop = chat.scrollHeight
  }, [messages])
  useEffect(() => {
    if (!configured || !selected || !messages.length) return
    const unread = messages.filter((message) => message.recipient_id === userId)
    if (!unread.length) return
    supabase.from('message_reads').upsert(unread.map((message) => ({ message_id: message.id, user_id: userId })), { onConflict: 'message_id,user_id', ignoreDuplicates: true }).then(({ error }) => {
      if (error) setNotice('Execute a migration de notificações no Supabase para marcar mensagens como lidas.')
      else refreshUnread()
    })
  }, [messages, refreshUnread, selected, userId])

  // Convite pelo apelido público: só existe quem realmente está cadastrado.
  const addFriend = async (event) => {
    event.preventDefault()
    const nickname = search.trim().replace(/^@/, '').toLowerCase()
    if (!nickname) return setInvite({ text: 'Digite o apelido público de alguém.', error: true })
    if (!configured) return setInvite({ text: 'Configure o Supabase para adicionar amigos.', error: true })
    if (nickname === (app.profile?.username || '').toLowerCase()) {
      return setInvite({ text: 'Você não pode adicionar você mesmo.', error: true })
    }
    setInviteBusy(true)
    setInvite(null)
    try {
      const { data: person, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', nickname.replace(/[%_]/g, ''))
        .maybeSingle()
      if (error) throw error
      if (!person) return setInvite({ text: `Não existe ninguém com o apelido @${nickname}.`, error: true })
      const existing = friendships.find(
        (friendship) =>
          (friendship.requester_id === userId && friendship.addressee_id === person.id) ||
          (friendship.requester_id === person.id && friendship.addressee_id === userId)
      )
      if (existing?.status === 'accepted') {
        return setInvite({ text: `Vocês já são amigos com ${person.display_name}.`, error: true, person })
      }
      if (existing?.status === 'pending') {
        const mine = existing.requester_id === userId
        return setInvite({
          text: mine ? `O convite para @${nickname} já foi enviado.` : `${person.display_name} quer ser seu amigo.`,
          error: true,
          person,
        })
      }
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: person.id, status: 'pending' })
      if (insertError) {
        if (insertError.code === '23505') {
          return setInvite({ text: `Já existe um convite pendente para @${nickname}.`, error: true, person })
        }
        throw insertError
      }
      setSearch('')
      await loadFriendships()
      setInvite({ text: `Convite enviado.`, error: false, person })
    } catch (error) {
      setInvite({ text: `Não foi possível enviar o convite: ${error.message}`, error: true })
    } finally {
      setInviteBusy(false)
    }
  }

  const send = async (event) => {
    event.preventDefault()
    if ((!text.trim() && !attachment) || !selected) return
    const { error } = await supabase.from('messages').insert({
      sender_id: app.user.id,
      recipient_id: selected.id,
      content: text.trim(),
      track: attachment,
    })
    if (error) return setNotice(`Não foi possível enviar: ${error.message}`)
    setText(''); setAttachment(null); load()
  }
  const requestNotifications = async () => {
    if (!('Notification' in window)) return setNotice('Este navegador não suporta notificações.')
    const result = await Notification.requestPermission()
    setNotice(result === 'granted' ? 'Notificações ativadas.' : 'As notificações continuam desativadas no navegador.')
  }
  const openPlaylist = async (id) => {
    const { data, error } = await supabase.from('playlists').select('*, playlist_tracks(*)').eq('id', id).maybeSingle()
    if (error || !data) return setNotice('Esta playlist não está mais pública ou foi removida.')
    setOpenedPlaylist(data)
  }
  return (
    <Page title="Mensagens" subtitle="Converse sobre o que está te fazendo ouvir no repeat.">
      <div className="message-tools"><button className="secondary small-button" onClick={requestNotifications}><Bell /> Ativar notificações</button>{notice && <span className="hint">{notice}</span>}</div>
      <div className="messages">
        <aside>
          <form className="friend-add" onSubmit={addFriend}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="@apelido público"
              aria-label="Apelido público do amigo"
              maxLength={30}
              autoComplete="off"
            />
            <button className="primary small-button" disabled={inviteBusy} type="submit">
              <UserPlus /> {inviteBusy ? 'Buscando...' : 'Adicionar'}
            </button>
          </form>
          {invite && (
            <p className={`friend-notice ${invite.error ? 'form-error' : 'hint'}`} role="status">
              {invite.text}
              {!invite.error && invite.person && (
                <button type="button" className="text-button" onClick={() => setProfilePopup(invite.person)}>
                  Mostrar perfil
                </button>
              )}
            </p>
          )}
          <p className="aside-label">Amigos</p>
          {friends.length ? (
            friends.map((profile) => (
              <button
                onClick={() => setSelected(profile)}
                className={selected?.id === profile.id ? 'active' : ''}
                key={profile.id}
              >
                <Avatar profile={profile} />
                <span>{profile.display_name}{app.unreadSenders?.has(profile.id) && <i className="unread-dot" />}</span>
              </button>
            ))
          ) : (
            <Empty text="Adicione alguém pelo apelido público para começar a conversar." />
          )}
        </aside>
        <section className="conversation">
          {selected ? (
            <>
              <header>
                <button type="button" className="avatar-link" onClick={() => setProfilePopup(selected)} aria-label={`Ver perfil de ${selected.display_name}`}>
                  <Avatar profile={selected} />
                </button>
                <b>
                  <button type="button" className="name-link" onClick={() => setProfilePopup(selected)}>
                    {selected.display_name}
                  </button>
                </b>
              </header>
              <div className="chat" ref={chatRef}>
                {messages.map((message) => (
                  <div className={`message-bubble ${message.sender_id === app.user.id ? 'mine' : ''}`} key={message.id}>
                    {message.content && <p><MentionText text={message.content} profiles={profiles} /></p>}
                    {message.track && <AttachmentCard attachment={message.track} compact onOpenPlaylist={openPlaylist} />}
                  </div>
                ))}
              </div>
              <form className="message-composer" onSubmit={send}>
                <MentionComposer
                  value={text}
                  onChange={setText}
                  profiles={profiles}
                  placeholder="Digite uma mensagem..."
                  rows={2}
                  floatingSuggestions
                />
                <SharePicker playlists={playlists} attachment={attachment} onChange={setAttachment} userId={app.user.id} />
                <button className="primary">
                  <Send />
                </button>
              </form>
            </>


          ) : (
            <Empty text="Adicione um amigo pelo apelido público para escolher alguém aqui." />
          )}
        </section>
      </div>
      {openedPlaylist && <PlaylistDialog playlist={openedPlaylist} app={app} readOnly onClose={() => setOpenedPlaylist(null)} onSaved={() => {}} />}
      {profilePopup && <ProfilePopup profile={profilePopup} onClose={() => setProfilePopup(null)} />}
    </Page>
  )
}
