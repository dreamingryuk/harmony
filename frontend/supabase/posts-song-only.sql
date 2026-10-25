-- Publicar só uma música, sem texto.
-- Execute este arquivo no SQL Editor do Supabase, depois de schema.sql.
-- Pode ser executado mais de uma vez.

alter table public.posts
  drop constraint if exists posts_content_check;

alter table public.posts
  add constraint posts_content_check
  check (
    char_length(content) between 1 and 2000
    or (btrim(content) = '' and track is not null)
  );
