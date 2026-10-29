// Catálogo único de temas do Harmony.
// Cada tema é aplicado via data-theme (variáveis CSS em App.css) e
// data-mode (light|dark) para os ajustes de componentes escuros.
// A escolha fica salva em localStorage e vale para todas as páginas.

export const THEME_STORAGE_KEY = 'harmony-theme'

export const DEFAULT_THEME = 'minimal-light'

// Cores usadas apenas na miniatura de preview da galeria de temas.
export const THEMES = [
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    mode: 'light',
    metaColor: '#f3f6f5',
    preview: { bg: '#f4f7f5', sidebar: '#ffffff', accent: '#14b881', text: '#17201d' },
  },
  {
    id: 'botanical',
    name: 'Botanical',
    mode: 'light',
    metaColor: '#eef0e2',
    preview: { bg: '#eef0e2', sidebar: '#2f4a33', accent: '#4c8a5a', text: '#22301f' },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    mode: 'light',
    metaColor: '#ffffff',
    preview: { bg: '#ffffff', sidebar: '#ffffff', accent: '#14110f', text: '#14110f' },
  },
  {
    id: 'soft-pastel',
    name: 'Soft Pastel',
    mode: 'light',
    metaColor: '#f3f0fb',
    preview: { bg: '#f3f0fb', sidebar: '#ffffff', accent: '#9b8cf5', text: '#2c2640' },
  },
  {
    id: 'neo-rutalism',
    name: 'Neo-Rutalism',
    mode: 'light',
    metaColor: '#fdfdf9',
    preview: { bg: '#fdfdf9', sidebar: '#ffffff', accent: '#ffdd00', text: '#101010' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    metaColor: '#0a1424',
    preview: { bg: '#0a1424', sidebar: '#0d1b33', accent: '#5b8cff', text: '#e8eefc' },
  },
  {
    id: 'oled-neon',
    name: 'OLED Neon',
    mode: 'dark',
    metaColor: '#000000',
    preview: { bg: '#000000', sidebar: '#000000', accent: '#39ff14', text: '#e6ffe6' },
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    mode: 'dark',
    metaColor: '#2a1420',
    preview: { bg: '#2a1420', sidebar: '#331426', accent: '#ff8a4c', text: '#ffe9dd' },
  },
  {
    id: 'cyber-terminal',
    name: 'Cyber Terminal',
    mode: 'dark',
    metaColor: '#020803',
    preview: { bg: '#020803', sidebar: '#020803', accent: '#00ff66', text: '#9dffb8' },
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    mode: 'dark',
    metaColor: '#1c2431',
    preview: { bg: '#1c2431', sidebar: '#171f2b', accent: '#5b9bd5', text: '#e6ebf2' },
  },
]

const LEGACY_THEME_MAP = {
  dark: 'midnight',
  light: DEFAULT_THEME,
  auto: DEFAULT_THEME,
}

export function isKnownTheme(value) {
  return THEMES.some((theme) => theme.id === value)
}

// Aceita ids atuais e converte valores antigos ('light'/'dark'/'auto').
export function normalizeTheme(value) {
  if (isKnownTheme(value)) return value
  return LEGACY_THEME_MAP[value] || DEFAULT_THEME
}

export function themeMode(themeId) {
  return THEMES.find((theme) => theme.id === normalizeTheme(themeId))?.mode === 'dark' ? 'dark' : 'light'
}

export function themeMetaColor(themeId) {
  return THEMES.find((theme) => theme.id === normalizeTheme(themeId))?.metaColor || '#f3f6f5'
}

export function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

// Aplica o tema no documento inteiro (todas as páginas) e atualiza a cor da barra do navegador.
export function applyTheme(themeId) {
  const theme = normalizeTheme(themeId)
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.mode = themeMode(theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', themeMetaColor(theme))
  return theme
}

// Salva a escolha e aplica imediatamente.
export function setTheme(themeId) {
  const theme = normalizeTheme(themeId)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Sem armazenamento disponível: o tema ainda vale para a sessão atual.
  }
  applyTheme(theme)
  return theme
}
