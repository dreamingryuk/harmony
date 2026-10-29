import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Plus, Users, X } from 'lucide-react'
import { configured, supabase } from '../lib/supabase'
import { Avatar, Empty, Page, Section } from '../components/Media'
import { ProfilePopup } from '../components/ProfilePopup'
import {
  abrirPost,
  enviarImagemComunidade,
  erroDeComunidade,
  imagemValida,
  mensagemDeEntrada,
  PRIVACIDADES,
} from '../utils/community'

const isMention = (notification) =>
  notification.kind === 'post_mention' || notification.kind === 'comment_mention'

// Ícone da comunidade: a imagem enviada ou as iniciais do título.
function CommunityIcon({ community, size = '' }) {
  if (community.icone_url) {
    return (
      <span className={`community-icon ${size}`}>
        <img src={community.icone_url} alt={`Ícone de ${community.nome}`} />
      </span>
    )
  }
  const iniciais = community.nome
    .split(' ')
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return <span className={`community-icon ${size}`}>{iniciais}</span>
}

function CommunityCard({
  community,
  membros,
  souMembro,
  pedidoPendente,
  busy,
  onEntrar,
  onPedir,
  onSair,
  onAbrir,
}) {
  const info = PRIVACIDADES[community.visibilidade] || PRIVACIDADES.publica
  return (
    <article className="community-card">
      <button
        type="button"
        className="community-card-banner"
        style={
          community.banner_url ? { backgroundImage: `url(${community.banner_url})` } : undefined
        }
        onClick={onAbrir}
        aria-label={`Abrir ${community.nome}`}
      />
      <div className="community-card-body">
        <CommunityIcon community={community} />
        <div className="community-card-copy">
          <button type="button" className="name-link" onClick={onAbrir}>
            <b>{community.nome}</b>
          </button>
          <p>{community.descricao || 'Sem descrição.'}</p>
          <small>
            <Users size={13} /> {membros} {membros === 1 ? 'membro' : 'membros'}
          </small>
        </div>
        <span className={`privacy-badge privacy-${community.visibilidade}`}>
          <info.icone size={13} /> {info.rotulo}
        </span>
        <div className="community-card-actions">
          {souMembro ? (
            <button
              type="button"
              className="secondary small-button"
              disabled={busy}
              onClick={onSair}
            >
              Sair
            </button>
          ) : community.visibilidade === 'publica' ? (
            <button
              type="button"
              className="primary small-button"
              disabled={busy}
              onClick={onEntrar}
            >
              Entrar
            </button>
          ) : community.visibilidade === 'por_convite' ? (
            pedidoPendente ? (
              <span className="community-pending">
                <Check size={14} /> Pedido enviado
              </span>
            ) : (
              <button
                type="button"
                className="primary small-button"
                disabled={busy}
                onClick={onPedir}
              >
                Pedir para entrar
              </button>
            )
          ) : (
            <button
              type="button"
              className="primary small-button"
              disabled={busy}
              onClick={onEntrar}
            >
              Entrar com senha
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function PasswordDialog({ community, onClose, onSuccess }) {
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    if (!senha) return
    setBusy(true)
    setErro('')
    try {
      const { data, error } = await supabase.rpc('entrar_comunidade', {
        p_slug: community.slug,
        p_senha: senha,
      })
      if (error) throw error
      if (data === 'ok') return onSuccess()
      setErro(mensagemDeEntrada(data))
    } catch (error) {
      setErro(erroDeComunidade(error, 'Não foi possível entrar'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal community-password"
        role="dialog"
        aria-modal="true"
        aria-label={`Entrar em ${community.nome}`}
      >
        <header>
          <div>
            <h2>Entrar em {community.nome}</h2>
            <p className="hint">Esta comunidade é privada: digite a senha para entrar.</p>
          </div>
          <button type="button" className="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="editor-fields">
            <label>
              Senha da comunidade
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoFocus
                required
                placeholder="Senha"
              />
            </label>
          </div>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateCommunityDialog({ app, onClose, onCreated }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [visibilidade, setVisibilidade] = useState('publica')
  const [senha, setSenha] = useState('')
  const [icone, setIcone] = useState(null)
  const [banner, setBanner] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const escolherImagem = (campo) => (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!imagemValida(file)) {
      return setFormError('Formato inválido. Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.')
    }
    setFormError('')
    setCampo(campo, { file, url: URL.createObjectURL(file) })
  }

  const setCampo = (campo, valor) => {
    if (campo === 'icone') {
      setIcone((atual) => {
        if (atual?.url) URL.revokeObjectURL(atual.url)
        return valor
      })
    } else {
      setBanner((atual) => {
        if (atual?.url) URL.revokeObjectURL(atual.url)
        return valor
      })
    }
  }

  const criar = async (event) => {
    event.preventDefault()
    setFormError('')
    if (nome.trim().length < 3) return setFormError('O título precisa ter pelo menos 3 caracteres.')
    if (visibilidade === 'privada' && senha.length < 4) {
      return setFormError('A senha precisa ter pelo menos 4 caracteres.')
    }
    setSaving(true)
    try {
      let iconeUrl = ''
      let bannerUrl = ''
      if (icone?.file)
        iconeUrl = await enviarImagemComunidade('comunidades', app.user.id, icone.file)
      if (banner?.file)
        bannerUrl = await enviarImagemComunidade('comunidades', app.user.id, banner.file)
      const { data, error } = await supabase.rpc('criar_comunidade', {
        p_nome: nome.trim(),
        p_descricao: descricao.trim(),
        p_icone_url: iconeUrl,
        p_banner_url: bannerUrl,
        p_visibilidade: visibilidade,
        p_senha: visibilidade === 'privada' ? senha : null,
      })
      if (error) throw error
      onCreated(data)
    } catch (error) {
      setFormError(erroDeComunidade(error, 'Não foi possível criar a comunidade'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal community-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Criar comunidade"
      >
        <header>
          <div>
            <span className="eyebrow">
              <Users /> Novo fórum
            </span>
            <h2>Criar comunidade</h2>
          </div>
          <button type="button" className="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <form onSubmit={criar}>
          <div className="editor-fields">
            <div className="community-media-fields">
              <label className="community-media-field">
                <span>Ícone</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={escolherImagem('icone')}
                />
                <span className="community-media-preview community-icon big">
                  {icone ? (
                    <img src={icone.url} alt="Prévia do ícone" />
                  ) : (
                    nome
                      .trim()
                      .split(' ')
                      .map((parte) => parte[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '?'
                  )}
                </span>
              </label>
              <label className="community-media-field">
                <span>Banner</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={escolherImagem('banner')}
                />
                <span
                  className="community-media-preview community-banner-preview"
                  style={banner ? { backgroundImage: `url(${banner.url})` } : undefined}
                />
              </label>
            </div>
            <label>
              Título
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                maxLength={32}
                required
                placeholder="Ex.: Fãs de rock"
              />
            </label>
            <label>
              Descrição
              <textarea
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Do que trata este fórum?"
              />
            </label>
            <fieldset className="privacy-options">
              <legend>Quem pode entrar</legend>
              {Object.entries(PRIVACIDADES).map(([valor, info]) => (
                <label
                  key={valor}
                  className={`privacy-option ${visibilidade === valor ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="visibilidade"
                    value={valor}
                    checked={visibilidade === valor}
                    onChange={() => setVisibilidade(valor)}
                  />
                  <info.icone size={17} />
                  <span>
                    <b>{info.rotulo}</b>
                    <small>{info.resumo}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {visibilidade === 'privada' && (
              <label>
                Senha da comunidade
                <input
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  minLength={4}
                  required
                  placeholder="Quem souber a senha entra"
                />
              </label>
            )}
          </div>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Criando...' : 'Criar comunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Communities({ app }) {
  const navigate = useNavigate()
  const [comunidades, setComunidades] = useState([])
  const [membros, setMembros] = useState([])
  const [pedidos, setPedidos] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [senhaPara, setSenhaPara] = useState(null)
  const [criando, setCriando] = useState(false)
  const [profilePopup, setProfilePopup] = useState(null)
  const [newProfiles, setNewProfiles] = useState([])
  const [newProfilesLoading, setNewProfilesLoading] = useState(true)

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }
    const [comunidadeQuery, membroQuery, pedidoQuery] = await Promise.all([
      supabase.from('comunidades').select('*').order('criada_em', { ascending: true }),
      supabase.from('comunidade_membros').select('comunidade_id, usuario_id, papel'),
      supabase
        .from('comunidade_pedidos')
        .select('comunidade_id')
        .eq('usuario_id', app.user.id)
        .eq('status', 'pendente'),
    ])
    const falha = comunidadeQuery.error || membroQuery.error || pedidoQuery.error
    if (falha) {
      setError(erroDeComunidade(falha, 'Não foi possível carregar as comunidades'))
      setLoading(false)
      return
    }
    setError('')
    setComunidades(comunidadeQuery.data || [])
    setMembros(membroQuery.data || [])
    setPedidos(new Set((pedidoQuery.data || []).map((pedido) => pedido.comunidade_id)))
    setLoading(false)
  }, [app.user.id])

  useEffect(() => {
    load()
  }, [load])

  // Novos perfis do Harmony continuam sendo sugeridos nesta aba.
  useEffect(() => {
    if (!configured) return
    let active = true
    setNewProfilesLoading(true)
    Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, created_at')
        .neq('id', app.user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('follows').select('followed_id').eq('follower_id', app.user.id),
    ])
      .then(([{ data, error: profileError }, { data: follows }]) => {
        if (!active) return
        setNewProfilesLoading(false)
        if (profileError) return
        const followed = new Set((follows || []).map((follow) => follow.followed_id))
        setNewProfiles((data || []).filter((profile) => !followed.has(profile.id)))
      })
      .catch(() => {
        if (active) {
          setNewProfiles([])
          setNewProfilesLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [app.user.id])

  const contagem = {}
  for (const membro of membros) {
    contagem[membro.comunidade_id] = (contagem[membro.comunidade_id] || 0) + 1
  }
  const meuMembro = new Map(
    membros
      .filter((membro) => membro.usuario_id === app.user.id)
      .map((membro) => [membro.comunidade_id, membro.papel])
  )

  const entrar = async (comunidade) => {
    if (comunidade.visibilidade === 'privada') return setSenhaPara(comunidade)
    setBusy(comunidade.id)
    try {
      const { data, error: rpcError } = await supabase.rpc('entrar_comunidade', {
        p_slug: comunidade.slug,
      })
      if (rpcError) throw rpcError
      if (data === 'ok') return navigate(`/comunidades/${comunidade.slug}`)
      if (data === 'aprovacao') return pedir(comunidade)
      throw new Error(mensagemDeEntrada(data))
    } catch (entrarError) {
      setError(erroDeComunidade(entrarError, 'Não foi possível entrar'))
    } finally {
      setBusy('')
    }
  }

  const pedir = async (comunidade) => {
    setBusy(comunidade.id)
    try {
      const { data, error: rpcError } = await supabase.rpc('pedir_entrar_comunidade', {
        p_slug: comunidade.slug,
      })
      if (rpcError) throw rpcError
      if (data === 'ok') return navigate(`/comunidades/${comunidade.slug}`)
      if (data === 'pendente') {
        setPedidos((atual) => new Set(atual).add(comunidade.id))
        setError('')
        return
      }
      throw new Error(mensagemDeEntrada(data))
    } catch (pedirError) {
      setError(erroDeComunidade(pedirError, 'Não foi possível pedir entrada'))
    } finally {
      setBusy('')
    }
  }

  const sair = async (comunidade) => {
    setBusy(comunidade.id)
    try {
      const { data, error: rpcError } = await supabase.rpc('sair_comunidade', {
        p_slug: comunidade.slug,
      })
      if (rpcError) throw rpcError
      if (data !== 'ok') throw new Error(mensagemDeEntrada(data))
      await load()
    } catch (sairError) {
      setError(erroDeComunidade(sairError, 'Não foi possível sair'))
    } finally {
      setBusy('')
    }
  }

  const minhas = comunidades.filter((comunidade) => meuMembro.has(comunidade.id))
  const outras = comunidades.filter((comunidade) => !meuMembro.has(comunidade.id))

  const cartao = (comunidade) => (
    <CommunityCard
      key={comunidade.id}
      community={comunidade}
      membros={contagem[comunidade.id] || 0}
      souMembro={meuMembro.has(comunidade.id)}
      pedidoPendente={pedidos.has(comunidade.id)}
      busy={busy === comunidade.id}
      onAbrir={() => navigate(`/comunidades/${comunidade.slug}`)}
      onEntrar={() => entrar(comunidade)}
      onPedir={() => pedir(comunidade)}
      onSair={() => sair(comunidade)}
    />
  )

  return (
    <Page title="Comunidades" subtitle="Entre nos fóruns do Harmony ou crie o seu.">
      <div className="page-actions">
        <button type="button" className="primary" onClick={() => setCriando(true)}>
          <Plus /> Criar comunidade
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {app.mentionNotifications?.filter(isMention).length > 0 && (
        <Section title="Menções">
          <div className="mention-notifications">
            {app.mentionNotifications.filter(isMention).map((notification) => (
              <button
                className="mention-notification"
                key={notification.id}
                type="button"
                onClick={() => abrirPost(navigate, notification.post_id, notification.id)}
              >
                <Bell size={18} />
                <span>
                  <b>{notification.actor?.display_name || 'Alguém'}</b>
                  <small>
                    {notification.kind === 'comment_mention'
                      ? 'mencionou você em uma resposta'
                      : 'mencionou você em uma publicação'}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {loading ? (
        <p className="hint">Carregando comunidades...</p>
      ) : (
        <>
          <Section title="Minhas comunidades">
            {minhas.length ? (
              <div className="community-grid">{minhas.map(cartao)}</div>
            ) : (
              <Empty text="Você ainda não participa de nenhum fórum. Entre em um ou crie o seu." />
            )}
          </Section>
          <Section title="Todos os fóruns">
            {outras.length ? (
              <div className="community-grid">{outras.map(cartao)}</div>
            ) : (
              <Empty text="Nenhum outro fórum por aqui. Seja a primeira voz e crie uma comunidade." />
            )}
          </Section>
        </>
      )}
      {(newProfilesLoading || newProfiles.length > 0) && (
        <Section title="Novos na Harmony">
          <div className="new-people-grid" aria-busy={newProfilesLoading}>
            {newProfilesLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <div className="new-person-card new-person-skeleton" key={index} />
              ))}
            {newProfiles.map((profile) => (
              <button
                type="button"
                className="new-person-card"
                key={profile.id}
                onClick={() => setProfilePopup(profile)}
              >
                <Avatar profile={profile} />
                <div>
                  <b>{profile.display_name || 'Novo membro'}</b>
                  <small>@{profile.username}</small>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}
      {criando && (
        <CreateCommunityDialog
          app={app}
          onClose={() => setCriando(false)}
          onCreated={(slug) => {
            setCriando(false)
            navigate(`/comunidades/${slug}`)
          }}
        />
      )}
      {senhaPara && (
        <PasswordDialog
          community={senhaPara}
          onClose={() => setSenhaPara(null)}
          onSuccess={() => {
            const slug = senhaPara.slug
            setSenhaPara(null)
            navigate(`/comunidades/${slug}`)
          }}
        />
      )}
      {profilePopup && (
        <ProfilePopup
          profile={profilePopup}
          userId={app.user.id}
          onClose={() => setProfilePopup(null)}
        />
      )}
    </Page>
  )
}
