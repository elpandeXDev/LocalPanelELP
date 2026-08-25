import { useState } from 'react'
import { api } from '../api.js'
import { Settings as SettingsIcon, Lock, User, Check, AlertCircle } from 'lucide-react'

export default function Settings({ username }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

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
