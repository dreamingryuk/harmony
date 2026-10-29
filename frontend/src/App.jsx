import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { applyTheme, getStoredTheme, THEME_STORAGE_KEY } from './lib/themes'
import { useSynq, useUnreadMessages } from './hooks/useSynq'
import { useMentionNotifications } from './hooks/useMentionNotifications'
import { Shell } from './components/Shell'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { SettingsErrorBoundary } from './components/SettingsErrorBoundary'
import { Auth } from './pages/Auth'
import { Discover } from './pages/Discover'
import { Library } from './pages/Library'
import { Communities } from './pages/Communities'
import { Community } from './pages/Community'
import { Messages } from './pages/Messages'
import { Notifications } from './pages/Notifications'
import { Retrospective } from './pages/Retrospective'
import { Profile } from './pages/Profile'
import { AccountSettings } from './pages/AccountSettings'
import { ResetPassword } from './pages/ResetPassword'
import './App.css'

// Mantém a query string ao redirecionar rotas antigas (ex.: ?notificacao=...).
function RedirectSearch({ to }) {
  const location = useLocation()
  return <Navigate to={{ pathname: to, search: location.search }} replace />
}

function AppRoutes() {
  const location = useLocation()
  const baseApp = useSynq()
  const unread = useUnreadMessages(
    baseApp.user?.id,
    baseApp.preferences?.chat_notifications_enabled === true
  )
  const mentions = useMentionNotifications(baseApp.user?.id)
  const app = { ...baseApp, ...unread, ...mentions }
  if (!app.ready) return <main className="callback">Carregando Harmony...</main>
  if (configured && !app.user) return <Auth />
  if (app.passwordRecovery && location.pathname !== '/redefinir-senha') {
    return <Navigate to="/redefinir-senha" replace />
  }
  return (
    <Shell app={app}>
      <Routes>
        <Route path="/" element={<Discover app={app} />} />
        <Route path="/biblioteca" element={<Library app={app} />} />
        <Route path="/comunidade" element={<RedirectSearch to="/comunidades" />} />
        <Route path="/comunidades" element={<Communities app={app} />} />
        <Route path="/comunidades/:slug" element={<Community app={app} />} />
        <Route path="/comunidades/:slug/:canal" element={<Community app={app} />} />
        <Route path="/convite/:codigo" element={<RedirectSearch to="/comunidades" />} />
        <Route path="/mensagens" element={<Messages app={app} />} />
        <Route path="/notificacoes" element={<Notifications app={app} />} />
        <Route path="/retrospectiva" element={<Retrospective app={app} />} />
        <Route path="/perfil" element={<Profile app={app} />} />
        <Route
          path="/configuracoes"
          element={
            <SettingsErrorBoundary>
              <AccountSettings app={app} />
            </SettingsErrorBoundary>
          }
        />
        <Route path="/redefinir-senha" element={<ResetPassword app={app} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  useEffect(() => {
    // Garante que o tema salvo (ou o padrão) fique aplicado em todas as páginas.
    applyTheme(getStoredTheme())
    // Outra aba alterou o tema: re-aplica aqui.
    const onStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AppRoutes />
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
