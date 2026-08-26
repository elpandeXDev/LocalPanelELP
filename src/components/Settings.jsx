import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Settings as SettingsIcon, Lock, User, Check, AlertCircle, Container, ToggleLeft, ToggleRight, Loader2, Shield, ShieldAlert } from 'lucide-react'

export default function Settings({ username }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const [dockerStatus, setDockerStatus] = useState(null)
  const [dockerLoading, setDockerLoading] = useState(true)
  const [executionMode, setExecutionMode] = useState('local')
  const [switchingMode, setSwitchingMode] = useState(false)
  const [dockerMessage, setDockerMessage] = useState(null)

  useEffect(() => {
    api.settings.dockerStatus()
      .then((data) => {
        setDockerStatus(data.docker)
        setExecutionMode(data.executionMode)
      })
      .catch(() => {})
      .finally(() => setDockerLoading(false))
  }, [])

  const handleSwitchMode = async (mode) => {
    if (mode === executionMode) return
    setSwitchingMode(true)
    setDockerMessage(null)
    try {
      await api.settings.setExecutionMode(mode)
      setExecutionMode(mode)
      setDockerMessage({ type: 'success', text: mode === 'docker' ? 'Modo Docker activado. Servidores y bots se ejecutaran en contenedores aislados.' : 'Modo local activado.' })
      setTimeout(() => setDockerMessage(null), 4000)
    } catch (err) {
      setDockerMessage({ type: 'error', text: err.message })
    } finally {
      setSwitchingMode(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' })
      return
    }
    if (newPassword.length < 4) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 4 caracteres' })
      return
    }

    setLoading(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setMessage({ type: 'success', text: 'Contraseña cambiada correctamente' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Ajustes</h1>
        <p className="text-slate-400 mt-1">Configuracion del panel</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-panel-600/20 border border-panel-500/30 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-panel-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Informacion de la cuenta</h3>
            <p className="text-sm text-slate-400">Detalles del usuario administrador</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-sm text-slate-400">Usuario</span>
            <span className="text-sm text-slate-200 font-medium">{username}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-sm text-slate-400">Rol</span>
            <span className="text-sm text-slate-200 font-medium">Administrador</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-400">Panel</span>
            <span className="text-sm text-slate-200 font-medium">LocalPanelELP v1.0.0</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
            <Container className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Modo de Ejecucion</h3>
            <p className="text-sm text-slate-400">Aislamiento de servidores y bots en contenedores Docker</p>
          </div>
        </div>

        {dockerLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${dockerStatus?.installed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {dockerStatus?.installed ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {dockerStatus?.installed ? 'Docker instalado' : 'Docker no detectado'}
                </p>
                {dockerStatus?.version && (
                  <p className="text-xs opacity-70">{dockerStatus.version}</p>
                )}
              </div>
              {dockerStatus?.installed && (
                <span className={`text-xs px-2 py-1 rounded-md ${dockerStatus.running ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {dockerStatus.running ? 'En ejecucion' : 'Detenido'}
                </span>
              )}
            </div>

            {executionMode === 'docker' && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-xs">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Modo Docker activo:</strong> Los servidores Minecraft y bots de Discord se ejecutaran
                  dentro de contenedores aislados. El codigo malicioso no podra acceder a tu sistema operativo.
                  Requiere que Docker Desktop este en ejecucion.
                </span>
              </div>
            )}

            {executionMode === 'local' && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Modo local activo:</strong> Los servidores y bots se ejecutan directamente en tu sistema.
                  Si un servidor o bot contiene malware, podria acceder a tus archivos. Considera activar modo Docker.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSwitchMode(executionMode === 'docker' ? 'local' : 'docker')}
                  disabled={switchingMode || (!dockerStatus?.installed && executionMode === 'local')}
                  className="disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {executionMode === 'docker' ? (
                    <ToggleRight className="w-10 h-10 text-blue-400" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-500" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {executionMode === 'docker' ? 'Docker (Aislado)' : 'Local (Sin aislar)'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {switchingMode ? 'Cambiando...' : 'Haz clic para cambiar el modo'}
                  </p>
                </div>
              </div>
              {switchingMode && <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />}
            </div>

            {dockerMessage && (
              <div
                className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 fade-in ${
                  dockerMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {dockerMessage.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {dockerMessage.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-600/20 border border-amber-500/30 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Cambiar Contraseña</h3>
            <p className="text-sm text-slate-400">Actualiza tu contraseña de acceso</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 fade-in ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Cambiar Contraseña
              </>
            )}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-slate-600/20 border border-slate-500/30 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Informacion del Sistema</h3>
            <p className="text-sm text-slate-400">Datos del panel</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-sm text-slate-400">Almacenamiento</span>
            <span className="text-sm text-slate-200 font-medium">Carpeta local /storage</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-sm text-slate-400">Limite de subida</span>
            <span className="text-sm text-slate-200 font-medium">10 GB por archivo</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-400">Plataforma</span>
            <span className="text-sm text-slate-200 font-medium">Windows / Node.js</span>
          </div>
        </div>
      </div>
    </div>
  )
}
