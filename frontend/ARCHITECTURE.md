# Arquitetura do SYNQ

## Fluxo principal

`main.jsx` monta `App.jsx`. O componente `AppRoutes` resolve autenticação e as rotas; `Shell` entrega a navegação e o player compartilhado. Cada página recebe o estado de sessão/perfil retornado por `useSynq`.

| Área                  | Responsabilidade                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/supabase.js` | Cria o cliente Supabase, cria o perfil no primeiro login e concentra a configuração de ambiente. |
| `src/lib/spotify.js`  | OAuth PKCE, token temporário, busca, importação e salvamento na biblioteca Spotify.              |
| `App.jsx`             | Páginas, componentes visuais compartilhados e operações de interface.                            |
| `supabase/schema.sql` | Banco, índices, RLS e canais Realtime.                                                           |

## Dados

- `profiles` é criado para cada usuário de `auth.users`.
- Conteúdo social usa `posts`, `post_likes`, `follows` e `messages`.
- A biblioteca usa `saved_tracks`, `playlists` e `playlist_tracks`.
- Cada início de preview registra um `listening_event`; a retrospectiva calcula os gráficos a partir desses eventos, sem acessar o histórico privado do Spotify.

## Segurança

Nunca exponha chaves secretas no frontend. O arquivo `.env` é ignorado pelo Git; somente a chave pública anon do Supabase e o Client ID Spotify são usados no navegador. A autorização Spotify usa PKCE e seus tokens vivem apenas em `sessionStorage`.

## Qualidade

```bash
npm run lint
npm run format:check
npm run build
```

Antes de enviar alterações, execute os três comandos. O diretório `src/components` e `src/pages` contém somente arquivos do protótipo antigo e está ignorado pelo lint; a SPA atual não os importa.
