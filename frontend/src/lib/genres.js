export const GENRES = [
  'Afrobeats',
  'Alternativo',
  'Ambient',
  'Axé',
  'Blues',
  'Bossa Nova',
  'Breakbeat',
  'Chillout',
  'Clássica',
  'Country',
  'Dance',
  'Disco',
  'Drum and Bass',
  'Dub',
  'EDM',
  'Eletrônica',
  'Emo',
  'Folk',
  'Forró',
  'Funk',
  'Funk Brasileiro',
  'Funk carioca',
  'Gospel',
  'Grime',
  'Hard Rock',
  'Heavy Metal',
  'Hip Hop',
  'House',
  'Indie',
  'Instrumental',
  'J-Pop',
  'Jazz',
  'K-Pop',
  'Latina',
  'Lo-fi',
  'Metal',
  'Música latina',
  'MPB',
  'New Wave',
  'Pagode',
  'Pop',
  'Pop punk',
  'Post-punk',
  'Psicodélico',
  'Punk',
  'R&B',
  'Rap',
  'Reggae',
  'Reggaeton',
  'Rock',
  'Rock Alternativo',
  'Rock brasileiro',
  'Samba',
  'Sertanejo',
  'Soul',
  'Synthpop',
  'Techno',
  'Trance',
  'Trap',
  'Trilha Sonora',
  'Vaporwave',
].sort((a, b) => a.localeCompare(b, 'pt-BR'))

export const normalizeGenre = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

export function highlightGenreMatch(genre, query) {
  const normalizedQuery = normalizeGenre(query)
  if (!normalizedQuery) return null

  const characters = [...genre]
  const normalizedCharacters = characters.map((character) => normalizeGenre(character))
  const normalizedGenre = normalizedCharacters.join('')
  const matchStart = normalizedGenre.indexOf(normalizedQuery)
  if (matchStart < 0) return null

  const start = normalizedCharacters
    .slice(0, matchStart)
    .reduce((length, character) => length + character.length, 0)
  const end = start + [...normalizedQuery].length

  return {
    before: characters.slice(0, start).join(''),
    match: characters.slice(start, end).join(''),
    after: characters.slice(end).join(''),
  }
}
