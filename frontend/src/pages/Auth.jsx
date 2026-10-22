import { useState } from 'react'
import { Music2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [register, setRegister] = useState(false),
    [forgotPassword, setForgotPassword] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const [oauthBusy, setOauthBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        })
        if (error) throw error
        setMessage('Se esse endereço estiver cadastrado, você receberá um link para redefinir a senha.')
      } else {
        const result = register
          ? await supabase.auth.signUp({ email: email.trim(), password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
        setMessage(register ? 'Conta criada. Confira seu e-mail.' : 'Entrando...')
      }
    } catch (error) {
      setMessage(
        forgotPassword
          ? 'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.'
          : error.message || 'Não foi possível concluir a autenticação.'
      )
    } finally {
      setBusy(false)
    }
  }
  const signInWithGoogle = async () => {
    setOauthBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (error) {
      setMessage(error.message || 'Não foi possível iniciar a autenticação com Google.')
      setOauthBusy(false)
    }
  }
  return (
    <main className="auth">
      <section className="auth-art">
        <div className="brand">
          <Music2 /> Harmony
        </div>
        <div className="equalizer">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ height: `${18 + ((i * 13) % 70)}px` }} />
          ))}
        </div>
        <h1>
          Seu som.
          <br />
          Sua comunidade.
        </h1>
        <p>Descubra, compartilhe e guarde os momentos que viraram trilha sonora.</p>
      </section>
      <section className="auth-form">
        <h2>{forgotPassword ? 'Recuperar senha' : register ? 'Crie seu espaço' : 'Bem-vindo de volta'}</h2>
        <p>{forgotPassword ? 'Enviaremos um link se a conta existir.' : 'Entre para continuar ouvindo.'}</p>
        {!forgotPassword && <div className="switch">
          <button className={!register ? 'active' : ''} onClick={() => setRegister(false)}>
            Entrar
          </button>
          <button className={register ? 'active' : ''} onClick={() => setRegister(true)}>
            Criar conta
          </button>
        </div>}
        <form onSubmit={submit}>
          <label>
            E-mail
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {!forgotPassword && <label>
            Senha
            <input
              required
              minLength={register ? 8 : undefined}
              pattern={register ? '(?=.*[A-Za-z])(?=.*\\d).{8,}' : undefined}
              title={register ? 'Use pelo menos 8 caracteres, com uma letra e um número.' : undefined}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>}
          <button className="primary" disabled={busy}>
            {busy ? 'Aguarde...' : forgotPassword ? 'Enviar link' : register ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        {!forgotPassword && <button type="button" className="secondary" onClick={signInWithGoogle} disabled={oauthBusy}>
          {oauthBusy ? 'Conectando...' : 'Continuar com Google'}
        </button>}
        <button
        type="button"
        className="text-button"
        onClick={() => {
          setForgotPassword((current) => !current)
          setMessage('')
        }}
        >
        {forgotPassword ? 'Voltar para entrar' : 'Esqueci minha senha'}
        </button>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  )
}
