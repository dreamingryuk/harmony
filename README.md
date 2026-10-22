# Harmony — rede social de música

O Harmony é um projeto escolar de rede social musical. A aplicação permite descobrir faixas no Spotify, compartilhar publicações, conversar, salvar músicas, montar playlists e acompanhar uma retrospectiva das reproduções feitas no próprio Harmony.

## Estrutura

- `frontend/`: aplicação React com Vite. A autenticação, os dados sociais e o Realtime usam Supabase diretamente pelo cliente JavaScript.
- `frontend/supabase/schema.sql`: estrutura do banco, índices, políticas RLS e publicação Realtime do Supabase.
- `backend/`: API Express auxiliar, atualmente com a rota de saúde `GET /api/health`. O frontend não depende dessa API para autenticação ou dados sociais.

O banco Supabase é o backend principal da aplicação hoje. A API Express é somente um ponto de partida para integrações futuras; não há rotas próprias de autenticação ou persistência nela.

## Executar localmente

### Frontend

1. Entre em `frontend` e copie `.example` para `.env`.
2. Preencha as variáveis `VITE_*` descritas abaixo.
3. Execute `npm install` e `npm run dev`.
4. Acesse `http://localhost:5173`.

Sem as variáveis do Supabase, a aplicação abre em modo de demonstração. Os dados desse modo não são salvos.

### API auxiliar (opcional)

1. Entre em `backend` e execute `npm install`.
2. Execute `npm run dev` ou `npm start`.
3. Acesse `http://localhost:3000/api/health`.

Defina `PORT` para mudar a porta. `CORS_ORIGIN` aceita uma ou mais origens separadas por vírgula; por padrão permite `http://localhost:5173`.

## Supabase

1. Crie um projeto Supabase e ative Email em **Authentication > Providers**. Google é opcional.
2. Em **Authentication > URL Configuration**, permita `http://localhost:5173` e a URL publicada.
3. Copie a URL do projeto e a chave anon/public para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Execute `frontend/supabase/schema.sql` uma vez no SQL Editor.

As políticas RLS do schema protegem as operações no banco. Nunca use a chave `service_role` no frontend.

## Spotify

1. Crie um app no [Spotify for Developers](https://developer.spotify.com/dashboard).
2. Cadastre `http://localhost:5173/spotify/callback` como Redirect URI e também a URL de produção equivalente.
3. Coloque somente o Client ID em `VITE_SPOTIFY_CLIENT_ID`. O Client Secret não deve ser usado no navegador.
4. Defina `VITE_SPOTIFY_REDIRECT_URI` com a mesma URL cadastrada no Dashboard do Spotify. Em produção, use a URL final da Vercel; o endereço deve coincidir exatamente, inclusive sem/ com barra final.

A conexão usa OAuth PKCE. O token fica em `sessionStorage` e a aplicação não baixa nem hospeda áudio do Spotify. As prévias podem não estar disponíveis para todas as faixas.

## Publicação na Vercel

Importe o repositório na Vercel e use `frontend` como **Root Directory**. Configure as três variáveis `VITE_*`, publique e adicione o domínio final às URLs permitidas do Supabase e às Redirect URIs do Spotify. `frontend/vercel.json` configura o fallback das rotas da SPA.
