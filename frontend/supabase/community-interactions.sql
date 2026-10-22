-- Apply after schema.sql to enable post replies, mentions, and dislikes.
-- Safe to rerun on an existing project.

create table if not exists public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created
  on public.post_comments(post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "post comments are visible" on public.post_comments;
create policy "post comments are visible"
  on public.post_comments for select to authenticated
  using (true);

drop policy if exists "users create own post comments" on public.post_comments;
create policy "users create own post comments"
  on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and char_length(btrim(content)) between 1 and 2000
  );

drop policy if exists "users delete own post comments" on public.post_comments;
create policy "users delete own post comments"
  on public.post_comments for delete to authenticated
  using (author_id = auth.uid());

create table if not exists public.post_dislikes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_dislikes enable row level security;

drop policy if exists "post dislikes are visible" on public.post_dislikes;
create policy "post dislikes are visible"
  on public.post_dislikes for select to authenticated
  using (true);

drop policy if exists "users manage own post dislikes" on public.post_dislikes;
create policy "users manage own post dislikes"
  on public.post_dislikes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.post_comments;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.post_dislikes;
  exception
    when duplicate_object then null;
  end;
end $$;
