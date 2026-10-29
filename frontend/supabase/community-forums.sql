-- Harmony: fóruns de comunidade (entrada aberta, com aprovação ou com senha)
-- Execute este arquivo no SQL Editor do Supabase depois de community-system.sql.
-- A migração é idempotente: rodar mais de uma vez não duplica dados.
--
-- O que este arquivo faz:
--   1. Cria o armazenamento das senhas de comunidade (nunca devolvido ao cliente).
--   2. Cria a fila de pedidos de entrada para comunidades com aprovação.
--   3. Ajusta o RLS para que só membros leiam e publiquem em comunidades fechadas.
--   4. Cria as funções de entrar, pedir entrada, sair e responder pedidos.
--   5. Move todos os posts existentes para a comunidade "Renato Lanches"
--      (privada, com senha), coloca quem já publicou como membro e apaga a
--      comunidade antiga "Aur6769".
--   6. Cria o bucket de imagens (ícone e banner) das comunidades.
--
-- Observação: depois desta migração não reexecute community-system.sql, porque
-- ele voltaria a criar a comunidade Aur6769.

-- ---------------------------------------------------------------------------
-- 1. Senhas das comunidades
-- O hash fica em uma tabela que o cliente não lê: só as funções security
-- definer abaixo conseguem comparar, então entrar continua exigindo a senha.
-- ---------------------------------------------------------------------------
create table if not exists public.comunidade_senhas (
  comunidade_id uuid primary key references public.comunidades(id) on delete cascade,
  senha_hash text not null,
  criada_em timestamptz not null default now()
);

alter table public.comunidade_senhas enable row level security;
revoke all on public.comunidade_senhas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pedidos de entrada (comunidade com aprovação do dono)
-- ---------------------------------------------------------------------------
create table if not exists public.comunidade_pedidos (
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  primary key (comunidade_id, usuario_id)
);

create index if not exists comunidade_pedidos_pendentes_idx
  on public.comunidade_pedidos(comunidade_id, criado_em)
  where status = 'pendente';

alter table public.comunidade_pedidos enable row level security;

drop policy if exists "pedidos visiveis" on public.comunidade_pedidos;
create policy "pedidos visiveis" on public.comunidade_pedidos
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.comunidades c
      where c.id = comunidade_pedidos.comunidade_id and c.dono_id = auth.uid()
    )
  );

drop policy if exists "usuarios pedem entrada" on public.comunidade_pedidos;
create policy "usuarios pedem entrada" on public.comunidade_pedidos
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.comunidades c
      where c.id = comunidade_pedidos.comunidade_id and c.visibilidade = 'por_convite'
    )
    and not exists (
      select 1 from public.comunidade_membros m
      where m.comunidade_id = comunidade_pedidos.comunidade_id and m.usuario_id = auth.uid()
    )
  );

drop policy if exists "dono responde pedidos" on public.comunidade_pedidos;
create policy "dono responde pedidos" on public.comunidade_pedidos
  for update to authenticated
  using (
    exists (
      select 1 from public.comunidades c
      where c.id = comunidade_pedidos.comunidade_id and c.dono_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.comunidades c
      where c.id = comunidade_pedidos.comunidade_id and c.dono_id = auth.uid()
    )
  );

drop policy if exists "pedido pode ser cancelado" on public.comunidade_pedidos;
create policy "pedido pode ser cancelado" on public.comunidade_pedidos
  for delete to authenticated
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.comunidades c
      where c.id = comunidade_pedidos.comunidade_id and c.dono_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Leitura de posts conforme a comunidade
-- SECURITY DEFINER evita a recursão de política (a função lê posts enquanto
-- é usada dentro de política) e continua usando o usuário autenticado.
-- ---------------------------------------------------------------------------
create or replace function public.post_visivel(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        p.comunidade_id is null
        or exists (
          select 1 from public.comunidade_membros m
          where m.comunidade_id = p.comunidade_id and m.usuario_id = auth.uid()
        )
      )
  );
$$;

-- Comunidades: qualquer pessoa vê nome, banner e privacidade para descobrir
-- os fóruns; o conteúdo continua protegido pelo RLS de posts.
drop policy if exists "comunidades visiveis" on public.comunidades;
create policy "comunidades visiveis" on public.comunidades
  for select to authenticated
  using (true);

-- Membros: a lista é pública para contar membros; entrar, sair e promover
-- passam pelas regras abaixo (e pelas funções da seção 4).
drop policy if exists "membros visiveis" on public.comunidade_membros;
drop policy if exists "membros visiveis da comunidade" on public.comunidade_membros;
drop policy if exists "membros gerenciam sua propria participacao" on public.comunidade_membros;

