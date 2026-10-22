import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Page } from '../components/Media'
import { PasswordField } from '../components/PasswordField'
import { passwordPolicyError, passwordStrength } from '../utils/account'

export function ResetPassword({ app }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [show, setShow] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [completed, setCompleted] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const policyError = passwordPolicyError(password)
    if (policyError) return setNotice(policyError)
    if (password !== confirmation) return setNotice('A confirmação da senha não confere.')
    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setCompleted(true)
      app.setPasswordRecovery(false)
      setNotice('Senha redefinida com sucesso.')
    } catch (error) {
      setNotice(error.message || 'Não foi possível redefinir a senha. Solicite um novo link.')
    } finally {
      setBusy(false)
    }
  }

  if (completed) {
    return (
      <Page title="Senha atualizada" subtitle="Sua senha foi redefinida com sucesso.">
        <button className="primary" onClick={() => navigate('/', { replace: true })}>Continuar para o Harmony</button>
      </Page>
    )
  }
  if (!app.passwordRecovery) return <Navigate to="/" replace />
  return (
    <Page title="Redefinir senha" subtitle="Escolha uma senha nova para sua conta.">
      <form className="settings-form reset-password-form" onSubmit={submit}>
        <PasswordField id="recovery-new-password" label="Nova senha" value={password} onChange={setPassword} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <div className={`password-strength strength-${passwordStrength(password).score}`} aria-live="polite">Força da senha: <b>{passwordStrength(password).label}</b></div>
        <PasswordField id="recovery-confirm-password" label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} show={showConfirmation} onToggle={() => setShowConfirmation(!showConfirmation)} autoComplete="new-password" />
        {notice && <p className="notice" role="alert">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Redefinir senha'}</button>
      </form>
    </Page>
  )
}
