import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { connectSpotify } from '../lib/spotify'
import { youtubeApiKey } from '../lib/youtube'
import { useMusicConnections } from '../hooks/useMusicConnections'
import { Page } from '../components/Media'
import { PasswordField } from '../components/PasswordField'
import { browserDescription, passwordPolicyError, passwordStrength } from '../utils/account'

export function AccountSettings({ app }) {
  const navigate = useNavigate()
  const { connections, disconnectSpotify, connectYoutube, disconnectYoutube } =
    useMusicConnections(app.user?.id)
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    username: '',
  })
  const [preferencesForm, setPreferencesForm] = useState({
    chat_notifications_enabled: true,
    default_playlist_public: false,
  })
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirmation: '',
  })
  const [emailForm, setEmailForm] = useState({ email: '', password: '' })
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' })
  const [pendingEmail, setPendingEmail] = useState(app.user?.new_email || '')
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState('')
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [showPasswords, setShowPasswords] = useState({})
  const [musicNotice, setMusicNotice] = useState('')
  const strength = passwordStrength(passwordForm.next)
  const emailProvider = app.user?.app_metadata?.providers?.includes('email')

  useEffect(() => {
    setProfileForm({
      display_name: app.profile?.display_name || '',
      username: app.profile?.username || '',
    })
  }, [app.profile])

  useEffect(() => {
    setPreferencesForm({
      chat_notifications_enabled: app.preferences?.chat_notifications_enabled !== false,
      default_playlist_public: app.preferences?.default_playlist_public === true,
    })
  }, [app.preferences])

  useEffect(() => {
    setPendingEmail(app.user?.new_email || '')
  }, [app.user?.new_email])

  useEffect(() => {
    if (!configured) return undefined
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setFeedback({ type: 'error', text: 'Não foi possível carregar a sessão atual.' })
          return
        }
        if (mounted) setSession(data.session)
      })
      .catch(() => {
        if (mounted) setFeedback({ type: 'error', text: 'Não foi possível carregar a sessão atual.' })
      })
    return () => {
      mounted = false
    }
  }, [])

  const notify = (type, text) => setFeedback({ type, text })
  const togglePassword = (key) =>
    setShowPasswords((current) => ({ ...current, [key]: !current[key] }))

  const toggleMusicPlatform = async (platform) => {
    setMusicNotice('')
    try {
      if (platform === 'spotify') {
        if (connections.spotify) {
          disconnectSpotify()
          setMusicNotice('Spotify foi desvinculado deste navegador.')
        } else {
          await connectSpotify()
        }
      } else if (connections.youtube) {
        disconnectYoutube()
        setMusicNotice('YouTube Music foi desativado neste navegador.')
      } else {
        connectYoutube()
        setMusicNotice('YouTube Music foi ativado neste navegador.')
      }
    } catch (error) {
      setMusicNotice(error.message || 'Não foi possível atualizar a plataforma.')
    }
  }

  const reauthenticate = async (password) => {
    if (!emailProvider || !app.user?.email) {
      throw new Error('Esta conta não possui autenticação por senha. Use o provedor de login vinculado.')
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: app.user.email,
      password,
    })
    if (error?.status === 400) {
      throw new Error('Senha atual incorreta. Confira e tente novamente.')
    }
    if (error) throw error
    if (data.user?.id !== app.user.id) throw new Error('Não foi possível confirmar sua identidade.')
  }

  const saveAccount = async (event) => {
    event.preventDefault()
    if (!configured) return notify('error', 'Configure o Supabase para salvar as configurações.')
    const username = profileForm.username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return notify('error', 'O nome de usuário deve ter de 3 a 30 caracteres: letras, números ou _.')
    }
    if (!profileForm.display_name.trim() || profileForm.display_name.trim().length > 80) {
      return notify('error', 'O nome de exibição deve ter de 1 a 80 caracteres.')
    }
    setBusy('account')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileForm.display_name.trim(),
          username,
        })
        .eq('id', app.user.id)
      if (error) {
        if (error.code === '23505') throw new Error('Esse nome de usuário já está em uso.')
        throw error
      }
      await app.refreshProfile(app.user)
      notify('success', 'Configurações da conta salvas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível salvar as configurações.')
    } finally {
      setBusy('')
    }
  }

  const savePreferences = async (event) => {
    event.preventDefault()
    if (!configured) return notify('error', 'Configure o Supabase para salvar as preferências.')
    setBusy('preferences')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.from('account_preferences').upsert(
        {
          user_id: app.user.id,
          ...preferencesForm,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      await app.refreshPreferences(app.user)
      notify('success', 'Preferências privadas salvas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível salvar as preferências.')
    } finally {
      setBusy('')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const policyError = passwordPolicyError(passwordForm.next)
    if (policyError) return notify('error', policyError)
    if (passwordForm.next === passwordForm.current) {
      return notify('error', 'A nova senha deve ser diferente da senha atual.')
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      return notify('error', 'A confirmação da nova senha não confere.')
    }
    setBusy('password')
    setFeedback({ type: '', text: '' })
    try {
      await reauthenticate(passwordForm.current)
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next })
      if (error) throw error
      setPasswordForm({ current: '', next: '', confirmation: '' })
      let signOutError
      try {
        const result = await supabase.auth.signOut({ scope: 'others' })
        signOutError = result.error
      } catch {
        signOutError = new Error('Falha de rede ao encerrar outras sessões.')
      }
      if (signOutError) {
        notify(
          'error',
          'A senha foi alterada, mas não foi possível encerrar as outras sessões. Tente novamente na seção Sessões.'
        )
        return
      }
      notify('success', 'Senha alterada. As outras sessões foram encerradas.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível alterar a senha.')
    } finally {
      setBusy('')
    }
  }

  const requestEmailChange = async (event) => {
    event.preventDefault()
    const email = emailForm.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return notify('error', 'Informe um endereço de e-mail válido.')
    }
    if (email === app.user.email?.toLowerCase()) {
      return notify('error', 'Informe um e-mail diferente do atual.')
    }
    setBusy('email')
    setFeedback({ type: '', text: '' })
    try {
      await reauthenticate(emailForm.password)
      const { data, error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/configuracoes` }
      )
      if (error) throw new Error('Não foi possível solicitar a alteração. Verifique o endereço e tente novamente.')
      setPendingEmail(data.user?.new_email || email)
      setEmailForm((current) => ({ ...current, password: '' }))
      notify('success', 'Solicitação enviada. Confirme o link para o novo e-mail; o endereço atual não muda até a confirmação.')
    } catch (error) {
      notify('error', error.message || 'Não foi possível solicitar a alteração do e-mail.')
    } finally {
      setBusy('')
    }
  }

  const resendEmailChange = async () => {
    setBusy('resend-email')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.resend({
        type: 'email_change',
        email: app.user.email,
        options: { emailRedirectTo: `${window.location.origin}/configuracoes` },
      })
      if (error) throw error
      notify('success', 'Se a solicitação ainda estiver válida, um novo link será enviado.')
    } catch {
      notify('error', 'Não foi possível reenviar o link. Solicite uma nova alteração de e-mail.')
    } finally {
      setBusy('')
    }
  }

  const cancelEmailChange = async () => {
    if (!window.confirm('Cancelar a alteração pendente de e-mail?')) return
    setBusy('cancel-email')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.functions.invoke('cancel-email-change', { body: {} })
      if (error) throw error
      setPendingEmail('')
      notify('success', 'Alteração de e-mail cancelada.')
    } catch (error) {
      notify('error', `Não foi possível cancelar a alteração: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const sendRecovery = async () => {
    setBusy('recovery')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(app.user.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (error) throw error
      notify('success', 'Se esse endereço estiver cadastrado, você receberá um link para redefinir a senha.')
    } catch {
      notify('error', 'Não foi possível solicitar o link de recuperação. Tente novamente mais tarde.')
    } finally {
      setBusy('')
    }
  }

  const endOtherSessions = async () => {
    if (!window.confirm('Encerrar todas as outras sessões da sua conta?')) return
    setBusy('sessions')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      notify('success', 'As outras sessões foram encerradas.')
    } catch (error) {
      notify('error', `Não foi possível encerrar as outras sessões: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const endCurrentSession = async () => {
    setBusy('current-session')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (error) {
      notify('error', `Não foi possível encerrar esta sessão: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  const deleteAccount = async (event) => {
    event.preventDefault()
    if (deleteForm.confirmation !== 'EXCLUIR') {
      return notify('error', 'Digite EXCLUIR para confirmar a exclusão.')
    }
    if (!window.confirm('Esta ação apaga permanentemente seu perfil, playlists, mensagens e arquivos. Continuar?')) {
      return
    }
    setBusy('delete')
    setFeedback({ type: '', text: '' })
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'EXCLUIR', password: deleteForm.password },
      })
      if (error) {
        let message = error.message
        if (error.context instanceof Response) {
          const response = await error.context.json().catch(() => null)
          if (response?.error) message = response.error
        }
        throw new Error(message)
      }
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) {
        notify('error', 'A conta foi excluída, mas não foi possível encerrar a sessão. Feche este navegador.')
        return
      }
      navigate('/login', { replace: true })
    } catch (error) {
      notify('error', `Não foi possível excluir a conta: ${error.message}`)
    } finally {
      setBusy('')
    }
  }

  if (!configured) {
    return (
      <Page title="Configurações" subtitle="Gerencie sua conta, segurança e sessões.">
        <p className="notice" role="status">Configure o Supabase para acessar as configurações persistentes da conta.</p>
      </Page>
    )
  }

  return (
    <Page title="Configurações" subtitle="Gerencie sua conta, segurança e sessões.">
      {feedback.text && (
        <p className={`notice settings-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
      <section className="settings-section" aria-labelledby="settings-music-title">
        <h2 id="settings-music-title">Plataformas de música</h2>
        <p className="settings-description">Escolha os serviços que podem ser usados para buscar e reproduzir músicas neste navegador. Desconectar remove o vínculo local; para revogar o acesso OAuth do Spotify, remova também o Harmony nas configurações da sua conta Spotify.</p>
        {musicNotice && <p className="notice" role="status">{musicNotice}</p>}
        <div className="music-service-list">
          <article className="music-service">
            <div>
              <b>Spotify</b>
              <span>{connections.spotify ? 'Conectado neste navegador' : 'Não conectado'}</span>
            </div>
            <button type="button" className={connections.spotify ? 'secondary' : 'primary'} onClick={() => toggleMusicPlatform('spotify')}>
              {connections.spotify ? 'Desconectar' : 'Conectar'}
            </button>
          </article>
          <article className="music-service">
            <div>
              <b>YouTube Music</b>
              <span>{connections.youtube ? 'Ativado neste navegador' : 'Não ativado'}</span>
            </div>
            <button type="button" className={connections.youtube ? 'secondary' : 'primary'} onClick={() => toggleMusicPlatform('youtube')} disabled={!connections.youtube && !youtubeApiKey()}>
              {connections.youtube ? 'Desativar' : 'Ativar'}
            </button>
          </article>
        </div>
        {!youtubeApiKey() && <p className="hint">A busca do YouTube precisa ser configurada pelo administrador do site com VITE_YOUTUBE_API_KEY. Nenhuma conta Google ou assinatura Premium é necessária para usar o player incorporado.</p>}
      </section>
      <section className="settings-section" aria-labelledby="settings-account-title">
        <h2 id="settings-account-title">Conta</h2>
        <p className="settings-description">Seus dados públicos e preferências do Harmony.</p>
        <form className="settings-form" onSubmit={saveAccount}>
          <label htmlFor="settings-display-name">Nome de exibição</label>
          <input id="settings-display-name" value={profileForm.display_name} maxLength="80" onChange={(event) => setProfileForm({ ...profileForm, display_name: event.target.value })} required />
          <label htmlFor="settings-username">Nome de usuário</label>
          <input id="settings-username" value={profileForm.username} maxLength="30" autoComplete="username" onChange={(event) => setProfileForm({ ...profileForm, username: event.target.value })} required />
          <button className="primary" disabled={Boolean(busy)}>{busy === 'account' ? 'Salvando...' : 'Salvar configurações'}</button>
        </form>
        <form className="settings-form preferences-form" onSubmit={savePreferences}>
          <h3>Preferências privadas</h3>
          <label className="settings-toggle">
            <input type="checkbox" checked={preferencesForm.chat_notifications_enabled} onChange={(event) => setPreferencesForm({ ...preferencesForm, chat_notifications_enabled: event.target.checked })} />
            <span>Permitir notificações de novas mensagens</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={preferencesForm.default_playlist_public} onChange={(event) => setPreferencesForm({ ...preferencesForm, default_playlist_public: event.target.checked })} />
            <span>Criar playlists públicas por padrão</span>
          </label>
          <button className="secondary" disabled={Boolean(busy)}>{busy === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button>
        </form>
        <form className="settings-form settings-email-form" onSubmit={requestEmailChange}>
          <h3>Alterar e-mail de login</h3>
          <p>E-mail atual: <b>{app.user.email}</b></p>
          {pendingEmail ? (
            <div className="pending-email">
              <p role="status">Aguardando confirmação do novo e-mail: <b>{pendingEmail}</b></p>
              <div className="settings-actions">
                <button type="button" className="secondary" onClick={resendEmailChange} disabled={Boolean(busy)}>{busy === 'resend-email' ? 'Reenviando...' : 'Reenviar link'}</button>
                <button type="button" className="text-button" onClick={cancelEmailChange} disabled={Boolean(busy)}>{busy === 'cancel-email' ? 'Cancelando...' : 'Cancelar solicitação'}</button>
              </div>
            </div>
          ) : (
            <>
              {!emailProvider && <p className="hint">Esta conta usa login social e não possui senha de e-mail para reautenticação.</p>}
              <label htmlFor="settings-new-email">Novo e-mail</label>
              <input id="settings-new-email" type="email" autoComplete="email" value={emailForm.email} onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })} required />
              <PasswordField id="email-current-password" label="Senha atual" value={emailForm.password} onChange={(password) => setEmailForm({ ...emailForm, password })} show={Boolean(showPasswords.email)} onToggle={() => togglePassword('email')} autoComplete="current-password" />
              <button className="secondary" disabled={Boolean(busy) || !emailProvider}>{busy === 'email' ? 'Enviando solicitação...' : 'Solicitar alteração'}</button>
            </>
          )}
        </form>
      </section>

      <section className="settings-section" aria-labelledby="settings-security-title">
        <h2 id="settings-security-title">Segurança</h2>
        <p className="settings-description">Reautentique com a senha atual para fazer alterações sensíveis.</p>
        {!emailProvider && <p className="hint">Sua conta usa login social. A troca de senha deve ser feita pelo provedor de autenticação.</p>}
        <form className="settings-form" onSubmit={changePassword}>
          <h3>Alterar senha</h3>
          <PasswordField id="current-password" label="Senha atual" value={passwordForm.current} onChange={(current) => setPasswordForm({ ...passwordForm, current })} show={Boolean(showPasswords.current)} onToggle={() => togglePassword('current')} autoComplete="current-password" />
          <PasswordField id="new-password" label="Nova senha" value={passwordForm.next} onChange={(next) => setPasswordForm({ ...passwordForm, next })} show={Boolean(showPasswords.next)} onToggle={() => togglePassword('next')} autoComplete="new-password" />
          <div className={`password-strength strength-${strength.score}`} aria-live="polite">
            <span>Força da senha: <b>{strength.label}</b></span>
            <span className="strength-meter" aria-hidden="true"><i style={{ width: `${(strength.score / 5) * 100}%` }} /></span>
          </div>
          <PasswordField id="confirm-password" label="Confirmar nova senha" value={passwordForm.confirmation} onChange={(confirmation) => setPasswordForm({ ...passwordForm, confirmation })} show={Boolean(showPasswords.confirmation)} onToggle={() => togglePassword('confirmation')} autoComplete="new-password" />
          <p className="hint">Mínimo de 8 caracteres, com pelo menos uma letra e um número. Após a troca, as outras sessões serão encerradas.</p>
          <button className="primary" disabled={Boolean(busy) || !emailProvider}>{busy === 'password' ? 'Atualizando senha...' : 'Alterar senha'}</button>
        </form>
        <div className="settings-form recovery-card">
          <h3>Recuperação de senha</h3>
          <p>Enviaremos um link de uso único para o endereço associado à conta.</p>
          <button type="button" className="secondary" onClick={sendRecovery} disabled={Boolean(busy)}>{busy === 'recovery' ? 'Enviando...' : 'Enviar link de recuperação'}</button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-sessions-title">
        <h2 id="settings-sessions-title">Sessões</h2>
        <p className="settings-description">A sessão atual está ativa neste navegador. O Supabase permite encerrar todas as outras sessões, mas não disponibiliza pela API cliente uma lista confiável de dispositivos individuais.</p>
        <article className="active-session">
          <div><b>{browserDescription()}</b><span>Este dispositivo · sessão atual</span><small>Último login da conta: {session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString('pt-BR') : 'agora'}</small></div>
          <button className="secondary" type="button" onClick={endOtherSessions} disabled={Boolean(busy)}>{busy === 'sessions' ? 'Encerrando...' : 'Sair de todos os outros dispositivos'}</button>
        </article>
        <button className="text-button" type="button" onClick={endCurrentSession} disabled={Boolean(busy)}>{busy === 'current-session' ? 'Encerrando...' : 'Encerrar sessão deste dispositivo'}</button>
      </section>

      <section className="settings-section danger-zone settings-danger" aria-labelledby="settings-danger-title">
        <h2 id="settings-danger-title"><ShieldCheck /> Zona de perigo</h2>
        <p className="settings-description">A exclusão remove permanentemente perfil, playlists, mensagens, preferências e arquivos associados.</p>
        <form className="settings-form" onSubmit={deleteAccount}>
          {!emailProvider && <p className="hint">A exclusão exige senha de e-mail para reautenticação. Esta conta usa login social.</p>}
          <PasswordField id="delete-current-password" label="Senha atual" value={deleteForm.password} onChange={(password) => setDeleteForm({ ...deleteForm, password })} show={Boolean(showPasswords.delete)} onToggle={() => togglePassword('delete')} autoComplete="current-password" />
          <label htmlFor="delete-confirmation">Digite EXCLUIR para confirmar</label>
          <input id="delete-confirmation" value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} required />
          <button className="danger-button" disabled={Boolean(busy) || !emailProvider}>{busy === 'delete' ? 'Excluindo conta...' : 'Excluir minha conta'}</button>
        </form>
      </section>
    </Page>
  )
}
