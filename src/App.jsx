import { useState, useEffect, useCallback, Component } from 'react'
import { api } from './api.js'
import Login from './components/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import FileBrowser from './components/FileBrowser.jsx'
import Settings from './components/Settings.jsx'
import MinecraftPanel from './components/MinecraftPanel.jsx'
import BotManager from './components/BotManager.jsx'
import LinkedDirs from './components/LinkedDirs.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error en el panel:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-slate-300">
          <h2 className="text-xl font-bold text-red-400 mb-2">Ocurrió un error al cargar esta sección</h2>
          <p className="text-sm text-slate-400 mb-4">{this.state.error?.message || 'Error desconocido'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-panel-600 hover:bg-panel-700 text-white rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [username, setUsername] = useState('')
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    api.auth.check()
      .then((data) => {
        if (data.authenticated) {
          setAuthed(true)
          setUsername(data.username)
        } else {
          setAuthed(false)
        }
      })
      .catch(() => {
        setAuthed(false)
      })
  }, [])

  const handleLogin = useCallback((user) => {
    setAuthed(true)
    setUsername(user)
  }, [])

  const handleLogout = useCallback(async () => {
    await api.auth.logout()
    setAuthed(false)
    setUsername('')
  }, [])

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-panel-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Layout username={username} page={page} onPageChange={setPage} onLogout={handleLogout}>
      <ErrorBoundary>
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'files' && <FileBrowser />}
        {page === 'minecraft' && <MinecraftPanel />}
        {page === 'bots' && <BotManager />}
        {page === 'dirs' && <LinkedDirs />}
        {page === 'settings' && <Settings username={username} />}
      </ErrorBoundary>
    </Layout>
  )
}
