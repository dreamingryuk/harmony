import { Component } from 'react'

// Última linha de defesa: qualquer erro de renderização vira uma tela com a
// explicação e um botão para recarregar, em vez da página em branco que o
// React mostraria ao desmontar a árvore inteira.
export class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Falha inesperada no aplicativo:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="callback" role="alert">
          <h1>Algo deu errado por aqui</h1>
          <p>{this.state.error.message || 'Erro inesperado ao renderizar a página.'}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
          <button className="secondary" onClick={() => this.setState({ error: null })}>
            Tentar de novo
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
