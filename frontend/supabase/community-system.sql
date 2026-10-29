-- Harmony: sistema de comunidades (Discord-like)
-- Execute este arquivo no SQL Editor do Supabase após o schema principal.
-- A migração deve ser idempotente: rodar mais de uma vez não duplica dados.

create table if not exists public.comunidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(nome) between 3 and 32),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) between 3 and 32),
  descricao text default '' check (char_length(descricao) <= 300),
  icone_url text,
  banner_url text,
  dono_id uuid not null references public.profiles(id) on delete restrict,
  visibilidade text not null default 'publica' check (visibilidade in ('publica', 'por_convite', 'privada')),
  criada_em timestamptz not null default now()
);

create table if not exists public.comunidade_membros (
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'admin', 'moderador', 'membro')),
  apelido text,
  entrou_em timestamptz not null default now(),
  silenciada boolean not null default false,
  primary key (comunidade_id, usuario_id)
);

create table if not exists public.canais (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 50),
  tipo text not null check (tipo in ('posts', 'chat')),
  descricao text default '',
  ordem integer not null default 0,
  somente_leitura boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (comunidade_id, nome)
);

create table if not exists public.convites (
  codigo text primary key check (char_length(codigo) between 6 and 32),
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  criado_por uuid not null references public.profiles(id) on delete cascade,
  expira_em timestamptz,
  usos_max integer,
  usos integer not null default 0 check (usos >= 0),
  criado_em timestamptz not null default now()
);

create table if not exists public.banimentos (
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  motivo text default '',
  banido_por uuid not null references public.profiles(id) on delete cascade,
  banido_em timestamptz not null default now(),
  primary key (comunidade_id, usuario_id)
);

alter table public.posts
  add column if not exists comunidade_id uuid references public.comunidades(id) on delete set null,
  add column if not exists canal_id uuid references public.canais(id) on delete set null;

create table if not exists public.mensagens_canal (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canais(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  conteudo text not null check (char_length(conteudo) between 1 and 2000),
  criada_em timestamptz not null default now(),
  editada_em timestamptz,
  resposta_a uuid references public.mensagens_canal(id) on delete set null
);

create index if not exists comunidades_slug_idx on public.comunidades(slug);
create index if not exists comunidade_membros_usuario_idx on public.comunidade_membros(usuario_id);
create index if not exists canais_comunidade_ordem_idx on public.canais(comunidade_id, ordem);
create index if not exists posts_comunidade_canal_idx on public.posts(comunidade_id, canal_id, created_at desc);
create index if not exists mensagens_canal_idx on public.mensagens_canal(canal_id, criada_em desc);

alter table public.posts enable row level security;
alter table public.comunidades enable row level security;
alter table public.comunidade_membros enable row level security;
alter table public.canais enable row level security;
alter table public.convites enable row level security;
alter table public.banimentos enable row level security;
alter table public.mensagens_canal enable row level security;

drop policy if exists "comunidades visiveis" on public.comunidades;
create policy "comunidades visiveis" on public.comunidades
  for select to authenticated
  using (visibilidade = 'publica' or exists (
    select 1 from public.comunidade_membros cm
    where cm.comunidade_id = comunidades.id and cm.usuario_id = auth.uid()
  ));

drop policy if exists "comunidades do proprio usuario" on public.comunidades;
create policy "comunidades do proprio usuario" on public.comunidades
  for all to authenticated
  using (dono_id = auth.uid())
  with check (dono_id = auth.uid());

drop policy if exists "membros visiveis da comunidade" on public.comunidade_membros;
create policy "membros visiveis da comunidade" on public.comunidade_membros
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.comunidades c
      where c.id = comunidade_membros.comunidade_id and c.visibilidade = 'publica'
    )
  );

drop policy if exists "membros gerenciam sua propria participacao" on public.comunidade_membros;
create policy "membros gerenciam sua propria participacao" on public.comunidade_membros
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "canais visiveis" on public.canais;
create policy "canais visiveis" on public.canais
  for select to authenticated
  using (exists (
    select 1 from public.comunidade_membros cm
    where cm.comunidade_id = canais.comunidade_id and cm.usuario_id = auth.uid()
  ));