create policy "membros visiveis" on public.comunidade_membros
  for select to authenticated
  using (true);

-- Só o dono entra em comunidade fechada por aqui; em comunidade aberta o
-- próprio usuário pode se juntar, sempre como membro comum.
drop policy if exists "membros entram em comunidade aberta" on public.comunidade_membros;
create policy "membros entram em comunidade aberta" on public.comunidade_membros
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and (
      (
        papel = 'membro'
        and exists (
          select 1 from public.comunidades c
          where c.id = comunidade_membros.comunidade_id and c.visibilidade = 'publica'
        )
      )
      or exists (
        select 1 from public.comunidades c
        where c.id = comunidade_membros.comunidade_id and c.dono_id = auth.uid()
      )
    )
  );

drop policy if exists "membros atualizam proprio registro" on public.comunidade_membros;
create policy "membros atualizam proprio registro" on public.comunidade_membros
  for update to authenticated
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.comunidades c
      where c.id = comunidade_membros.comunidade_id and c.dono_id = auth.uid()
    )
  )
  with check (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.comunidades c
      where c.id = comunidade_membros.comunidade_id and c.dono_id = auth.uid()
    )
  );

drop policy if exists "dono remove membros" on public.comunidade_membros;
create policy "dono remove membros" on public.comunidade_membros
  for delete to authenticated
  using (
    exists (
      select 1 from public.comunidades c
      where c.id = comunidade_membros.comunidade_id and c.dono_id = auth.uid()
    )
  );

-- Posts: quem não é membro não lê, não curte e não responde.
drop policy if exists "posts visible" on public.posts;
drop policy if exists "own posts" on public.posts;
drop policy if exists "autores e admins gerenciam posts da comunidade" on public.posts;

drop policy if exists "posts visiveis" on public.posts;
create policy "posts visiveis" on public.posts
  for select to authenticated
  using (
    comunidade_id is null
    or exists (
      select 1 from public.comunidade_membros m
      where m.comunidade_id = posts.comunidade_id and m.usuario_id = auth.uid()
    )
  );

drop policy if exists "autores publicam na comunidade" on public.posts;
create policy "autores publicam na comunidade" on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      comunidade_id is null
      or exists (
        select 1 from public.comunidade_membros m
        where m.comunidade_id = posts.comunidade_id and m.usuario_id = auth.uid()
      )
    )
  );

drop policy if exists "autores editam seus posts" on public.posts;
create policy "autores editam seus posts" on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "autores e dono apagam posts" on public.posts;
create policy "autores e dono apagam posts" on public.posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.comunidade_membros m
      where m.comunidade_id = posts.comunidade_id
        and m.usuario_id = auth.uid()
        and m.papel = 'dono'
    )
  );

-- Curtidas, dislikes e respostas seguem a visibilidade do post.
drop policy if exists "likes visible" on public.post_likes;
create policy "likes visible" on public.post_likes
  for select to authenticated
  using (public.post_visivel(post_id));

drop policy if exists "own likes" on public.post_likes;
create policy "own likes" on public.post_likes
  for all to authenticated
  using (user_id = auth.uid() and public.post_visivel(post_id))
  with check (user_id = auth.uid() and public.post_visivel(post_id));

drop policy if exists "post dislikes are visible" on public.post_dislikes;
create policy "post dislikes are visible" on public.post_dislikes
  for select to authenticated
  using (public.post_visivel(post_id));

drop policy if exists "users manage own post dislikes" on public.post_dislikes;
create policy "users manage own post dislikes" on public.post_dislikes
  for all to authenticated
  using (user_id = auth.uid() and public.post_visivel(post_id))
  with check (user_id = auth.uid() and public.post_visivel(post_id));

drop policy if exists "post comments are visible" on public.post_comments;
create policy "post comments are visible" on public.post_comments
  for select to authenticated
  using (public.post_visivel(post_id));

drop policy if exists "users create own post comments" on public.post_comments;
create policy "users create own post comments" on public.post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.post_visivel(post_id)
  );

-- ---------------------------------------------------------------------------
-- 4. Funções de entrada e saída
-- Todas são SECURITY DEFINER: aplicam a regra da privacidade sem deixar o
-- cliente alterar a senha ou colar-se em comunidade fechada na marra.
-- ---------------------------------------------------------------------------
create or replace function public.hash_comunidade_senha(p_slug text, p_senha text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(p_senha || '::' || p_slug, 'UTF8')), 'hex');
$$;

