import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { useSynq, useUnreadMessages } from './hooks/useSynq'
import { Shell } from './components/Shell'
import { Auth } from './pages/Auth'
import { Discover } from './pages/Discover'
import { Library } from './pages/Library'
import { Community } from './pages/Community'
import { Messages } from './pages/Messages'
import { Retrospective } from './pages/Retrospective'
import { Profile } from './pages/Profile'
import { AccountSettings } from './pages/AccountSettings'
import { ResetPassword } from './pages/ResetPassword'
import { SpotifyCallback } from './pages/SpotifyCallback'
import './App.css'

function AppRoutes() {
  const location = useLocation()
  const baseApp = useSynq()
  const unread = useUnreadMessages(
    baseApp.user?.id,
    baseApp.preferences?.chat_notifications_enabled === true
  )
  const app = { ...baseApp, ...unread }
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
        <Route path="/retrospectiva" element={<Retrospective app={app} />} />
        <Route path="/perfil" element={<Profile app={app} />} />
        <Route path="/configuracoes" element={<AccountSettings app={app} />} />
        <Route path="/redefinir-senha" element={<ResetPassword app={app} />} />
        <Route path="/spotify/callback" element={<SpotifyCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
