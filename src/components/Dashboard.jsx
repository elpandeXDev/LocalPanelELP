import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { HardDrive, FileText, Folder, Upload, FolderTree, TrendingUp, Gamepad2, Bot, Link2 } from 'lucide-react'

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.files.stats().then((data) => {
      setStats(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const statCards = [
    {
      label: 'Almacenamiento Total',
      value: stats?.totalSizeFormatted || '0 B',
      icon: HardDrive,
      color: 'panel',
      desc: 'Tamano de todos los archivos',
    },
    {
      label: 'Archivos',
      value: stats?.totalFiles ?? 0,
      icon: FileText,
      color: 'blue',
      desc: 'Archivos almacenados',
    },
    {
      label: 'Carpetas',
      value: stats?.totalFolders ?? 0,
      icon: Folder,
      color: 'emerald',
      desc: 'Carpetas creadas',
    },
  ]

  const colorMap = {
    panel: { bg: 'bg-panel-600/20', border: 'border-panel-500/30', text: 'text-panel-400' },
    blue: { bg: 'bg-blue-600/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Vista general de tu almacenamiento local</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-panel-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon
              const c = colorMap[card.color]
              return (
                <div key={card.label} className="card p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{card.label}</p>
                      <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
                    </div>
                    <div className={`w-12 h-12 ${c.bg} ${c.border} border rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${c.text}`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-panel-600/20 border border-panel-500/30 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-panel-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Subir Archivos</h3>
                  <p className="text-sm text-slate-400">Sube cualquier tipo de archivo</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Arrastra y suelta o selecciona archivos para subirlos al panel. Soporta todos los formatos.
              </p>
              <button onClick={() => onNavigate('files')} className="btn-primary">
                <FolderTree className="w-4 h-4" />
                Ir al Gestor de Archivos
              </button>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-600/20 border border-emerald-500/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Estado del Sistema</h3>
                  <p className="text-sm text-slate-400">Informacion del panel</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Estado del servidor</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    En ejecucion
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Almacenamiento</span>
                  <span className="text-slate-200 font-medium">{stats?.totalSizeFormatted || '0 B'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Limite por archivo</span>
                  <span className="text-slate-200 font-medium">10 GB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Archivos simultaneos</span>
                  <span className="text-slate-200 font-medium">100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => onNavigate('minecraft')} className="card p-5 text-left hover:border-panel-500/30 transition-colors group">
              <div className="w-10 h-10 bg-panel-600/20 border border-panel-500/30 rounded-lg flex items-center justify-center mb-3">
                <Gamepad2 className="w-5 h-5 text-panel-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">Minecraft</h3>
              <p className="text-xs text-slate-400 mt-1">Detecta y configura servidores de Minecraft</p>
            </button>
            <button onClick={() => onNavigate('bots')} className="card p-5 text-left hover:border-panel-500/30 transition-colors group">
              <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-lg flex items-center justify-center mb-3">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">Bots de Discord</h3>
              <p className="text-xs text-slate-400 mt-1">Gestiona bots de cualquier lenguaje</p>
            </button>
            <button onClick={() => onNavigate('dirs')} className="card p-5 text-left hover:border-panel-500/30 transition-colors group">
              <div className="w-10 h-10 bg-amber-600/20 border border-amber-500/30 rounded-lg flex items-center justify-center mb-3">
                <Link2 className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">Directorios</h3>
              <p className="text-xs text-slate-400 mt-1">Vincula carpetas de tu sistema</p>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
