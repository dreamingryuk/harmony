import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Requires an authenticated caller. The service-role key stays only inside the
 * Supabase runtime, where it is used to remove owned Storage files before the
 * Auth user is deleted.
 */
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Delete-account function is missing required Supabase configuration.')
    return Response.json(
      { error: 'Serviço de exclusão temporariamente indisponível.' },
      { status: 500, headers: corsHeaders }
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return Response.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
  }

  let body: { confirmation?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400, headers: corsHeaders })
  }
  if (body.confirmation !== 'EXCLUIR' || typeof body.password !== 'string' || !body.password) {
    return Response.json({ error: 'Confirmação inválida.' }, { status: 400, headers: corsHeaders })
  }

  const email = userData.user.email
  if (!email) {
    return Response.json(
      { error: 'Esta conta não possui senha por e-mail para reautenticação.' },
      { status: 400, headers: corsHeaders }
    )
  }
  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: passwordError } = await verifier.auth.signInWithPassword({
    email,
    password: body.password,
  })
  if (passwordError) {
    const { error: cleanupError } = await verifier.auth.signOut({ scope: 'local' })
    if (cleanupError) console.error('Could not close a rejected password verification session.')
    return Response.json(
      { error: 'Não foi possível confirmar sua senha. Verifique-a e tente novamente.' },
      { status: 403, headers: corsHeaders }
    )
  }
  const { error: verifierSignOutError } = await verifier.auth.signOut({ scope: 'local' })
  if (verifierSignOutError) {
    console.error('Could not close the temporary password verification session.')
    return Response.json(
      { error: 'Não foi possível concluir a reautenticação. Tente novamente.' },
      { status: 500, headers: corsHeaders }
    )
  }

  const userId = userData.user.id
  const { data: files, error: listError } = await admin.storage.from('avatars').list(userId)
  if (listError) {
    console.error('Could not list avatars before account deletion:', listError.message)
    return Response.json(
      { error: 'Não foi possível preparar os arquivos para exclusão. Tente novamente.' },
      { status: 500, headers: corsHeaders }
    )
  }
  if (files?.length) {
    const { error: removeError } = await admin.storage
      .from('avatars')
      .remove(files.map((file) => `${userId}/${file.name}`))
    if (removeError) {
      return Response.json(
        { error: 'Não foi possível remover o avatar. Tente novamente.' },
        { status: 500, headers: corsHeaders }
      )
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500, headers: corsHeaders })
  }
  return Response.json({ ok: true }, { headers: corsHeaders })
})
