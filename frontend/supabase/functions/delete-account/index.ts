import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
  )
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return Response.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
  }

  const { confirmation } = await request.json().catch(() => ({}))
  if (confirmation !== 'EXCLUIR') {
    return Response.json({ error: 'Confirmação inválida.' }, { status: 400, headers: corsHeaders })
  }

  const userId = userData.user.id
  const { data: files, error: listError } = await admin.storage.from('avatars').list(userId)
  if (listError) console.error('Não foi possível listar avatares:', listError.message)
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
