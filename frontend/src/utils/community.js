import { Globe, Lock, UserCheck } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'

// Acontece enquanto a migração de fóruns ainda não foi aplicada no banco.
export const tabelaDeComunidadeAusente = (error) =>
  error?.code === '42P01' ||
  error?.code === 'PGRST205' ||
  /Could not find the table/i.test(error?.message || '')

export const avisoDeMigracaoComunidades =
  'Rode o arquivo supabase/community-forums.sql no SQL Editor do Supabase para liberar os fóruns de comunidade.'

// Os três tipos de entrada aceitos na criação e na edição de uma comunidade.
export const PRIVACIDADES = {
  publica: {
    rotulo: 'Público',
    resumo: 'Todos podem entrar, sem aprovação nem senha.',
    icone: Globe,
  },
  por_convite: {
    rotulo: 'Público com verificação',
    resumo: 'Entra quem enviar a solicitação e o dono permitir.',
    icone: UserCheck,
  },
  privada: {
    rotulo: 'Privado',
    resumo: 'É preciso colocar a senha para entrar.',
    icone: Lock,
  },
}

// Mesmo padrão do banco: slug em minúsculas, com apenas letras, números e hífen.
export const slugify = (texto = '') => {
  const base = String(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base.length >= 3 ? base.slice(0, 26) : `comunidade-${Date.now().toString(36)}`
}

// Em qual fórum uma publicação está, para levar a notificação até lá.
export async function comunidadeDoPost(postId) {
  if (!configured || !postId) return null
  const { data, error } = await supabase
    .from('posts')
    .select('id, comunidade:comunidades(slug)')
    .eq('id', postId)
    .maybeSingle()
  if (error || !data) return null
  return data.comunidade?.slug || null
}

// Abre a publicação citada na notificação dentro do fórum certo.
export async function abrirPost(navigate, postId, notificationId) {
  const slug = await comunidadeDoPost(postId)
  const destino = slug ? `/comunidades/${slug}` : '/comunidades'
  navigate(
    notificationId ? `${destino}?notificacao=${encodeURIComponent(notificationId)}` : destino
  )
}

// Envia uma imagem para o bucket de comunidades e devolve a URL pública.
export async function enviarImagemComunidade(bucket, userId, file) {
  const extensao = (file.type.split('/')[1] || 'webp').replace('jpeg', 'jpg')
  const caminho = `${userId}/comunidade-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}.${extensao}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(caminho, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(caminho)
  return data?.publicUrl || ''
}

export const imagemValida = (file) =>
  Boolean(file) &&
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
  file.size <= 5 * 1024 * 1024

// Mensagem amigável quando a migração ainda não rodou.
export const erroDeComunidade = (error, fallback) => {
  if (tabelaDeComunidadeAusente(error)) return avisoDeMigracaoComunidades
  // Função RPC ausente: as migrações de fórum e de dono ainda não foram aplicadas.
  if (error?.code === 'PGRST202' || /Could not find the function/i.test(error?.message || '')) {
    return (
      'Rode os arquivos supabase/community-forums.sql e supabase/community-owner.sql ' +
      'no SQL Editor do Supabase para liberar as funções das comunidades.'
    )
  }
  return `${fallback}: ${error?.message || error}`
}

// O que cada resposta das funções de entrada significa para a pessoa.
const MENSAGENS_ENTRADA = {
  ok: 'Você entrou na comunidade.',
  pendente: 'Pedido enviado. O admin vai responder em breve.',
  ja_membro: 'Você já é membro desta comunidade.',
  aprovacao: 'Esta comunidade só entra quem o dono aprovar.',
  senha_invalida: 'Senha incorreta.',
  senha: 'Esta comunidade exige a senha para entrar.',
  nao_encontrada: 'Esta comunidade não existe mais.',
  nao_autenticado: 'Entre com a sua conta para participar.',
  nao_autorizado: 'Só o dono da comunidade pode fazer isso.',
  nao_membro: 'Você não é membro desta comunidade.',
  dono: 'O dono não pode sair da própria comunidade.',
  banido: 'Você não pode entrar nesta comunidade.',
  sem_pedido: 'Não há pedido pendente para esta pessoa.',
  sem_comunidade: 'A migração das comunidades ainda não foi aplicada.',
  nome_invalido: 'O título precisa ter entre 3 e 32 caracteres.',
  descricao_invalida: 'A descrição pode ter no máximo 300 caracteres.',
  privacidade_invalida: 'Escolha uma privacidade válida.',
  nome_ocupado: 'Já existe uma comunidade com este título. Escolha outro.',
  senha_obrigatoria: 'Informe uma senha para deixar a comunidade privada.',
  senha_curta: 'A senha precisa ter pelo menos 4 caracteres.',
  proprio_dono: 'O dono não pode ser removido da própria comunidade.',
  sem_membro: 'Esta pessoa não faz parte da comunidade.',
  sem_post: 'Esta publicação não existe mais.',
  post_fora: 'Esta publicação não faz parte desta comunidade.',
}

export const mensagemDeEntrada = (codigo) =>
  MENSAGENS_ENTRADA[codigo] || 'Não foi possível concluir a ação.'
