-- Harmony/SYNQ: execute este complemento APÓS o schema.sql original.
-- Ele é seguro para bancos que já possuem dados do projeto.

alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reads enable row level security;

-- Um cliente não pode forçar o ID de uma playlist privada dentro de um post.
-- Faixas continuam compatíveis com o JSON salvo pelo schema original.
drop policy if exists "own posts" on public.posts;
create policy "own posts" on public.posts for all to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and (
      track is null
      or coalesce(track->>'type', 'track') <> 'playlist'
      or exists (
        select 1 from public.playlists p
        where p.id::text = track->>'playlist_id' and p.is_public
      )
    )
  );

drop policy if exists "send own messages" on public.messages;
create policy "send own messages" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      track is null
      or coalesce(track->>'type', 'track') <> 'playlist'
      or exists (
        select 1 from public.playlists p
        where p.id::text = track->>'playlist_id' and p.is_public
      )
    )
  );

drop policy if exists "recipient manages own read receipts" on public.message_reads;
create policy "recipient manages own read receipts"
  on public.message_reads for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.recipient_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.recipient_id = auth.uid()
    )
  );

create index if not exists message_reads_user_message on public.message_reads(user_id, message_id);

-- O bucket é público apenas para download: envio e remoção permanecem limitados
-- à pasta cujo nome é o UUID do usuário autenticado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own avatars" on storage.objects;
create policy "users upload own avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users update own avatars" on storage.objects;
create policy "users update own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users delete own avatars" on storage.objects;
create policy "users delete own avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Em bucket público esta policy não é necessária para abrir uma imagem por URL;
-- ela permite que o cliente autenticado consulte metadados do próprio avatar.
drop policy if exists "users view own avatar metadata" on storage.objects;
create policy "users view own avatar metadata"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

do $$
begin
  alter publication supabase_realtime add table public.message_reads;
exception
  when duplicate_object then null;
end $$;