drop policy if exists "admins gerenciam canais" on public.canais;
create policy "admins gerenciam canais" on public.canais
  for all to authenticated
  using (exists (
    select 1 from public.comunidade_membros cm
    where cm.comunidade_id = canais.comunidade_id
      and cm.usuario_id = auth.uid()
      and cm.papel in ('dono', 'admin', 'moderador')
  ))
  with check (exists (
    select 1 from public.comunidade_membros cm
    where cm.comunidade_id = canais.comunidade_id
      and cm.usuario_id = auth.uid()
      and cm.papel in ('dono', 'admin', 'moderador')
  ));

drop policy if exists "autores e admins gerenciam posts da comunidade" on public.posts;
create policy "autores e admins gerenciam posts da comunidade" on public.posts
  for all to authenticated
  using (
    comunidade_id is null
    or exists (
      select 1 from public.comunidade_membros cm
      where cm.comunidade_id = posts.comunidade_id and cm.usuario_id = auth.uid()
    )
    or author_id = auth.uid()
  )
  with check (
    author_id = auth.uid()
    and (
      comunidade_id is null
      or exists (
        select 1 from public.comunidade_membros cm
        where cm.comunidade_id = posts.comunidade_id and cm.usuario_id = auth.uid()
      )
    )
  );

drop policy if exists "membros leem mensagens do canal" on public.mensagens_canal;
create policy "membros leem mensagens do canal" on public.mensagens_canal
  for select to authenticated
  using (exists (
    select 1 from public.canais c
    join public.comunidade_membros cm on cm.comunidade_id = c.comunidade_id
    where c.id = mensagens_canal.canal_id and cm.usuario_id = auth.uid()
  ));

drop policy if exists "usuarios publicam mensagens em canais" on public.mensagens_canal;
create policy "usuarios publicam mensagens em canais" on public.mensagens_canal
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.canais c
      join public.comunidade_membros cm on cm.comunidade_id = c.comunidade_id
      where c.id = mensagens_canal.canal_id and cm.usuario_id = auth.uid()
    )
  );

create or replace function public.ensure_default_aur6769()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
  community_id uuid;
  geral_id uuid;
  chat_id uuid;
  avisos_id uuid;
begin
  select id into owner_id
  from public.profiles
  order by created_at asc
  limit 1;

  if owner_id is null then
    return null;
  end if;

  insert into public.comunidades (nome, slug, descricao, dono_id, visibilidade)
  values ('Aur6769', 'aur6769', 'Comunidade original do Harmony, onde tudo começou.', owner_id, 'publica')
  on conflict (slug) do nothing
  returning id into community_id;

  if community_id is null then
    select id into community_id from public.comunidades where slug = 'aur6769';
  end if;

  if community_id is null then
    return null;
  end if;

  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  values (community_id, owner_id, 'dono')
  on conflict (comunidade_id, usuario_id) do nothing;

  insert into public.canais (comunidade_id, nome, tipo, descricao, ordem, somente_leitura)
  values
    (community_id, 'geral', 'posts', 'Posts da comunidade original.', 0, false),
    (community_id, 'chat', 'chat', 'Chat rápido da comunidade.', 1, false),
    (community_id, 'avisos', 'posts', 'Avisos e comunicados da administração.', 2, true)
  on conflict (comunidade_id, nome) do nothing;

  select id into geral_id from public.canais where comunidade_id = community_id and nome = 'geral';
  if geral_id is not null then
    update public.posts
    set comunidade_id = community_id,
        canal_id = geral_id
    where comunidade_id is null and canal_id is null;
  end if;

  insert into public.comunidade_membros (comunidade_id, usuario_id, papel)
  select community_id, p.id, 'membro'
  from public.profiles p
  where p.id <> owner_id
  on conflict (comunidade_id, usuario_id) do nothing;

  return community_id;
end;
$$;

select public.ensure_default_aur6769();
