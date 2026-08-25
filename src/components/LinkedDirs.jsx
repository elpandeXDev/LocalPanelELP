import { useState, useEffect } from 'react'
import { api } from '../api.js'
import {
  FolderTree, Plus, Trash2, Link2, Loader2, X, AlertCircle, FolderOpen, ArrowLeft, HardDrive, Check,
} from 'lucide-react'

export default function LinkedDirs() {
  const [dirs, setDirs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserPath, setBrowserPath] = useState('')
  const [browserParent, setBrowserParent] = useState(null)
  const [browserRoots, setBrowserRoots] = useState([])
  const [browserDirs, setBrowserDirs] = useState([])
  const [selectedBrowsePath, setSelectedBrowsePath] = useState('')

  const load = () => {
    api.linked.list().then((data) => {
      setDirs(data.dirs)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.linked.add(name, path)
      setShowAdd(false)
      setName('')
      setPath('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemove = async (id) => {
    if (!confirm('Seguro que quieres desvincular este directorio?')) return
    await api.linked.remove(id)
    load()
  }

  const loadBrowser = async (targetPath = '') => {
    setBrowserLoading(true)
    try {
      const data = await api.linked.browse(targetPath)
      setBrowserPath(data.path || '')
      setBrowserParent(data.parent || null)
      setBrowserRoots(data.roots || [])
      setBrowserDirs(data.dirs || [])
      setSelectedBrowsePath(data.path || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setBrowserLoading(false)
    }
  }

  const openBrowser = () => {
    setError('')
    setShowBrowser(true)
    loadBrowser(path || '')
  }

  const applySelectedPath = () => {
    if (!selectedBrowsePath) return
    setPath(selectedBrowsePath)
    if (!name.trim()) {
      const normalized = selectedBrowsePath.replace(/\\+$/, '')
      const base = normalized.split('\\').filter(Boolean).pop()
      if (base) setName(base)
    }
    setShowBrowser(false)
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-7 h-7 text-panel-400" />
            Directorios
          </h1>
          <p className="text-slate-400 mt-1">Vincula carpetas de tu sistema para acceder desde el panel</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Vincular Directorio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
        </div>
      ) : dirs.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No hay directorios vinculados.</p>
          <p className="text-slate-500 text-xs mt-1">
            Vincula una carpeta de tu sistema (ej. tu servidor de Minecraft o bot de Discord) para gestionarla desde el panel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dirs.map((dir) => (
            <div key={dir.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-panel-600/20 border border-panel-500/30 rounded-lg flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-panel-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{dir.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">{dir.path}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(dir.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {dir.exists ? (
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                    Disponible
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-md flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    No encontrado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in" onClick={() => setShowAdd(false)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Vincular Directorio</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Mi Servidor Minecraft"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Ruta del directorio</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    className="input-field font-mono text-sm flex-1"
                    placeholder="C:\Users\miusuario\Desktop\server"
                    required
                  />
                  <button type="button" onClick={openBrowser} className="btn-secondary whitespace-nowrap">
                    <FolderOpen className="w-4 h-4" />
                    Buscar ruta
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes escribirla manualmente o elegirla con "Buscar ruta".
                </p>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center">
                  <Link2 className="w-4 h-4" />
                  Vincular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBrowser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 fade-in" onClick={() => setShowBrowser(false)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-2xl slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Buscar ruta del servidor</h3>
              <button onClick={() => setShowBrowser(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 p-2.5 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center gap-2">
              {browserParent && (
                <button onClick={() => loadBrowser(browserParent)} className="btn-secondary text-xs py-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Subir
                </button>
              )}
              <input
                value={selectedBrowsePath || browserPath}
                onChange={(e) => setSelectedBrowsePath(e.target.value)}
                className="input-field font-mono text-xs py-1.5 flex-1"
                placeholder="Selecciona una carpeta"
              />
              <button onClick={() => loadBrowser(selectedBrowsePath || '')} className="btn-secondary text-xs py-1.5">
                Ir
              </button>
            </div>

            <div className="h-[360px] overflow-auto rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              {browserLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 text-panel-500 animate-spin" />
                </div>
              ) : (
                <>
                  {browserRoots.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 px-2 py-1">Unidades</p>
                      {browserRoots.map((root) => (
                        <button
                          key={root.path}
                          onClick={() => loadBrowser(root.path)}
                          className="w-full text-left px-2.5 py-2 rounded-md hover:bg-slate-800 text-slate-200 text-sm flex items-center gap-2"
                        >
                          <HardDrive className="w-4 h-4 text-panel-400" />
                          <span>{root.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {browserPath && (
                    <button
                      onClick={() => setSelectedBrowsePath(browserPath)}
                      className="w-full text-left px-2.5 py-2 rounded-md bg-panel-600/10 border border-panel-500/20 text-panel-300 text-sm flex items-center justify-between mb-2"
                    >
                      <span className="font-mono">Usar: {browserPath}</span>
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  {browserDirs.length === 0 && browserRoots.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No hay subcarpetas disponibles en esta ruta.</p>
                  )}

                  {browserDirs.map((dir) => (
                    <div key={dir.path} className="flex items-center gap-2">
                      <button
                        onClick={() => loadBrowser(dir.path)}
                        className="flex-1 text-left px-2.5 py-2 rounded-md hover:bg-slate-800 text-slate-200 text-sm flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4 text-amber-400" />
                        <span>{dir.name}</span>
                      </button>
                      <button
                        onClick={() => setSelectedBrowsePath(dir.path)}
                        className="btn-secondary text-xs py-1.5"
                      >
                        Seleccionar
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowBrowser(false)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button type="button" onClick={applySelectedPath} disabled={!selectedBrowsePath} className="btn-primary flex-1 justify-center disabled:opacity-50">
                <Check className="w-4 h-4" />
                Usar ruta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
