import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Arquivos do protótipo anterior não fazem parte da SPA atual.
  globalIgnores(['dist', 'src/components/**', 'src/pages/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Carregamentos assíncronos do Supabase atualizam estado após a resposta.
      // A regra não distingue esse caso de um setState síncrono em effect.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
