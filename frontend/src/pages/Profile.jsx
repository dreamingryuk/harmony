import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Settings2 } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Page } from '../components/Media'
import { AvatarCropDialog } from '../components/AvatarCropDialog'
import { GenrePicker } from '../components/GenrePicker'
import { BANNER_PRESETS, bannerStyle } from '../utils/profile'

export function Profile({ app }) {
  const [form, setForm] = useState({ display_name: '', bio: '', favorite_genres: [] })
  const [avatarBusy, setAvatarBusy] = useState(''),
    [avatarSource, setAvatarSource] = useState(''),
    [avatarImage, setAvatarImage] = useState(null)
  const avatarInputRef = useRef(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [ajustes, setAjustes] = useState(false)
  const [banner, setBanner] = useState({ type: 'color', color: '#14b881', colorEnd: '#10251f', url: '' })
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [bannerBusy, setBannerBusy] = useState(false)
  const bannerInputRef = useRef(null)

  useEffect(() => {
    setForm({ display_name: app.profile?.display_name || '', bio: app.profile?.bio || '', favorite_genres: app.profile?.favorite_genres || [] })
    setBanner({
      type: app.profile?.banner_type || 'color',
      color: app.profile?.banner_color || '#14b881',
      colorEnd: app.profile?.banner_color_end || '#10251f',
      url: app.profile?.banner_url || '',
    })
  }, [app.profile, app.user?.email])

  // Prévia da imagem escolhida antes de enviar para o bucket.
  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview('')
      return undefined
    }
    const url = URL.createObjectURL(bannerFile)
    setBannerPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [bannerFile])

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

  const escolherBanner = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!extensions[file.type]) return setNotice('Formato inválido. Escolha uma imagem JPEG, PNG ou WebP.')
    if (file.size > 5 * 1024 * 1024) return setNotice('A imagem do banner é grande demais. O limite é 5 MB.')
    setNotice('')
    setBannerFile(file)
    setBanner((current) => ({ ...current, type: 'image' }))
  }

  const salvarBanner = async () => {
    if (!configured) return setNotice('Configure o Supabase para alterar o banner.')
    if (banner.type === 'image' && !bannerFile && !banner.url) {
      return setNotice('Escolha uma imagem para o banner.')
    }
    setBannerBusy(true)
    setNotice('')
    try {
      let url = banner.url
      if (banner.type === 'image' && bannerFile) {
        const extensao = (bannerFile.type.split('/')[1] || 'webp').replace('jpeg', 'jpg')
        const caminho = `${app.user.id}/banner-${Date.now()}.${extensao}`
        const { error } = await supabase.storage.from('banners').upload(caminho, bannerFile, { upsert: true, contentType: bannerFile.type })
        if (error) throw error
        const { data: publica } = supabase.storage.from('banners').getPublicUrl(caminho)
        url = publica?.publicUrl || ''
        setBannerFile(null)
        setBanner((current) => ({ ...current, url }))
      }
      const { error } = await supabase.from('profiles').update({
        banner_type: banner.type,
        banner_color: banner.color,
        banner_color_end: banner.colorEnd,
        banner_url: url || '',
      }).eq('id', app.user.id)
      if (error) throw error
      await app.refreshProfile(app.user)
      setNotice('Banner atualizado.')
    } catch (error) {
      setNotice(`Não foi possível salvar o banner: ${error.message}`)
    } finally {
      setBannerBusy(false)
    }
  }

  const removeBannerImage = () => {
    setBannerFile(null)
    setBanner((current) => ({ ...current, url: '', type: 'color' }))
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

  const exibicao = {
    banner_type: banner.type,
    banner_color: banner.color,
    banner_color_end: banner.colorEnd,
    banner_url: bannerPreview || banner.url,
  }

  return (
    <Page title="Seu Perfil público" subtitle="É assim que as outras pessoas veem você no Harmony.">
      <div className="profile-hero public-profile">
        <div className="profile-banner" style={bannerStyle(exibicao)} />
        <div className="profile-identity">
          <Avatar profile={app.profile} className="big" />
          <div>
            <h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2>
            {app.profile?.username && <p className="profile-handle">@{app.profile.username}</p>}
            <p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p>
            {app.profile?.favorite_genres?.length > 0 && (
              <ul className="genre-tags">
                {app.profile.favorite_genres.map((genero) => (
                  <li key={genero}>{genero}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="profile-actions">
          <button type="button" className="primary" aria-expanded={ajustes} onClick={() => setAjustes((atual) => !atual)}>
            <Settings2 /> Ajustes
          </button>
          <Link className="secondary" to="/configuracoes">Configurações da conta</Link>
        </div>
      </div>

      {notice && <p className="notice profile-notice" role="status">{notice}</p>}

      {ajustes && (
        <>
          <section className="settings-section banner-section" aria-labelledby="banner-title">
            <h2 id="banner-title">Banner do perfil</h2>
            <p className="settings-description">Escolha uma cor chapada, um gradiente ou uma imagem.</p>
            <div className="banner-preview profile-banner" style={bannerStyle(exibicao)} />
            <div className="banner-types" role="radiogroup" aria-label="Tipo de banner">
              {[
                ['color', 'Cor'],
                ['gradient', 'Gradiente'],
                ['image', 'Imagem'],
              ].map(([valor, rotulo]) => (
                <label key={valor} className={banner.type === valor ? 'active' : ''}>
                  <input
                    type="radio"
                    name="banner-type"
                    value={valor}
                    checked={banner.type === valor}
                    onChange={() => setBanner((current) => ({ ...current, type: valor }))}
                  />
                  <span>{rotulo}</span>
                </label>
              ))}
            </div>

            {banner.type === 'color' && (
              <label className="banner-color-field">
                Cor do banner
                <input type="color" value={banner.color} onChange={(event) => setBanner((current) => ({ ...current, color: event.target.value }))} />
              </label>
            )}

            {banner.type === 'gradient' && (
              <div className="banner-gradient-fields">
                <label>De <input type="color" value={banner.color} onChange={(event) => setBanner((current) => ({ ...current, color: event.target.value }))} /></label>
                <label>Até <input type="color" value={banner.colorEnd} onChange={(event) => setBanner((current) => ({ ...current, colorEnd: event.target.value }))} /></label>
                <div className="banner-presets">
                  {BANNER_PRESETS.map(([nome, inicio, fim]) => (
                    <button
                      type="button"
                      key={nome}
                      title={nome}
                      aria-label={`Gradiente ${nome}`}
                      className={banner.color === inicio && banner.colorEnd === fim ? 'active' : ''}
                      style={{ backgroundImage: `linear-gradient(120deg, ${inicio}, ${fim})` }}
                      onClick={() => setBanner((current) => ({ ...current, type: 'gradient', color: inicio, colorEnd: fim }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {banner.type === 'image' && (
              <div className="banner-image-fields">
                <div className="avatar-actions">
                  <button type="button" className="secondary small-button" onClick={() => bannerInputRef.current?.click()} disabled={bannerBusy}>
                    {bannerFile ? 'Trocar imagem' : 'Escolher imagem'}
                  </button>
                  {(bannerFile || banner.url) && (
                    <button type="button" className="text-button" onClick={removeBannerImage}>Remover imagem</button>
                  )}
                </div>
                <p className="hint">{bannerFile ? bannerFile.name : banner.url ? 'Uma imagem já está definida.' : 'JPEG, PNG ou WebP, até 5 MB.'}</p>
                <input ref={bannerInputRef} className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={escolherBanner} disabled={bannerBusy} />
              </div>
            )}

            <button type="button" className="primary" onClick={salvarBanner} disabled={bannerBusy}>
              {bannerBusy ? 'Salvando banner...' : 'Salvar banner'}
            </button>
          </section>

          <div className="profile-edit-card">
            <div>
              <div className="avatar-editor">
                <button type="button" className="avatar-trigger" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Alterar foto de perfil">
                  <Avatar profile={app.profile} className="big" />
                </button>
                <button type="button" className="avatar-upload" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)} aria-label="Selecionar nova foto">
                  <Camera />
                </button>
                <input ref={avatarInputRef} className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={Boolean(avatarBusy)} />
              </div>
              <div className="avatar-actions">
                <button type="button" className="secondary small-button" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(avatarBusy)}>{avatarBusy === 'upload' ? 'Enviando...' : 'Alterar foto'}</button>
                {app.profile?.avatar_url && <button type="button" className="text-button" onClick={removeAvatar} disabled={Boolean(avatarBusy)}>{avatarBusy === 'remove' ? 'Removendo...' : 'Remover foto'}</button>}
              </div>
            </div>
            <div>
              <h2>{app.profile?.display_name || 'Ouvinte Harmony'}</h2>
              <p>{app.profile?.bio || 'Sua próxima música favorita começa aqui.'}</p>
            </div>
          </div>

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
        </>
      )}

      {avatarSource && avatarImage && <AvatarCropDialog image={avatarImage} onSave={uploadAvatar} onCancel={() => setAvatarSource('')} busy={avatarBusy === 'upload'} />}
    </Page>
  )
}
