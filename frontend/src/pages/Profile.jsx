import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Page } from '../components/Media'
import { AvatarCropDialog } from '../components/AvatarCropDialog'
import { GenrePicker } from '../components/GenrePicker'

export function Profile({ app }) {
  const [form, setForm] = useState({ display_name: '', bio: '', favorite_genres: [] })
  const [avatarBusy, setAvatarBusy] = useState(''),
    [avatarSource, setAvatarSource] = useState(''),
    [avatarImage, setAvatarImage] = useState(null)
  const avatarInputRef = useRef(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setForm({ display_name: app.profile?.display_name || '', bio: app.profile?.bio || '', favorite_genres: app.profile?.favorite_genres || [] })
  }, [app.profile, app.user?.email])
  useEffect(() => {
    if (!avatarSource) {
      setAvatarImage(null)
      return undefined
    }
    let active = true
    const image = new Image()
    image.onload = () => {
      if (active) setAvatarImage(image)
    }
    image.onerror = () => {
      if (active) {
        setNotice('Não foi possível abrir essa imagem. Escolha outro arquivo.')
        setAvatarSource('')
      }
    }
    image.src = avatarSource
    return () => {
      active = false
      URL.revokeObjectURL(avatarSource)
    }
  }, [avatarSource])
  const save = async (event) => {
    event.preventDefault()
    if (!configured) return setNotice('Configure o Supabase para salvar seu perfil.')
    if (!form.display_name.trim()) return setNotice('Informe um nome de exibição.')
    setProfileSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: form.display_name.trim(), bio: form.bio.trim(), favorite_genres: form.favorite_genres }).eq('id', app.user.id)
      if (error) throw error
      await app.refreshProfile(app.user)
      setNotice('Perfil salvo com sucesso.')
    } catch (error) {
      setNotice(`Não foi possível salvar o perfil: ${error.message}`)
    } finally {
      setProfileSaving(false)
    }
  }
  const chooseAvatar = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!configured) return setNotice('Configure o Supabase para enviar uma foto de perfil.')
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!extensions[file.type]) return setNotice('Formato inválido. Escolha uma imagem JPEG, PNG ou WebP.')
    if (file.size > 5 * 1024 * 1024) return setNotice('A imagem é grande demais. O limite é 5 MB.')
    setNotice('')
    setAvatarSource(URL.createObjectURL(file))
  }
  const uploadAvatar = async (blob) => {
    if (!configured) return setNotice('Configure o Supabase para enviar uma foto de perfil.')
    try {
      setAvatarBusy('upload')
      const extension = blob.type.split('/')[1] || 'webp'
      const file = new File([blob], `avatar.${extension}`, { type: blob.type || 'image/webp' })
      const body = new FormData()
      body.append('file', file)
      const { error } = await supabase.functions.invoke('avatar', { body })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        await app.refreshProfile(app.user)
        throw new Error(message)
      }
      await app.refreshProfile(app.user)
      setAvatarSource('')
      setNotice('Foto de perfil atualizada.')
    } catch (error) {
      setNotice(`Não foi possível enviar a foto: ${error.message}`)
    } finally {
      setAvatarBusy('')
    }
  }
  const removeAvatar = async () => {
    if (!app.profile?.avatar_url) return
    if (!window.confirm('Remover sua foto de perfil? Seu avatar padrão será exibido.')) return
    try {
      setAvatarBusy('remove')
      const { error } = await supabase.functions.invoke('avatar', { body: { action: 'remove' } })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        await app.refreshProfile(app.user)
        throw new Error(message)
      }
      await app.refreshProfile(app.user)
      setNotice('Foto de perfil removida.')
    } catch (error) {
      setNotice(`Não foi possível remover a foto: ${error.message}`)
    } finally {
      setAvatarBusy('')
    }
  }
  return <Page title="Seu Perfil" subtitle="Faça seu perfil soar como você.">
    <div className="profile-hero"><div><div className="avatar-editor"><button type="button" className="avatar-trigger" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Alterar foto de perfil"><Avatar profile={app.profile} className="big" /></button><button type="button" className="avatar-upload" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Selecionar nova foto"><Camera /></button><input ref={avatarInputRef} className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={Boolean(avatarBusy)} /></div><div className="avatar-actions"><button type="button" className="secondary small-button" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)}>{avatarBusy === 'upload' ? 'Enviando...' : 'Alterar foto'}</button>{app.profile?.avatar_url && <button type="button" className="text-button" onClick={removeAvatar} disabled={Boolean(avatarBusy)}>{avatarBusy === 'remove' ? 'Removendo...' : 'Remover foto'}</button>}</div></div><div><h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2><p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p></div></div>
    {avatarSource && avatarImage && <AvatarCropDialog image={avatarImage} onSave={uploadAvatar} onCancel={() => setAvatarSource('')} busy={avatarBusy === 'upload'} />}
    {notice && <p className="notice profile-notice" role="status">{notice}</p>}
    <form className="profile-form" onSubmit={save}>
      <label>Nome de exibição<input value={form.display_name} maxLength="80" onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></label>
      <label>Bio<textarea value={form.bio} maxLength="300" onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
      <label htmlFor="genre-search">Gêneros favoritos</label>
      <GenrePicker
        selectedGenres={form.favorite_genres}
        onChange={(favorite_genres) => setForm((current) => ({ ...current, favorite_genres }))}
      />
      <button className="primary" disabled={profileSaving}>{profileSaving ? 'Salvando...' : 'Salvar alterações'}</button>
    </form>
  </Page>
}