create or replace function public.criar_comunidade(
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
  v_nome text;
  v_descricao text;
  v_base text;
  v_slug text;
  v_tentativa integer := 1;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Faça login para criar uma comunidade.';
  end if;

  v_nome := trim(coalesce(p_nome, ''));
  p_visibilidade := coalesce(p_visibilidade, 'publica');
  if char_length(v_nome) < 3 or char_length(v_nome) > 32 then
    raise exception 'O título precisa ter entre 3 e 32 caracteres.';
  end if;

  v_descricao := trim(coalesce(p_descricao, ''));
  if char_length(v_descricao) > 300 then
    raise exception 'A descrição pode ter no máximo 300 caracteres.';
  end if;

  if p_visibilidade not in ('publica', 'por_convite', 'privada') then
    raise exception 'Privacidade inválida.';
  end if;

  if p_visibilidade = 'privada' then
    if p_senha is null or char_length(p_senha) < 4 then
      raise exception 'Informe uma senha com pelo menos 4 caracteres.';
    end if;
  else
    p_senha := null;
  end if;

  v_base := trim(both '-' from regexp_replace(lower(v_nome), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_base) < 3 then
    v_base := 'comunidade-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  v_slug := left(v_base, 26);
  while exists (select 1 from public.comunidades where slug = v_slug) loop
    v_tentativa := v_tentativa + 1;
    v_slug := left(v_base, 26) || '-' || v_tentativa;
  end loop;

  insert into public.comunidades (nome, slug, descricao, icone_url, banner_url, dono_id, visibilidade)
  values (v_nome, v_slug, v_descricao, nullif(trim(coalesce(p_icone_url, '')), ''), nullif(trim(coalesce(p_banner_url, '')), ''), v_uid, p_visibilidade)
  returning id into v_id;

  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  values (v_id, v_uid, 'dono');

  if p_visibilidade = 'privada' then
    insert into public.comunidade_senhas (comunidade_id, senha_hash)
    values (v_id, public.hash_comunidade_senha(v_slug, p_senha));
  end if;

  return v_slug;
end;
$$;

create or replace function public.entrar_comunidade(p_slug text, p_senha text default null)
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

  if exists (
    select 1 from public.comunidade_membros m
    where m.comunidade_id = v_c.id and m.usuario_id = v_uid
  ) then
    return 'ja_membro';
  end if;

  if exists (
    select 1 from public.banimentos b
    where b.comunidade_id = v_c.id and b.usuario_id = v_uid
  ) then
    return 'banido';
  end if;

  if v_c.visibilidade = 'por_convite' then
    return 'aprovacao';
  end if;

  if v_c.visibilidade = 'privada' then
    if p_senha is null or not exists (
      select 1 from public.comunidade_senhas s
      where s.comunidade_id = v_c.id
        and s.senha_hash = public.hash_comunidade_senha(v_c.slug, p_senha)
    ) then
      return 'senha_invalida';
    end if;
  end if;

  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  values (v_c.id, v_uid, 'membro')
  on conflict do nothing;

  delete from public.comunidade_pedidos
  where comunidade_id = v_c.id and usuario_id = v_uid;

  return 'ok';
end;
$$;

create or replace function public.pedir_entrar_comunidade(p_slug text)
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

  if exists (
    select 1 from public.comunidade_membros m
    where m.comunidade_id = v_c.id and m.usuario_id = v_uid
  ) then
    return 'ja_membro';
  end if;

  if exists (
    select 1 from public.banimentos b
    where b.comunidade_id = v_c.id and b.usuario_id = v_uid
  ) then
    return 'banido';
  end if;

  -- Comunidade aberta: pedir é o mesmo que entrar.
  if v_c.visibilidade = 'publica' then
    insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
    values (v_c.id, v_uid, 'membro')
    on conflict do nothing;

    delete from public.comunidade_pedidos
    where comunidade_id = v_c.id and usuario_id = v_uid;

    return 'ok';
  end if;

  if v_c.visibilidade <> 'por_convite' then
    return 'senha';
  end if;

  insert into public.comunidade_pedidos (comunidade_id, usuario_id, status, criado_em, respondido_em)
  values (v_c.id, v_uid, 'pendente', now(), null)
  on conflict (comunidade_id, usuario_id) do update
    set status = 'pendente',
        criado_em = now(),
        respondido_em = null;

  return 'pendente';
end;
$$;

create or replace function public.sair_comunidade(p_slug text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_m record;
begin
  if v_uid is null then
    return 'nao_autenticado';
  end if;

  select m.* into v_m
  from public.comunidade_membros m
  join public.comunidades c on c.id = m.comunidade_id
  where c.slug = p_slug and m.usuario_id = v_uid;

  if not found then
    return 'nao_membro';
  end if;

  if v_m.papel = 'dono' then
    return 'dono';
  end if;

  delete from public.comunidade_membros
  where comunidade_id = v_m.comunidade_id and usuario_id = v_uid;

  delete from public.comunidade_pedidos
  where comunidade_id = v_m.comunidade_id and usuario_id = v_uid;

  return 'ok';
end;
$$;

create or replace function public.responder_pedido(p_slug text, p_usuario_id uuid, p_aceitar boolean)
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

  if not exists (
    select 1 from public.comunidade_pedidos p
    where p.comunidade_id = v_c.id and p.usuario_id = p_usuario_id
  ) then
    return 'sem_pedido';
  end if;

  if p_aceitar then
    insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
    values (v_c.id, p_usuario_id, 'membro')
    on conflict do nothing;

    update public.comunidade_pedidos
    set status = 'aceito', respondido_em = now()
    where comunidade_id = v_c.id and usuario_id = p_usuario_id;

    return 'aceito';
  end if;

  update public.comunidade_pedidos
  set status = 'recusado', respondido_em = now()
  where comunidade_id = v_c.id and usuario_id = p_usuario_id;

  return 'recusado';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Migração dos dados existentes
--   * Todos os posts de até agora passam para "Renato Lanches".
--   * Quem já publicou (e o dono) entram como membros.
--   * A comunidade é privada e só entra quem souber a senha.
--   * A comunidade antiga "Aur6769" é removida.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dono uuid;
  v_cid uuid;
  v_aur uuid;
begin
  -- Dono: a conta morcegodb1234@gmail.com (perfil associado).
  select p.id into v_dono
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = 'morcegodb1234@gmail.com'
  order by p.created_at asc
  limit 1;

  if v_dono is null then
    select id into v_dono
    from public.profiles
    order by created_at asc
    limit 1;
  end if;

  if v_dono is null then
    raise notice 'Nenhum perfil encontrado: Renato Lanches não foi criada.';
    return;
  end if;

  select id into v_aur from public.comunidades where slug = 'aur6769';

  insert into public.comunidades (nome, slug, descricao, dono_id, visibilidade)
  values (
    'Renato Lanches',
    'renato-lanches',
    'Comunidade original do Harmony: todos os posts feitos até aqui.',
    v_dono,
    'privada'
  )
  on conflict (slug) do update
    set dono_id = excluded.dono_id,
        visibilidade = 'privada'
  returning id into v_cid;

  insert into public.comunidade_senhas (comunidade_id, senha_hash)
  values (v_cid, public.hash_comunidade_senha('renato-lanches', 'exercitodorenato'))
  on conflict (comunidade_id) do nothing;

  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  values (v_cid, v_dono, 'dono')
  on conflict (comunidade_id, usuario_id) do nothing;

  -- Posts de até agora: os que ainda não têm comunidade e os da Aur6769.
  update public.posts p
  set comunidade_id = v_cid,
      canal_id = null
  where p.comunidade_id is null
     or p.comunidade_id = v_aur;

  -- Quem já publicou fica dentro da comunidade privada.
  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  select distinct v_cid, p.author_id, 'membro'
  from public.posts p
  where p.comunidade_id = v_cid
    and p.author_id is not null
  on conflict (comunidade_id, usuario_id) do nothing;

  if v_aur is not null then
    delete from public.comunidades where id = v_aur;
  end if;

  raise notice 'Renato Lanches pronta (id %) com % posts e % membros.',
    v_cid,
    (select count(*) from public.posts where comunidade_id = v_cid),
    (select count(*) from public.comunidade_membros where comunidade_id = v_cid);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Imagens de ícone e banner das comunidades
-- O bucket é público apenas para download: envio e remoção continuam limitados
-- à pasta cujo nome é o UUID do usuário autenticado.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunidades', 'comunidades', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imagens de comunidade sao publicas" on storage.objects;
create policy "imagens de comunidade sao publicas"
  on storage.objects for select
  using (bucket_id = 'comunidades');

drop policy if exists "users upload own community images" on storage.objects;
create policy "users upload own community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comunidades'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users update own community images" on storage.objects;
create policy "users update own community images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'comunidades'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'comunidades'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users remove own community images" on storage.objects;
create policy "users remove own community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comunidades'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
