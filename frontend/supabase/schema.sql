-- Harmony: execute este arquivo uma vez no SQL Editor do Supabase.
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text default '', avatar_color text default 'green', avatar_url text,
  favorite_genres text[] default '{}', favorite_artists text[] default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followed_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(follower_id, followed_id), check(follower_id <> followed_id)
);
create table public.playlists (
  id uuid primary key default uuid_generate_v4(), owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 100), description text default '', cover_color text default 'green',
  is_public boolean not null default false, is_collaborative boolean not null default false, imported_spotify_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.playlist_tracks (
  id uuid primary key default uuid_generate_v4(), playlist_id uuid not null references public.playlists(id) on delete cascade,
  spotify_id text not null, position integer not null default 0, track jsonb not null, added_at timestamptz not null default now(), unique(playlist_id, spotify_id)
);
create table public.saved_tracks (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.profiles(id) on delete cascade,
  spotify_id text not null, track jsonb not null, created_at timestamptz not null default now(), unique(user_id, spotify_id)
);
create table public.posts (
  id uuid primary key default uuid_generate_v4(), author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 2000), track jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id, user_id)
);
create table public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check(char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.post_dislikes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);
create table public.community_notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  kind text not null check (kind in ('post_mention', 'comment_mention')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id),
  check ((kind = 'post_mention' and comment_id is null) or (kind = 'comment_mention' and comment_id is not null))
);
create table public.messages (
  id uuid primary key default uuid_generate_v4(), sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade, content text not null default '', track jsonb,
  created_at timestamptz not null default now(), check(char_length(content) <= 2000), check(sender_id <> recipient_id)
);
create table public.listening_events (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.profiles(id) on delete cascade,
  track jsonb not null, artist_name text not null, genres text[] default '{}', played_at timestamptz not null default now()
);

alter table public.profiles enable row level security; alter table public.follows enable row level security;
alter table public.playlists enable row level security; alter table public.playlist_tracks enable row level security;
alter table public.saved_tracks enable row level security; alter table public.posts enable row level security;
alter table public.post_likes enable row level security; alter table public.messages enable row level security;
alter table public.post_comments enable row level security; alter table public.post_dislikes enable row level security;
alter table public.community_notifications enable row level security;
alter table public.listening_events enable row level security;

create policy "profiles are visible" on public.profiles for select using (true);
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "follows visible" on public.follows for select using (true);
create policy "own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy "visible playlists" on public.playlists for select using (is_public or owner_id = auth.uid());
create policy "own playlists" on public.playlists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "visible tracks" on public.playlist_tracks for select using (exists(select 1 from public.playlists p where p.id = playlist_id and (p.is_public or p.owner_id = auth.uid())));
create policy "owner manages playlist tracks" on public.playlist_tracks for all using (exists(select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())) with check (exists(select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()));
create policy "own saved tracks" on public.saved_tracks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts visible" on public.posts for select using (true);
create policy "own posts" on public.posts for all using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "likes visible" on public.post_likes for select using (true);
create policy "own likes" on public.post_likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "post comments are visible" on public.post_comments for select to authenticated using (true);
create policy "users create own post comments" on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and char_length(btrim(content)) between 1 and 2000);
create policy "users delete own post comments" on public.post_comments for delete to authenticated
  using (author_id = auth.uid());
create policy "post dislikes are visible" on public.post_dislikes for select to authenticated using (true);
create policy "users manage own post dislikes" on public.post_dislikes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own community notifications" on public.community_notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "users mark own community notifications read" on public.community_notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke insert, update, delete on public.community_notifications from authenticated;
grant select on public.community_notifications to authenticated;
grant update (read_at) on public.community_notifications to authenticated;
create policy "private messages" on public.messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send own messages" on public.messages for insert with check (sender_id = auth.uid());
create policy "own listening history" on public.listening_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index listening_events_user_played on public.listening_events(user_id, played_at desc);
create index messages_participants on public.messages(sender_id, recipient_id, created_at);
create index post_comments_post_created on public.post_comments(post_id, created_at);
create unique index community_post_mention_once on public.community_notifications(recipient_id, post_id) where comment_id is null;
create unique index community_comment_mention_once on public.community_notifications(recipient_id, comment_id) where comment_id is not null;
create index community_notifications_recipient_unread on public.community_notifications(recipient_id, created_at desc) where read_at is null;

create or replace function public.notify_community_mentions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mention_body text;
  mention_name text;
  target_post_id uuid;
  target_comment_id uuid;
  notification_kind text;
begin
  if tg_table_name = 'posts' then
    mention_body := new.content;
    target_post_id := new.id;
    target_comment_id := null;
    notification_kind := 'post_mention';
  else
    mention_body := new.content;
    target_post_id := new.post_id;
    target_comment_id := new.id;
    notification_kind := 'comment_mention';
  end if;
  for mention_name in
    select matched[2]
    from regexp_matches(mention_body, '(^|[^[:alnum:]_])@([[:alnum:]_]{3,30})', 'g') as matched
  loop
    insert into public.community_notifications (recipient_id, actor_id, post_id, comment_id, kind)
    select profile.id, new.author_id, target_post_id, target_comment_id, notification_kind
    from public.profiles as profile
    where lower(profile.username) = lower(mention_name) and profile.id <> new.author_id
    on conflict do nothing;
  end loop;
  return new;
end;
$$;
create trigger notify_post_mentions after insert on public.posts
  for each row execute function public.notify_community_mentions();
create trigger notify_comment_mentions after insert on public.post_comments
  for each row execute function public.notify_community_mentions();
alter publication supabase_realtime add table public.posts, public.post_likes, public.post_comments, public.post_dislikes, public.community_notifications, public.messages, public.follows, public.playlists;
