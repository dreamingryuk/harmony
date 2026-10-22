-- Keep private account preferences separate from publicly readable profiles.
create table if not exists public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_notifications_enabled boolean not null default true,
  default_playlist_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.account_preferences enable row level security;

drop policy if exists "users manage own account preferences" on public.account_preferences;
create policy "users manage own account preferences"
  on public.account_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create or replace function public.validate_profile_account_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    new.username := lower(btrim(new.username));
  end if;

  if new.username is distinct from old.username
     and (char_length(new.username) not between 3 and 30
       or new.username !~ '^[A-Za-z0-9_]+$') then
    raise exception 'Nome de usuário inválido.'
      using errcode = '23514';
  end if;

  if new.display_name is distinct from old.display_name
     and char_length(btrim(new.display_name)) not between 1 and 80 then
    raise exception 'Nome de exibição inválido.'
      using errcode = '23514';
  end if;

  if new.bio is distinct from old.bio and char_length(new.bio) > 300 then
    raise exception 'A bio deve ter no máximo 300 caracteres.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_account_settings on public.profiles;
create trigger validate_profile_account_settings
before insert or update of username, display_name, bio on public.profiles
for each row execute function public.validate_profile_account_settings();
