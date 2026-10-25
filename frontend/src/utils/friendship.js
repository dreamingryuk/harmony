// Acontece enquanto a migration de amizades ainda não foi aplicada no banco.
export const tabelaDeAmizadeAusente = (error) =>
  error?.code === '42P01' ||
  error?.code === 'PGRST205' ||
  /Could not find the table/i.test(error?.message || '')

export const avisoDeMigracao =
  'Rode o arquivo supabase/friendships.sql no SQL Editor do Supabase para liberar as amizades.'
