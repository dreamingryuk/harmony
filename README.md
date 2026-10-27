# Harmony — Rede Social de Música

## 1. Nome da Aplicação
**Harmony**

## 2. Tema Escolhido e Integrantes do Grupo
- **Tema:** Rede social musical
- **Integrantes do grupo:**
  - Gabriel Pereira da Silva
  - Kemily de Santi
  - Lucas Masquio Nogueira
  - Adrian Ramos Barão

## 3. Objetivo, Problema Abordado e Público-Alvo

### Objetivo
Desenvolver uma rede social voltada à música, onde usuários possam descobrir faixas, compartilhar suas descobertas, interagir com outros ouvintes, organizar suas músicas e acompanhar sua própria rotina de reprodução.

### Problema Abordado
Atualmente, as plataformas de música focam majoritariamente na reprodução, mas oferecem poucas funcionalidades sociais integradas. O Harmony busca unir descoberta musical, interação social e organização pessoal em um único ambiente.

### Público-Alvo
Ouvintes de música em geral, principalmente estudantes e jovens que desejam compartilhar descobertas musicais, criar playlists e interagir com pessoas com gostos musicais semelhantes.

## 4. Linguagens de Programação, Bibliotecas, Frameworks e Ferramentas

### Linguagens
- **JavaScript (ESM)**
- **SQL** (Postgres/Supabase)

