import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { useSynq, useUnreadMessages } from './hooks/useSynq'
import { useMentionNotifications } from './hooks/useMentionNotifications'
import { Shell } from './components/Shell'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { SettingsErrorBoundary } from './components/SettingsErrorBoundary'
import { Auth } from './pages/Auth'
import { Discover } from './pages/Discover'
import { Library } from './pages/Library'
import { Community } from './pages/Community'
import { Messages } from './pages/Messages'
import { Notifications } from './pages/Notifications'
import { Retrospective } from './pages/Retrospective'
import { Profile } from './pages/Profile'
import { AccountSettings } from './pages/AccountSettings'
import { ResetPassword } from './pages/ResetPassword'
import './App.css'

const THEME_KEY = 'harmony-theme'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme) {
  const choice = theme === 'dark' || theme === 'light' ? theme : getSystemTheme()
  document.documentElement.dataset.theme = choice
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', choice === 'dark' ? '#0d1a1b' : '#f3f6f5')
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
        <Route path="/comunidade" element={<Community app={app} />} />
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
    const syncTheme = () => {
      const stored = localStorage.getItem(THEME_KEY)
      applyTheme(stored || 'auto')
    }
    syncTheme()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const current = localStorage.getItem(THEME_KEY)
      if (current === 'auto' || !current) applyTheme('auto')
    }
    media.addEventListener?.('change', onChange)
    const onStorage = (event) => {
      if (event.key === THEME_KEY) applyTheme(event.newValue || 'auto')
    }
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener?.('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AppRoutes />
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
