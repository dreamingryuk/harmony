-- Amizades: convite pelo apelido público (@username), aceite ou recusa.
-- Execute este arquivo no SQL Editor do Supabase, depois de schema.sql.
-- Pode ser executado mais de uma vez.

create extension if not exists "uuid-ossp";

create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Par normalizado: impede convites repetidos nas duas direções.
  pair_a uuid generated always as (least(requester_id, addressee_id)) stored,
  pair_b uuid generated always as (greatest(requester_id, addressee_id)) stored,
  check (requester_id <> addressee_id),
  unique (pair_a, pair_b)
);

create index if not exists friendships_addressee_pending
  on public.friendships(addressee_id) where status = 'pending';
create index if not exists friendships_requester
  on public.friendships(requester_id);

alter table public.friendships enable row level security;

drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships"
  on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "send friend requests" on public.friendships;
create policy "send friend requests"
  on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

-- Só quem recebe o convite pode aceitá-lo.
drop policy if exists "accept friend requests" on public.friendships;
create policy "accept friend requests"
  on public.friendships for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status = 'accepted');

-- Recusar ou cancelar é remover a linha; desfazer amizade também.
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships"
  on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
