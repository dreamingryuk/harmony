

export function passwordPolicyError(password) {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'A senha precisa conter pelo menos uma letra e um número.'
  }
  return ''
}

export function passwordStrength(password) {
  if (!password) return { label: 'Não informada', score: 0 }
  const score =
    Number(password.length >= 8) +
    Number(password.length >= 12) +
    Number(/[A-Z]/.test(password) && /[a-z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte']
  return { label: labels[score], score }
}

export function browserDescription() {
  const agent = navigator.userAgent
  const browser = /Edg\//.test(agent)
    ? 'Microsoft Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Google Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Navegador'
  const system = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(agent)
      ? 'iOS'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : 'Sistema não identificado'
  return `${browser} · ${system}`
}
