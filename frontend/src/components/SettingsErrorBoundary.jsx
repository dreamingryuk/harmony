import { Component } from 'react'

export class SettingsErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Falha ao renderizar Configurações:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="callback" role="alert">
          <h1>Não foi possível abrir as Configurações</h1>
          <p>{this.state.error.message}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
