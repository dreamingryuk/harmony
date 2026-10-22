import { createClient } from 'npm:@supabase/supabase-js@2'
import sharp from 'npm:sharp@0.33.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const maxUploadBytes = 5 * 1024 * 1024
const bucket = 'avatars'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

function isSupportedImage(bytes: Uint8Array) {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return jpeg || png || webp
}

function getOwnedAvatarPath(avatarUrl: string | null, userId: string) {
  if (!avatarUrl) return null
  try {
    const pathname = new URL(avatarUrl).pathname
    const marker = `/storage/v1/object/public/${bucket}/`
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex < 0) return null
    const path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
    if (!path.startsWith(`${userId}/`) || path.split('/').includes('..')) return null
    return path
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sessão inválida. Entre novamente.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Avatar endpoint is missing required Supabase configuration.')
    return jsonResponse({ error: 'Serviço de foto temporariamente indisponível.' }, 500)
  }

  const token = authorization.slice('Bearer '.length)
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: authData, error: authError } = await caller.auth.getUser(token)
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Sessão expirada. Entre novamente.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userId = authData.user.id
  const { data: profile, error: profileReadError } = await admin
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (profileReadError) {
    console.error('Could not load the avatar profile:', profileReadError.message)
    return jsonResponse({ error: 'Não foi possível carregar o perfil.' }, 500)
  }
  if (!profile) return jsonResponse({ error: 'Perfil não encontrado.' }, 404)

  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > maxUploadBytes + 64 * 1024) {
    return jsonResponse({ error: 'A imagem é grande demais. O limite é 5 MB.' }, 413)
  }

  if (request.headers.get('Content-Type')?.includes('application/json')) {
    let body: { action?: string }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Solicitação inválida.' }, 400)
    }
    if (body.action !== 'remove') {
      return jsonResponse({ error: 'Ação inválida.' }, 400)
    }

    const previousPath = getOwnedAvatarPath(profile.avatar_url, userId)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
    if (updateError) {
      console.error('Could not clear the avatar profile field:', updateError.message)
      return jsonResponse({ error: 'Não foi possível remover a foto do perfil.' }, 500)
    }
    if (previousPath) {
      const { error: removeError } = await admin.storage.from(bucket).remove([previousPath])
      if (removeError) {
        console.error('Could not remove the previous avatar:', removeError.message)
        return jsonResponse({
          error: 'A foto foi removida do perfil, mas não foi possível limpar o arquivo antigo.',
        }, 500)
      }
    }
    return jsonResponse({ avatar_url: null })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonResponse({ error: 'Envie uma imagem JPEG, PNG ou WebP.' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File)) return jsonResponse({ error: 'Selecione uma imagem.' }, 400)
  if (file.size > maxUploadBytes) {
    return jsonResponse({ error: 'A imagem é grande demais. O limite é 5 MB.' }, 413)
  }
  if (file.size === 0) return jsonResponse({ error: 'O arquivo de imagem está vazio.' }, 400)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isSupportedImage(bytes)) {
    return jsonResponse({ error: 'Formato inválido. Envie uma imagem JPEG, PNG ou WebP válida.' }, 415)
  }

  let optimized: Uint8Array
  try {
    optimized = await sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .webp({ quality: 84, effort: 4 })
      .toBuffer()
  } catch {
    return jsonResponse({ error: 'O arquivo não contém uma imagem válida ou não pôde ser processado.' }, 415)
  }

  const path = `${userId}/${crypto.randomUUID()}.webp`
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, new Blob([optimized], { type: 'image/webp' }), {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    console.error('Could not save the processed avatar:', uploadError.message)
    return jsonResponse({ error: 'Não foi possível salvar a foto. Tente novamente.' }, 500)
  }

  const { data: publicUrl } = admin.storage.from(bucket).getPublicUrl(path)
  const { error: updateError } = await admin
    .from('profiles')
    .update({ avatar_url: publicUrl.publicUrl })
    .eq('id', userId)
  if (updateError) {
    console.error('Could not update the avatar profile field:', updateError.message)
    const { error: cleanupError } = await admin.storage.from(bucket).remove([path])
    if (cleanupError) console.error('Could not clean up an unused avatar:', cleanupError.message)
    return jsonResponse({ error: 'Não foi possível atualizar a foto do perfil.' }, 500)
  }

  const previousPath = getOwnedAvatarPath(profile.avatar_url, userId)
  if (previousPath && previousPath !== path) {
    const { error: removeError } = await admin.storage.from(bucket).remove([previousPath])
    if (removeError) {
      console.error('Could not remove the previous avatar:', removeError.message)
      return jsonResponse({
        error: 'A foto foi atualizada, mas não foi possível limpar o arquivo antigo.',
        avatar_url: publicUrl.publicUrl,
      }, 500)
    }
  }

  return jsonResponse({ avatar_url: publicUrl.publicUrl })
})
