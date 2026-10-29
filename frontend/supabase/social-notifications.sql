-- Notificações sociais: curtidas, respostas e as menções que já existiam.
-- Execute este arquivo no SQL Editor do Supabase, depois de
-- schema.sql e community-interactions.sql. Pode ser executado mais de uma vez.

-- 1) Novos tipos de notificação.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'community_notifications'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%kind%'
  loop
    execute format('alter table public.community_notifications drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.community_notifications
  add constraint community_notifications_kind_check
  check (
    (kind in ('post_mention', 'post_like') and comment_id is null)
    or (kind in ('comment_mention', 'comment_reply') and comment_id is not null)
  );

-- 2) Uma notificação por pessoa, por fato: a regra antiga cobriria só a
--    primeira curtida de cada postagem.
drop index if exists community_post_mention_once;
drop index if exists community_comment_mention_once;

create unique index if not exists community_post_mention_once
  on public.community_notifications(recipient_id, post_id, actor_id)
  where kind = 'post_mention' and comment_id is null;

create unique index if not exists community_comment_mention_once
  on public.community_notifications(recipient_id, comment_id, actor_id)
  where kind = 'comment_mention' and comment_id is not null;

create unique index if not exists community_post_like_once
  on public.community_notifications(recipient_id, post_id, actor_id)
  where kind = 'post_like' and comment_id is null;

create unique index if not exists community_comment_reply_once
  on public.community_notifications(recipient_id, comment_id, actor_id)
  where kind = 'comment_reply' and comment_id is not null;

create index if not exists community_notifications_recipient_unread
  on public.community_notifications(recipient_id, created_at desc)
  where read_at is null;

-- 3) Alguém curtiu sua postagem.
create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.community_notifications (recipient_id, actor_id, post_id, kind)
  select post.author_id, new.user_id, new.post_id, 'post_like'
  from public.posts as post
  where post.id = new.post_id
    and post.author_id <> new.user_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists notify_post_likes on public.post_likes;
create trigger notify_post_likes
  after insert on public.post_likes
  for each row execute function public.notify_post_like();

-- A curtida desfeita leva a notificação junto.
create or replace function public.forget_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.community_notifications
  where kind = 'post_like'
    and post_id = old.post_id
    and actor_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists forget_post_likes on public.post_likes;
create trigger forget_post_likes
  after delete on public.post_likes
  for each row execute function public.forget_post_like();

-- 4) Alguém respondeu uma publicação que você acompanha: o autor do post e
--    quem já comentou nela recebem o aviso.
create or replace function public.notify_post_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.community_notifications (recipient_id, actor_id, post_id, comment_id, kind)
  select destinatario, new.author_id, new.post_id, new.id, 'comment_reply'
  from (
    select post.author_id as destinatario
    from public.posts as post
    where post.id = new.post_id
    union
    select previous.author_id
    from public.post_comments as previous
    where previous.post_id = new.post_id
      and previous.id <> new.id
  ) as alvos
  where destinatario <> new.author_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists notify_post_comments on public.post_comments;
create trigger notify_post_comments
  after insert on public.post_comments
  for each row execute function public.notify_post_reply();

-- Histórico: somente o destinatário pode remover um aviso da própria lista.
grant delete on public.community_notifications to authenticated;
drop policy if exists "users delete own community notifications" on public.community_notifications;
create policy "users delete own community notifications"
  on public.community_notifications for delete to authenticated
  using (recipient_id = auth.uid());
