import { useState } from 'react'
import { Trash2, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  enviarImagemComunidade,
  erroDeComunidade,
  imagemValida,
  mensagemDeEntrada,
  PRIVACIDADES,
} from '../utils/community'

const MENSAGEM_IMAGEM = 'Formato inválido. Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.'

// Uma imagem escolhida nesta sessão mostra a prévia local; sem escolha nova,
// vale a que já está no fórum (url vazia significa "sem imagem").
const novaImagem = (url = '') => ({ file: null, url })

export function CommunityEditorDialog({ app, community = null, onClose, onSaved }) {
  const editando = Boolean(community)
  const [nome, setNome] = useState(community?.nome || '')
  const [descricao, setDescricao] = useState(community?.descricao || '')
  const [visibilidade, setVisibilidade] = useState(community?.visibilidade || 'publica')
  const [senha, setSenha] = useState('')
  const [icone, setIcone] = useState(() => novaImagem(community?.icone_url || ''))
  const [banner, setBanner] = useState(() => novaImagem(community?.banner_url || ''))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const senhaJaExiste = editando && community.visibilidade === 'privada'

  const escolherImagem = (campo) => (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!imagemValida(file)) {
      return setFormError(MENSAGEM_IMAGEM)
    }
    setFormError('')
    const atual = campo === 'icone' ? icone : banner
    if (atual?.url?.startsWith('blob:')) URL.revokeObjectURL(atual.url)
    const proximo = { file, url: URL.createObjectURL(file) }
    campo === 'icone' ? setIcone(proximo) : setBanner(proximo)
  }

  const removerImagem = (campo) => {
    const atual = campo === 'icone' ? icone : banner
    if (atual?.url?.startsWith('blob:')) URL.revokeObjectURL(atual.url)
    const proximo = novaImagem('')
    campo === 'icone' ? setIcone(proximo) : setBanner(proximo)
  }

  const enviar = async (imagem) => {
    if (!imagem.file) return imagem.url
    return enviarImagemComunidade('comunidades', app.user.id, imagem.file)
  }

  const salvar = async (event) => {
    event.preventDefault()
    setFormError('')
    const titulo = nome.trim()
    if (titulo.length < 3) return setFormError('O título precisa ter pelo menos 3 caracteres.')
    if (visibilidade === 'privada' && senha && senha.length < 4) {
      return setFormError('A senha precisa ter pelo menos 4 caracteres.')
    }
    setSaving(true)
    try {
      const [iconeUrl, bannerUrl] = await Promise.all([enviar(icone), enviar(banner)])
      if (!editando) {
        const { data, error } = await supabase.rpc('criar_comunidade', {
          p_nome: titulo,
          p_descricao: descricao.trim(),
          p_icone_url: iconeUrl,
          p_banner_url: bannerUrl,
          p_visibilidade: visibilidade,
          p_senha: visibilidade === 'privada' ? senha : null,
        })
        if (error) throw error
        return onSaved(data)
      }
      const { data, error } = await supabase.rpc('atualizar_comunidade', {
        p_slug: community.slug,
        p_nome: titulo,
        p_descricao: descricao.trim(),
        p_icone_url: iconeUrl,
        p_banner_url: bannerUrl,
        p_visibilidade: visibilidade,
        p_senha: senha ? senha : null,
      })
      if (error) throw error
      if (data !== 'ok') return setFormError(mensagemDeEntrada(data))
      return onSaved(community.slug)
    } catch (saveError) {
      setFormError(
        erroDeComunidade(
          saveError,
          editando ? 'Não foi possível salvar as alterações' : 'Não foi possível criar a comunidade'
        )
      )
    } finally {
      setSaving(false)
    }
  }

  const iniciais =
    nome
      .trim()
      .split(' ')
      .map((parte) => parte[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal community-editor"
        role="dialog"
        aria-modal="true"
        aria-label={editando ? `Configurar ${community.nome}` : 'Criar comunidade'}
      >
        <header>
          <div>
            <span className="eyebrow">
              <Users /> {editando ? 'Configurações do fórum' : 'Novo fórum'}
            </span>
            <h2>{editando ? `Configurar ${community.nome}` : 'Criar comunidade'}</h2>
          </div>
          <button type="button" className="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <form onSubmit={salvar}>
          <div className="editor-fields">
            <div className="community-media-fields">
              <label className="community-media-field">
                <span>Foto de perfil</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={escolherImagem('icone')}
                />
                <span className="community-media-preview community-icon big">
                  {icone.url ? <img src={icone.url} alt="Prévia da foto" /> : iniciais}
                </span>
                {icone.url && (
                  <button
                    type="button"
                    className="secondary small-button"
                    onClick={() => removerImagem('icone')}
                  >
                    <Trash2 size={14} /> Remover foto
                  </button>
                )}
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
                  style={banner.url ? { backgroundImage: `url(${banner.url})` } : undefined}
                />
                {banner.url && (
                  <button
                    type="button"
                    className="secondary small-button"
                    onClick={() => removerImagem('banner')}
                  >
                    <Trash2 size={14} /> Remover banner
                  </button>
                )}
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
                  required={!senhaJaExiste}
                  placeholder={
                    senhaJaExiste ? 'Deixe em branco para manter a senha atual' : 'Nova senha'
                  }
                />
                {senhaJaExiste && (
                  <small className="hint">
                    A senha só é alterada se você preencher este campo.
                  </small>
                )}
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
              {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar comunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
