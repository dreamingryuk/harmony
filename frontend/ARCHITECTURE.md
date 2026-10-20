# Arquitetura do Harmony

## Aplicação

`src/main.jsx` monta `App.jsx`, que contém o roteamento, a sessão e as páginas da aplicação. `src/lib/supabase.js` configura o cliente Supabase e cria o perfil no primeiro acesso; `src/lib/spotify.js` implementa OAuth PKCE e chamadas de leitura/escrita permitidas pela API Spotify.

O frontend acessa Supabase diretamente. O diretório `backend/` na raiz contém uma API Express auxiliar com apenas `GET /api/health`; ela não faz parte do fluxo de autenticação ou persistência.

## Dados

- `profiles`: perfil público e preferências do usuário.
- `posts`, `post_likes`, `follows` e `messages`: recursos sociais.
- `saved_tracks`, `playlists` e `playlist_tracks`: biblioteca e playlists do Harmony.
- `listening_events`: reproduções iniciadas no player Harmony. A retrospectiva usa esses eventos; ela não lê o histórico privado completo do Spotify.

O schema e as políticas Row Level Security estão em `supabase/schema.sql`. Execute o arquivo uma vez em um projeto novo do Supabase.

## Configuração e segurança

As variáveis `VITE_*` são incorporadas ao bundle do navegador e não podem conter segredos. A chave anon/public do Supabase depende de políticas RLS corretas; nunca coloque a chave `service_role` no frontend. O OAuth Spotify usa PKCE e mantém o token temporário em `sessionStorage`.

## Verificações disponíveis

```bash
npm run lint
npm run format:check
npm run build
```
