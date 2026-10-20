# Harmony — rede social de música

Uma plataforma social de música construída com React, Supabase e Spotify Web API. Ela permite descobrir músicas, importar playlists, favoritar faixas, conversar, postar, criar playlists e acompanhar uma retrospectiva das execuções feitas no Harmony.

## Rodar localmente

1. Entre em `frontend`, copie `.env.example` para `.env` e preencha as variáveis.
2. Execute `npm install` e depois `npm run dev`.
3. Abra `http://localhost:5173`.

Sem o `.env` o Harmony abre em modo demonstração visual. Para funções sociais reais, crie um projeto gratuito no Supabase e execute `frontend/supabase/schema.sql` no **SQL Editor**.

## Configuração externa

### Supabase

- Em **Authentication > Providers**, ative Email. Google é opcional.
- Em **Authentication > URL Configuration**, inclua `http://localhost:5173` e a URL Vercel.
- Copie Project URL e anon public key para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Rode o arquivo SQL do projeto; ele cria as tabelas, índices, Realtime e as políticas RLS.

### Spotify

1. Crie um app em [Spotify for Developers](https://developer.spotify.com/dashboard).
2. Cadastre exatamente `http://localhost:5173/spotify/callback` como Redirect URI; depois inclua `https://SEU-APP.vercel.app/spotify/callback`.
3. Copie somente o Client ID para `VITE_SPOTIFY_CLIENT_ID`. Nunca coloque Client Secret no frontend.
4. Em desenvolvimento, inclua sua conta e as contas de teste autorizadas no painel Spotify.

O app usa OAuth PKCE e solicita apenas leitura de playlists e permissão para salvar uma faixa na biblioteca do usuário. Ele não baixa, hospeda ou sincroniza automaticamente conteúdo do Spotify.

## Publicação grátis na Vercel

1. Envie este repositório ao GitHub.
2. Em [Vercel](https://vercel.com/new), importe o repositório e defina **Root Directory** como `frontend`.
3. Informe as três variáveis `VITE_*` nas configurações do projeto.
4. Faça o deploy e adicione a URL final às URLs permitidas do Supabase e à Redirect URI do Spotify.

`vercel.json` já permite que links diretos para as páginas da SPA funcionem.
