import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Cancel-email-change function is missing required Supabase configuration.')
    return Response.json(
      { error: 'Serviço de e-mail temporariamente indisponível.' },
      { status: 500, headers: corsHeaders }
    )
  }

  const token = authorization.slice('Bearer '.length)
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) {
    return Response.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
  }
  if (!data.user.new_email || !data.user.email) {
    return Response.json({ error: 'Não há alteração de e-mail pendente.' }, { status: 409, headers: corsHeaders })
  }

  const { error: cancelError } = await admin.auth.admin.updateUserById(data.user.id, {
    email: data.user.email,
    email_confirm: true,
  })
  if (cancelError) {
    console.error('Could not cancel the pending email change:', cancelError.message)
    return Response.json(
      { error: 'Não foi possível cancelar a alteração de e-mail.' },
      { status: 500, headers: corsHeaders }
    )
  }

  return Response.json({ cancelled: true }, { headers: corsHeaders })
})
