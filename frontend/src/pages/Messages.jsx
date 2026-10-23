import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Send } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page } from '../components/Media'
import { AttachmentCard, PlaylistDialog, SharePicker } from '../components/PlaylistComponents'
import { MentionComposer, MentionText } from '../components/MentionComposer'

export function Messages({ app }) {
  const userId = app.user.id
  const refreshUnread = app.refreshUnread
  const [profiles, setProfiles] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [attachment, setAttachment] = useState(null),
    [playlists, setPlaylists] = useState([]),
    [notice, setNotice] = useState(''),
    [openedPlaylist, setOpenedPlaylist] = useState(null)
  const chatRef = useRef(null)
  useEffect(() => {
    if (configured)
      supabase
        .from('profiles')
        .select('*')
        .neq('id', app.user.id)
        .then(({ data }) => setProfiles(data || []))
  }, [app.user])
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
          {profiles.length ? (
            profiles.map((profile) => (
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
            <Empty text="Outros membros aparecerão aqui." />
          )}
        </aside>
        <section className="conversation">
          {selected ? (
            <>
              <header>
                <Avatar profile={selected} />
                <b>{selected.display_name}</b>
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
            <Empty text="Escolha alguém para iniciar uma conversa." />
          )}
        </section>
      </div>
      {openedPlaylist && <PlaylistDialog playlist={openedPlaylist} app={app} readOnly onClose={() => setOpenedPlaylist(null)} onSaved={() => {}} />}
    </Page>
  )
}
