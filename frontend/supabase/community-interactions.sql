-- Apply after schema.sql to enable post replies, mentions, and dislikes.
-- Safe to rerun on an existing project.

create extension if not exists "uuid-ossp";

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
  with check (user_id = auth.uid()  );

  create table if not exists public.community_notifications (
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

  create unique index if not exists community_post_mention_once
    on public.community_notifications(recipient_id, post_id)
    where comment_id is null;
  create unique index if not exists community_comment_mention_once
    on public.community_notifications(recipient_id, comment_id)
    where comment_id is not null;
  create index if not exists community_notifications_recipient_unread
    on public.community_notifications(recipient_id, created_at desc)
    where read_at is null;

  alter table public.community_notifications enable row level security;

  drop policy if exists "users read own community notifications" on public.community_notifications;
  create policy "users read own community notifications"
    on public.community_notifications for select to authenticated
    using (recipient_id = auth.uid());

  drop policy if exists "users mark own community notifications read" on public.community_notifications;
  create policy "users mark own community notifications read"
    on public.community_notifications for update to authenticated
    using (recipient_id = auth.uid())
    with check (recipient_id = auth.uid());

  revoke insert, update, delete on public.community_notifications from authenticated;
  grant select on public.community_notifications to authenticated;
  grant update (read_at) on public.community_notifications to authenticated;

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
      insert into public.community_notifications (
        recipient_id, actor_id, post_id, comment_id, kind
      )
      select profile.id, new.author_id, target_post_id, target_comment_id, notification_kind
      from public.profiles as profile
      where lower(profile.username) = lower(mention_name)
        and profile.id <> new.author_id
      on conflict do nothing;
    end loop;

    return new;
  end;
  $$;

  drop trigger if exists notify_post_mentions on public.posts;
  create trigger notify_post_mentions
    after insert on public.posts
    for each row execute function public.notify_community_mentions();

  drop trigger if exists notify_comment_mentions on public.post_comments;
  create trigger notify_comment_mentions
    after insert on public.post_comments
    for each row execute function public.notify_community_mentions();

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

  begin
    alter publication supabase_realtime add table public.community_notifications;
  exception
    when duplicate_object then null;
  end;
end $$;
