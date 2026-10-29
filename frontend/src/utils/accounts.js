const KEY = 'harmony-saved-accounts'
export const ACCOUNT_LIMIT = 5

export function savedAccounts() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

export function rememberAccount(session) {
  if (!session?.user?.id || !session.access_token || !session.refresh_token) return savedAccounts()
  const record = {
    id: session.user.id,
    email: session.user.email || '',
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || 0,
  }
  const existing = savedAccounts().filter((account) => account.id !== record.id)
  const next = [record, ...existing].slice(0, ACCOUNT_LIMIT)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function forgetAccount(id) {
  const next = savedAccounts().filter((account) => account.id !== id)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearAccounts() { localStorage.removeItem(KEY) }
