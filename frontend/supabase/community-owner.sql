-- Harmony: funções do dono da comunidade (fóruns)
-- Execute este arquivo no SQL Editor do Supabase depois de community-forums.sql.
-- A migração é idempotente: rodar mais de uma vez não duplica nada.
--
-- O que este arquivo faz:
--   1. atualizar_comunidade: o dono muda título, descrição, ícone, banner,
--      privacidade e senha do fórum em uma única chamada.
--   2. remover_membro_comunidade: o dono tira alguém da comunidade.
--   3. apagar_post_comunidade: o dono apaga qualquer post do próprio fórum.
--
-- Todas são SECURITY DEFINER: aplicam a regra do dono no banco, sem depender de
-- o cliente conseguir alterar a tabela de senhas (que é inacessível a ele).

-- ---------------------------------------------------------------------------
-- 1. Atualizar os dados do fórum
--   * p_senha nula mantém a senha atual (só faz sentido em comunidade privada).
--   * Mudar para privado sem senha e sem senha atual devolve 'senha_obrigatoria'.
--   * Sair de 'privada' apaga a senha guardada, então voltar para privado
--     exige uma senha nova.
--   * O slug (endereço do fórum) não muda, para não quebrar links.
-- ---------------------------------------------------------------------------
create or replace function public.atualizar_comunidade(
  p_slug text,
  p_nome text,
  p_descricao text default '',
  p_icone_url text default null,
  p_banner_url text default null,
  p_visibilidade text default 'publica',
  p_senha text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c record;
  v_nome text;
  v_descricao text;
  v_visibilidade text;
  v_senha text;
  v_tem_senha boolean;
begin
  if v_uid is null then
    return 'nao_autenticado';
  end if;

  select * into v_c from public.comunidades where slug = p_slug;
  if not found then
    return 'nao_encontrada';
  end if;

  if v_c.dono_id <> v_uid then
    return 'nao_autorizado';
  end if;

  v_nome := trim(coalesce(p_nome, ''));
  if char_length(v_nome) < 3 or char_length(v_nome) > 32 then
    return 'nome_invalido';
  end if;

  v_descricao := trim(coalesce(p_descricao, ''));
  if char_length(v_descricao) > 300 then
    return 'descricao_invalida';
  end if;

  v_visibilidade := coalesce(p_visibilidade, v_c.visibilidade);
  if v_visibilidade not in ('publica', 'por_convite', 'privada') then
    return 'privacidade_invalida';
  end if;

  if exists (
    select 1 from public.comunidades
    where nome = v_nome and id <> v_c.id
  ) then
    return 'nome_ocupado';
  end if;

  v_senha := nullif(trim(coalesce(p_senha, '')), '');
  select exists (
    select 1 from public.comunidade_senhas where comunidade_id = v_c.id
  ) into v_tem_senha;

  if v_visibilidade = 'privada' then
    if v_senha is not null and char_length(v_senha) < 4 then
      return 'senha_curta';
    end if;
    if v_senha is null and not (v_c.visibilidade = 'privada' and v_tem_senha) then
      return 'senha_obrigatoria';
    end if;
  end if;

  update public.comunidades
  set nome = v_nome,
      descricao = v_descricao,
      icone_url = nullif(trim(coalesce(p_icone_url, '')), ''),
      banner_url = nullif(trim(coalesce(p_banner_url, '')), ''),
      visibilidade = v_visibilidade
  where id = v_c.id;

  if v_visibilidade = 'privada' and v_senha is not null then
    insert into public.comunidade_senhas (comunidade_id, senha_hash)
    values (v_c.id, public.hash_comunidade_senha(v_c.slug, v_senha))
    on conflict (comunidade_id) do update
      set senha_hash = excluded.senha_hash,
          criada_em = now();
  end if;

  if v_visibilidade <> 'privada' then
    delete from public.comunidade_senhas where comunidade_id = v_c.id;
  end if;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. O dono remove alguém da comunidade
-- ---------------------------------------------------------------------------
create or replace function public.remover_membro_comunidade(p_slug text, p_usuario_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c record;
begin
  if v_uid is null then
    return 'nao_autenticado';
  end if;

  select * into v_c from public.comunidades where slug = p_slug;
  if not found then
    return 'nao_encontrada';
  end if;

  if v_c.dono_id <> v_uid then
    return 'nao_autorizado';
  end if;

  if p_usuario_id is null or p_usuario_id = v_uid then
    return 'proprio_dono';
  end if;

  if not exists (
    select 1 from public.comunidade_membros
    where comunidade_id = v_c.id and usuario_id = p_usuario_id
  ) then
    return 'sem_membro';
  end if;

  delete from public.comunidade_membros
  where comunidade_id = v_c.id and usuario_id = p_usuario_id;

  delete from public.comunidade_pedidos
  where comunidade_id = v_c.id and usuario_id = p_usuario_id;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. O dono apaga um post do próprio fórum
-- Curtidas, respostas e notificações do post vão junto (onDelete cascade).
-- ---------------------------------------------------------------------------
create or replace function public.apagar_post_comunidade(p_slug text, p_post_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c record;
  v_post record;
begin
  if v_uid is null then
    return 'nao_autenticado';
  end if;

  select * into v_c from public.comunidades where slug = p_slug;
  if not found then
    return 'nao_encontrada';
  end if;

  if v_c.dono_id <> v_uid then
    return 'nao_autorizado';
  end if;

  select * into v_post from public.posts where id = p_post_id;
  if not found then
    return 'sem_post';
  end if;

  if v_post.comunidade_id is null or v_post.comunidade_id <> v_c.id then
    return 'post_fora';
  end if;

  delete from public.posts where id = v_post.id;

  return 'ok';
end;
$$;
