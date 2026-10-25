// Banner do perfil público: cor sólida, gradiente ou imagem.
// As cores vêm do banco, então só entram no estilo o que parecer uma cor.
const corSegura = (cor, fallback) => (/^#[0-9a-fA-F]{6}$/.test(cor || '') ? cor : fallback)

export const bannerStyle = (profile) => {
  const tipo = profile?.banner_type || 'color'
  if (tipo === 'image' && profile?.banner_url) {
    return { backgroundImage: `url(${JSON.stringify(profile.banner_url)})` }
  }
  if (tipo === 'gradient') {
    const inicio = corSegura(profile?.banner_color, '#14b881')
    const fim = corSegura(profile?.banner_color_end, '#10251f')
    return { backgroundImage: `linear-gradient(120deg, ${inicio}, ${fim})` }
  }
  return { backgroundColor: corSegura(profile?.banner_color, '#14b881') }
}

export const BANNER_PRESETS = [
  ['Verde Harmony', '#14b881', '#10251f'],
  ['Noite', '#1f2a44', '#0b1020'],
  ['Sol', '#ffb347', '#ff5e62'],
  ['Oceano', '#2193b0', '#6dd5ed'],
  ['Roxo', '#7f00ff', '#e100ff'],
  ['Carvão', '#3a3a3a', '#0d0d0d'],
]