### Frontend
- **[React](https://react.dev/)** ^19.2.8
- **[Vite](https://vitejs.dev/)** ^8.2.2
- **[React Router DOM](https://reactrouter.com/)** ^7.9.6
- **[Tailwind CSS](https://tailwindcss.com/)** ^4.1.14
- **[Lucide React](https://lucide.dev/)** ^0.468.0
- **[Recharts](https://recharts.org/)** ^2.15.0

### Backend (Auxiliar)
- **[Node.js](https://nodejs.org/)**
- **[Express](https://expressjs.com/)** ^5.2.1
- **[CORS](https://github.com/expressjs/cors)** ^2.8.6
- **[dotenv](https://github.com/motdotla/dotenv)** ^17.4.2
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** ^3.0.3
- **[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)** ^9.0.3
- **[Nodemon](https://nodemon.io/)** ^3.1.14

### Banco de Dados e Integrações
- **[Supabase](https://supabase.com/)** (Auth, Postgres, RLS, Realtime)
- **[Spotify Web API](https://developer.spotify.com/documentation/web-api)** (busca, OAuth PKCE, playlists, salvar faixas)
- **[YouTube Music API](https://developers.google.com/youtube/v3)** (busca e reprodução de faixas - integração implementada no frontend)

### Ferramentas
- **[ESLint](https://eslint.org/)** ^10.9.0
- **[Prettier](https://prettier.io/)** ^3.9.9

## 5. Descrição dos Principais Recursos Disponíveis

- **Descoberta** - Busca de faixas no Spotify com conexão opcional à conta
- **Biblioteca** - Músicas salvas, criação de playlists e importação de playlists do Spotify
- **Comunidade** - Feed de publicações com curtidas em tempo real
- **Mensagens** - Chat privado entre usuários
- **Retrospectiva** - Histórico de reprodução com gráficos e top músicas/artistas por período
- **Perfil** - Personalização com nome, bio e gêneros favoritos
- **Reprodutor** - Player integrado com prévias das faixas (quando disponíveis)
- **Tempo real** - Atualizações automáticas via Supabase Realtime

## 6. Funcionalidades e Comportamentos que o Sistema Oferece

### Autenticação e Perfis
- Cadastro e login com email via Supabase Auth (Google opcional)
- Criação automática de perfil ao autenticar
- Edição de perfil (nome de exibição, bio, gêneros favoritos)
- Modo demonstração quando o Supabase não está configurado

### Social
- Publicações com texto (1-2000 caracteres)
- Curtir e descurtir publicações
- Sistema de seguidores (estrutura implementada no banco)
- Feed em tempo real
- Mensagens privadas entre usuários em tempo real

### Música e Biblioteca
- Conexão com Spotify via OAuth PKCE
- Busca de faixas, álbuns e artistas
- Reprodução de prévias via reprodutor integrado
- Salvar/remover faixas favoritas
- Criar playlists personalizadas
- Importar playlists do Spotify
- Adicionar faixas às playlists
- Integração com YouTube Music (busca e vinculação de faixas)

### Retrospectiva
- Registro automático de reproduções (listening_events)
- Filtros por período (7 dias, 30 dias, este mês, tudo)
- Métricas (reproduções, músicas diferentes, artistas, gêneros)
- Gráficos com top 5 músicas e ranking de artistas

## 7. Características e Restrições do Sistema

### Características
- **Usabilidade** - Interface intuitiva com navegação lateral e bottom-nav responsiva
- **Responsividade** - Adaptado para diferentes tamanhos de tela
- **Desempenho** - Atualizações em tempo real sem recarregamento da página
- **Segurança** - Row Level Security (RLS) habilitado em todas as tabelas
- **Modo demonstração** - Permite visualizar a interface sem configuração do Supabase

### Restrições
- **Segurança** - Nunca utilizar `service_role` no frontend; token Spotify armazenado em `sessionStorage`; Client Secret não deve ser usado no navegador
- **Integração Spotify** - OAuth PKCE obrigatório; prévias podem não estar disponíveis para todas as faixas; aplicação não hospeda nem baixa áudio
- **Integração YouTube Music** - Sujeita às cotas e termos de uso da API; reprodução segue regras da plataforma
- **Banco de Dados** - Todas as operações protegidas por políticas RLS
- **Configuração** - URLs de redirect do Spotify e URLs permitidas no Supabase devem coincidir exatamente com o ambiente
- **API Auxiliar** - Backend Express atualmente possui apenas `GET /api/health`, não sendo utilizado para autenticação ou persistência
- **Persistência** - No modo demonstração, os dados não são salvos

## 8. Como Acessar e Utilizar a Aplicação

### Executar Localmente

#### Frontend
1. Acesse a pasta `frontend/`
2. Copie `.example` para `.env`
3. Preencha as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SPOTIFY_CLIENT_ID`
   - `VITE_SPOTIFY_REDIRECT_URI`
4. Execute:
```bash
npm install
npm run dev
```
5. Acesse: `http://localhost:5173`

#### API Auxiliar (Opcional)
1. Acesse a pasta `backend/`
2. Execute:
```bash
npm install
npm run dev
```
3. Acesse: `http://localhost:3000/api/health`

### Configuração do Supabase
1. Crie um projeto no [Supabase](https://supabase.com/)
2. Ative Email em Authentication > Providers (Google opcional)
3. Adicione `http://localhost:5173` em Authentication > URL Configuration
4. Copie URL e chave anon para o `.env` do frontend
5. Execute o arquivo `frontend/supabase/schema.sql` no SQL Editor

### Configuração do Spotify
1. Crie um app em [Spotify for Developers](https://developer.spotify.com/dashboard)
2. Adicione `http://localhost:5173/spotify/callback` como Redirect URI
3. Coloque apenas o Client ID em `VITE_SPOTIFY_CLIENT_ID`
4. Defina `VITE_SPOTIFY_REDIRECT_URI` com a mesma URL cadastrada

### Publicação na Vercel
1. Importe o repositório na Vercel
2. Defina `frontend` como Root Directory
3. Configure as variáveis `VITE_*`
4. Adicione o domínio às URLs permitidas no Supabase e às Redirect URIs do Spotify

## 9. Descrição Resumida da Participação de Cada Membro no Desenvolvimento

| Membro | Participação |
|---|---|
| Gabriel | Desenvolvimento frontend (componentes, rotas e páginas), integração com Supabase, estilização com Tailwind CSS. |
| Adrian | Integração com Spotify (OAuth PKCE, busca, importação de playlists), reprodutor de música e funcionalidades da biblioteca. |
| Lucas M | Modelagem do banco de dados (schema SQL, RLS), funcionalidades sociais (posts, curtidas, mensagens). |
| Kemily | Retrospectiva com gráficos e documentação do projeto. |


*Observação:* Preencher os nomes e detalhar a participação conforme a contribuição efetiva de cada integrante do grupo.
