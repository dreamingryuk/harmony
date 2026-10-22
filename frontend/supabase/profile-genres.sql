-- Validate favorite genres even when profiles are updated outside the frontend.
create or replace function public.validate_profile_favorite_genres()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed_genres text[] := array[
    'Afrobeats', 'Alternativo', 'Ambient', 'Axé', 'Blues', 'Bossa Nova',
    'Breakbeat', 'Chillout', 'Clássica', 'Country', 'Dance', 'Disco',
    'Drum and Bass', 'Dub', 'EDM', 'Eletrônica', 'Emo', 'Folk', 'Forró',
    'Funk', 'Funk Brasileiro', 'Funk carioca', 'Gospel', 'Grime', 'Hard Rock',
    'Heavy Metal', 'Hip Hop', 'House', 'Indie', 'Instrumental', 'J-Pop', 'Jazz',
    'K-Pop', 'Latina', 'Lo-fi', 'Metal', 'Música latina', 'MPB', 'New Wave', 'Pagode',
    'Pop', 'Pop punk', 'Post-punk', 'Psicodélico', 'Punk', 'R&B', 'Rap',
    'Reggae', 'Reggaeton', 'Rock', 'Rock Alternativo', 'Rock brasileiro',
    'Samba', 'Sertanejo', 'Soul', 'Synthpop', 'Techno', 'Trance', 'Trap',
    'Trilha Sonora', 'Vaporwave'
  ];
begin
  if new.favorite_genres is null then
    new.favorite_genres := array[]::text[];
  end if;

  if exists (
    select 1
    from unnest(new.favorite_genres) as selected(genre)
    where not (selected.genre = any(allowed_genres))
  ) then
    raise exception 'Gênero favorito inválido.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

update public.profiles
set favorite_genres = array_replace(
  array_replace(favorite_genres, 'K-pop', 'K-Pop'),
  'Rock alternativo',
  'Rock Alternativo'
)
where 'K-pop' = any(favorite_genres)
   or 'Rock alternativo' = any(favorite_genres);

drop trigger if exists validate_profile_favorite_genres on public.profiles;
create trigger validate_profile_favorite_genres
before insert or update of favorite_genres on public.profiles
for each row execute function public.validate_profile_favorite_genres();
