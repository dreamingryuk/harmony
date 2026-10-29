// Recursos visuais e identificadores comuns a qualquer fonte de música.
// Não dependem de uma plataforma externa específica.
export const FALLBACK_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%2314b881'/%3E%3Cstop offset='1' stop-color='%2310251f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' rx='18' fill='url(%23g)'/%3E%3Cpath d='M98 37v65.5a20 20 0 1 1-10-17.3V52l35-8v48.5a20 20 0 1 1-10-17.3V37z' fill='white' fill-opacity='.92'/%3E%3C/svg%3E"

export const trackId = (track) => track?.youtubeId || track?.mediaId || track?.spotifyId || track?.title
