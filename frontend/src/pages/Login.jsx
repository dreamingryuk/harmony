import React, { useState } from 'react'
import './Login.css'

const Login = () => {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="bg-circle circle-top"></div>
        <div className="bg-circle circle-center"></div>
        <div className="bg-circle circle-bottom"></div>

        <div className="sidebar-content">
          <div className="icon-box icon-small">
            <i className="fa-solid fa-music"></i>
          </div>

          <div className="music-widget">
            <div className="icon-box icon-large">
              <i className="fa-solid fa-music"></i>
            </div>

            <div className="visualizer">
              {[...Array(20)].map((_, index) => (
                <span key={index} className={`bar bar-${(index % 5) + 1}`}></span>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="form-card">
          <div className="toggle-container">
            <button
              className={`toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Entrar
            </button>
            <button
              className={`toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Criar conta
            </button>
          </div>

          <div className="input-group">
            <i className="fa-regular fa-envelope icon"></i>
            <input type="email" placeholder="Email" />
          </div>

          <div className="input-group">
            <i className="fa-solid fa-lock icon"></i>
            <input type="password" placeholder="Senha" />
            <i className="fa-regular fa-eye icon icon-clickable"></i>
          </div>

          <button className="primary-btn">{isLogin ? 'Entrar' : 'Criar Conta'}</button>

          <div className="divider">
            <span className="line"></span>
            <span className="divider-text">ou continue com</span>
            <span className="line"></span>
          </div>

          <div className="social-row">
            <button className="social-btn">
              <i className="fa-solid fa-globe"></i> Google
            </button>
            <button className="social-btn">
              <span className="green-dot"></span> Spotify
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Login
