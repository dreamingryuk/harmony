-- Banner do perfil: cor sólida, gradiente ou imagem.
-- Execute este arquivo no SQL Editor do Supabase, depois de schema.sql.
-- Pode ser executado mais de uma vez.

alter table public.profiles
  add column if not exists banner_type text not null default 'color',
  add column if not exists banner_color text not null default '#14b881',
  add column if not exists banner_color_end text not null default '#10251f',
  add column if not exists banner_url text default '';

alter table public.profiles
  drop constraint if exists profiles_banner_type_check;
alter table public.profiles
  add constraint profiles_banner_type_check
  check (banner_type in ('color', 'gradient', 'image'));

-- Cores sempre em hexadecimal: elas entram direto no estilo em linha.
alter table public.profiles
  drop constraint if exists profiles_banner_color_check;
alter table public.profiles
  add constraint profiles_banner_color_check
  check (banner_color ~ '^#[0-9a-fA-F]{6}$' and banner_color_end ~ '^#[0-9a-fA-F]{6}$');

-- Bucket público para as imagens de banner.
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "banners are public" on storage.objects;
create policy "banners are public"
  on storage.objects for select
  using (bucket_id = 'banners');

drop policy if exists "users upload own banner" on storage.objects;
create policy "users upload own banner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users replace own banner" on storage.objects;
create policy "users replace own banner"
  on storage.objects for update to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users remove own banner" on storage.objects;
create policy "users remove own banner"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
