import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Mantém o app navegável para quem ainda não configurou o Supabase.
export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null

export async function getProfile(userId) {
  if (!supabase || !userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data
}

export async function ensureProfile(user) {
  if (!supabase || !user) return null
  const existing = await getProfile(user.id)
  if (existing) return existing
  const profile = {
    id: user.id,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Novo ouvinte',
    username: `${(user.email?.split('@')[0] || 'ouvinte').replace(/[^a-zA-Z0-9_]/g, '_')}_${user.id.slice(0, 6)}`,
  }
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single()
  if (error) throw error
  return data
}
