# Arquitetura do Harmony

## Aplicação

`src/main.jsx` monta `App.jsx`, que compõe o roteamento da aplicação. As telas ficam separadas em `src/pages/`, e os componentes reutilizáveis em `src/components/`. `src/hooks/` concentra o estado e os fluxos compartilhados da sessão; `src/lib/` contém os adaptadores dos serviços externos e persistência, enquanto `src/utils/` guarda transformações e regras sem interface.

Essa estrutura é MVC-inspirada para uma aplicação React: `lib/` e `utils/` formam a camada de modelo, hooks e ações das telas coordenam os fluxos, e páginas/componentes formam as views. A lógica específica de uma tela permanece junto dela para evitar abstrações artificiais; funcionalidades compartilhadas devem ser extraídas para hooks, componentes ou módulos de domínio quando passarem a ser reutilizadas.

Para encontrar os fluxos principais: autenticação e sessão em `hooks/useSynq.js` e `pages/Auth.jsx`; biblioteca em `pages/Library.jsx`; comunidade e mensagens em `pages/Community.jsx` e `pages/Messages.jsx`; perfil e configurações em `pages/Profile.jsx` e `pages/AccountSettings.jsx`; apresentação e edição de playlists em `components/PlaylistComponents.jsx`.

O frontend acessa Supabase diretamente. O diretório `backend/` na raiz contém uma API Express auxiliar com apenas `GET /api/health`; ela não faz parte do fluxo de autenticação ou persistência.

## Dados

- `profiles`: perfil público. `account_preferences`: preferências privadas, protegidas por RLS.
- `posts`, `post_likes`, `follows` e `messages`: recursos sociais.
- `saved_tracks`, `playlists` e `playlist_tracks`: biblioteca e playlists do Harmony.
- `listening_events`: reproduções detectadas pelo player integrado do YouTube. O player Spotify é incorporado por iframe e não expõe ao Harmony os eventos de reprodução; a retrospectiva não lê o histórico privado completo de nenhum serviço.

O schema e as políticas Row Level Security estão em `supabase/schema.sql`. Execute-o uma vez em um projeto novo do Supabase; depois, aplique os complementos `supabase/profile-playlists-notifications.sql`, `supabase/profile-genres.sql` e `supabase/account-settings.sql` para habilitar as políticas adicionais, validar gêneros e preferências de conta no banco. O complemento `profile-playlists-notifications.sql` também cria o bucket público `avatars` (com upload limitado à pasta do usuário) e adiciona `profiles.avatar_url`. Ele é obrigatório para que o envio de fotos e os avatares da comunidade funcionem em um banco existente. Se aparecer `Bucket not found` ou `profiles_1.avatar_url does not exist`, execute esse arquivo inteiro pelo SQL Editor do Supabase; não é necessário recriar nem apagar dados. As funções `avatar`, `cancel-email-change` e `delete-account` devem ser publicadas com `supabase functions deploy <nome>`.

## Configuração e segurança

As variáveis `VITE_*` são incorporadas ao bundle do navegador e não podem conter segredos. A chave anon/public do Supabase depende de políticas RLS corretas; nunca coloque a chave `service_role` no frontend. O OAuth Spotify usa PKCE e mantém o token temporário em `sessionStorage`.

## Player e plataformas musicais

Spotify usa o OAuth PKCE existente para busca e o player incorporado oficial do Spotify para tocar a faixa; previews da API não são necessários nem garantidos. A reprodução incorporada pode depender da disponibilidade do conteúdo e das regras/estado de login do próprio Spotify. O usuário controla o player nos controles fornecidos pelo Spotify.

O YouTube Music não fornece uma API pública oficial para pesquisar/reproduzir diretamente seu catálogo ou biblioteca pessoal. A integração usa a YouTube Data API v3 para buscar vídeos musicais que aceitam incorporação e o YouTube IFrame Player API oficial para reprodução, sem exigir assinatura YouTube Music Premium ou login Google. Configure `VITE_YOUTUBE_API_KEY` usando uma chave do Google Cloud com YouTube Data API v3 ativada e restrição por HTTP referrer para os domínios do site; essa chave é pública no bundle do navegador e nunca deve ter permissões além de API/quota apropriadas. A busca usa a quota padrão da YouTube Data API, portanto aplique monitoramento e limites no Google Cloud. Consulte [Search: list](https://developers.google.com/youtube/v3/docs/search/list) e [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference).

A conexão Spotify é local à sessão do navegador. A ativação YouTube guarda apenas a escolha local por usuário neste navegador; não é um vínculo de conta Google. A tela Configurações pode desconectar/desativar ambos. As músicas encontradas no YouTube também podem ser anexadas à comunidade e mensagens e são reproduzidas no player incorporado.

As configurações de conta usam Supabase Auth para validar a senha atual, aplicar a política de senha e iniciar alterações de e-mail com confirmação. No projeto remoto, configure o tamanho mínimo da senha como 8 caracteres, requisito `letters_digits`, validade de link de confirmação/recuperação de 1 hora, SMTP confiável e as URLs `/configuracoes` e `/redefinir-senha` na lista de redirecionamentos permitidos. Ative as notificações de segurança de alteração de senha no painel Auth/SMTP para enviar o aviso ao usuário. A confirmação segura de alteração de e-mail do Supabase pode exigir confirmação no endereço atual e no novo endereço; mantenha essa proteção ativada. As tentativas de reautenticação passam pelo rate limit de sign-in do Supabase Auth.

A página Configurações consegue encerrar todas as outras sessões pelo escopo `others` do Supabase Auth. Isso revoga os tokens de atualização; JWTs de acesso já emitidos permanecem válidos até expirarem. A API cliente não oferece uma listagem confiável nem encerramento individual de sessões de outros dispositivos; por isso a tela identifica a sessão atual e permite encerrar as demais em conjunto, sem simular dados de dispositivos que o Auth não expõe.

## Verificações disponíveis

```bash
npm run lint
npm run format:check
npm run build
```
