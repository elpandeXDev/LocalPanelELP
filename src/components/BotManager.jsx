import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'
import {
  Bot, Plus, Search, Loader2, Play, Square, RotateCw, Trash2,
  Terminal, X, Code, FolderInput, CheckCircle, AlertCircle, Pencil, Download,
} from 'lucide-react'

const LANG_ICONS = {
  node: { label: 'Node.js', color: 'text-green-400', bg: 'bg-green-600/20', border: 'border-green-500/30' },
  python: { label: 'Python', color: 'text-blue-400', bg: 'bg-blue-600/20', border: 'border-blue-500/30' },
  python3: { label: 'Python 3', color: 'text-blue-400', bg: 'bg-blue-600/20', border: 'border-blue-500/30' },
  java: { label: 'Java', color: 'text-orange-500', bg: 'bg-orange-600/20', border: 'border-orange-500/30' },
  csharp: { label: 'C# (.NET)', color: 'text-purple-400', bg: 'bg-purple-600/20', border: 'border-purple-500/30' },
  go: { label: 'Go', color: 'text-cyan-400', bg: 'bg-cyan-600/20', border: 'border-cyan-500/30' },
  ruby: { label: 'Ruby', color: 'text-red-400', bg: 'bg-red-600/20', border: 'border-red-500/30' },
}

export default function BotManager() {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [mounts, setMounts] = useState([])
  const [selectedMount, setSelectedMount] = useState('all-disks')
  const [scanning, setScanning] = useState(false)
  const [detectedBots, setDetectedBots] = useState([])
  const [showLogs, setShowLogs] = useState(null)
  const [languages, setLanguages] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [installingId, setInstallingId] = useState(null)

  const [newBot, setNewBot] = useState({
    name: '',
    directory: '',
    language: 'node',
    entryFile: '',
    envVars: '',
    autoStart: false,
    keepAlive: true,
  })

  const loadBots = () => {
    api.bots.list().then((data) => {
      setBots(data.bots)
      setLoading(false)
    })
  }

  useEffect(() => {
    loadBots()
    api.linked.list().then((data) => setMounts(data.dirs))
    api.bots.languages().then((data) => setLanguages(data.languages))
  }, [])

  const handleScan = async () => {
    setScanning(true)
    setDetectedBots([])
    try {
      const data = await api.bots.detect(selectedMount)
      setDetectedBots(data.bots)
    } catch (err) {
      console.error(err)
    } finally {
      setScanning(false)
    }
  }

  const handleAddBot = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.bots.update(editingId, newBot)
      } else {
        await api.bots.create({
          ...newBot,
          directory: newBot.directory || undefined,
        })
      }
      setShowAdd(false)
      setEditingId(null)
      setNewBot({ name: '', directory: '', language: 'node', entryFile: '', envVars: '', autoStart: false, keepAlive: true })
      loadBots()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEdit = (bot) => {
    setEditingId(bot.id)
    setNewBot({
      name: bot.name,
      directory: bot.directory,
      language: bot.language,
      entryFile: bot.entryFile || '',
      envVars: bot.envVars || '',
      autoStart: !!bot.autoStart,
      keepAlive: bot.keepAlive !== false,
    })
    setShowAdd(true)
  }

  const handleAddDetected = (bot) => {
    setEditingId(null)
    setNewBot({
      name: bot.name,
      directory: bot.path,
      language: bot.language,
      entryFile: bot.entryFile || '',
      envVars: bot.envTemplate || '',
      autoStart: false,
      keepAlive: true,
    })
    setShowAdd(true)
  }

  const handleStart = async (id) => {
    try {
      await api.bots.start(id)
      loadBots()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStop = async (id) => {
    try {
      await api.bots.stop(id)
      loadBots()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRestart = async (id) => {
    try {
      await api.bots.restart(id)
      loadBots()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Seguro que quieres eliminar este bot?')) return
    try {
      await api.bots.remove(id)
      loadBots()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleInstall = async (id) => {
    setInstallingId(id)
    try {
      await api.bots.install(id)
      setShowLogs(bots.find((b) => b.id === id))
    } catch (err) {
      alert(err.message)
    } finally {
      setTimeout(() => setInstallingId(null), 1500)
    }
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-panel-400" />
            Bots de Discord
          </h1>
          <p className="text-slate-400 mt-1">Gestiona bots de Discord de cualquier lenguaje</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null)
            setNewBot({ name: '', directory: '', language: 'node', entryFile: '', envVars: '', autoStart: false, keepAlive: true })
            setShowAdd(true)
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Anadir Bot
        </button>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <Search className="w-5 h-5 text-panel-400" />
          <h3 className="font-semibold text-white">Detectar bots automaticamente</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMount}
            onChange={(e) => setSelectedMount(e.target.value)}
            className="input-field flex-1"
          >
            <option value="all-disks">Todos los discos (A: - Z:)</option>
            <option value="internal">Solo discos locales (auto)</option>
            {mounts.map((m) => (
              <option key={m.id} value={m.id}>{m.name} - {m.path}</option>
            ))}
          </select>
          <button onClick={handleScan} disabled={scanning} className="btn-primary">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Escanea
          </button>
        </div>
        {selectedMount === 'all-disks' && (
          <p className="text-xs text-slate-500 mt-2">
            Escaneo global activado: revisa todas las unidades disponibles y busca bots de Discord en cualquier lenguaje.
          </p>
        )}
        {selectedMount !== 'all-disks' && (
          <p className="text-xs text-slate-500 mt-2">
            Tambien puedes usar "Todos los discos (A: - Z:)" para escanear globalmente.
          </p>
        )}

        {detectedBots.length > 0 && (
          <div className="mt-4 space-y-2">
            {detectedBots.map((bot, i) => {
              const lc = LANG_ICONS[bot.language] || LANG_ICONS.node
              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className={`w-10 h-10 ${lc.bg} ${lc.border} border rounded-lg flex items-center justify-center`}>
                    <Code className={`w-5 h-5 ${lc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{bot.name}</p>
                    <p className="text-xs text-slate-500 truncate">{bot.path}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 ${lc.bg} ${lc.color} rounded-md flex-shrink-0`}>
                    {bot.languageName}
                  </span>
                  <button onClick={() => handleAddDetected(bot)} className="btn-secondary text-sm py-1.5">
                    <Plus className="w-4 h-4" />
                    Anadir
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <div className="card p-8 text-center">
          <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No hay bots configurados. Anade uno o detecta automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bots.map((bot) => {
            const lc = LANG_ICONS[bot.language] || LANG_ICONS.node
            const running = bot.running
            return (
              <div key={bot.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${lc.bg} ${lc.border} border rounded-lg flex items-center justify-center`}>
                      <Code className={`w-5 h-5 ${lc.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{bot.name}</h3>
                      <p className="text-xs text-slate-500">{lc.label}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-md flex items-center gap-1.5 flex-shrink-0 ${
                      running
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : bot.status === 'restarting'
                          ? 'bg-amber-500/20 text-amber-400'
                          : bot.status === 'crashed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        running
                          ? 'bg-emerald-400 animate-pulse'
                          : bot.status === 'restarting'
                            ? 'bg-amber-400 animate-pulse'
                            : bot.status === 'crashed'
                              ? 'bg-red-400'
                              : 'bg-slate-500'
                      }`}
                    />
                    {running ? 'Running' : bot.status === 'restarting' ? 'Reiniciando' : bot.status === 'crashed' ? 'Crashed' : 'Stopped'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1 mb-3">
                  <p className="truncate"><span className="text-slate-600">Dir:</span> {bot.directory}</p>
                  {bot.entryFile && <p><span className="text-slate-600">Entry:</span> {bot.entryFile}</p>}
                  {bot.pid && <p><span className="text-slate-600">PID:</span> {bot.pid}</p>}
                  <p className="flex items-center gap-2 pt-1">
                    {bot.autoStart && <span className="px-1.5 py-0.5 rounded bg-panel-600/20 text-panel-300">Auto-inicio</span>}
                    {bot.keepAlive !== false && <span className="px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-400">24/7 (auto-reinicio)</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!running ? (
                    <button onClick={() => handleStart(bot.id)} className="btn-primary text-sm py-1.5 flex-1 justify-center">
                      <Play className="w-4 h-4" />
                      Iniciar
                    </button>
                  ) : (
                    <button onClick={() => handleStop(bot.id)} className="btn-danger text-sm py-1.5 flex-1 justify-center">
                      <Square className="w-4 h-4" />
                      Detener
                    </button>
                  )}
                  <button
                    onClick={() => handleRestart(bot.id)}
                    disabled={!running}
                    className="btn-secondary text-sm py-1.5 disabled:opacity-40"
                    title="Reiniciar"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowLogs(bot)}
                    className="btn-secondary text-sm py-1.5"
                    title="Ver logs"
                  >
                    <Terminal className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleInstall(bot.id)}
                    disabled={installingId === bot.id}
                    className="btn-secondary text-sm py-1.5 disabled:opacity-40"
                    title="Instalar dependencias"
                  >
                    {installingId === bot.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(bot)}
                    className="btn-secondary text-sm py-1.5"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="btn-secondary text-sm py-1.5 text-red-400 hover:bg-red-500/10"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddBotModal
          bot={newBot}
          setBot={setNewBot}
          languages={languages}
          editing={!!editingId}
          onClose={() => { setShowAdd(false); setEditingId(null) }}
          onSubmit={handleAddBot}
          autoFillEntry={!editingId}
        />
      )}

      {showLogs && <LogsModal bot={showLogs} onClose={() => setShowLogs(null)} />}
    </div>
  )
}

function AddBotModal({ bot, setBot, languages, editing, onClose, onSubmit, autoFillEntry }) {
  const handleLanguageChange = (langId) => {
    const lang = languages.find((l) => l.id === langId)
    setBot((prev) => ({
      ...prev,
      language: langId,
      entryFile: autoFillEntry ? (lang?.entryFile || '') : prev.entryFile,
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{editing ? 'Editar Bot de Discord' : 'Anadir Bot de Discord'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre</label>
            <input
              type="text"
              value={bot.name}
              onChange={(e) => setBot({ ...bot, name: e.target.value })}
              className="input-field"
              placeholder="Mi Bot"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Directorio del bot</label>
            <input
              type="text"
              value={bot.directory}
              onChange={(e) => setBot({ ...bot, directory: e.target.value })}
              className="input-field font-mono text-sm"
              placeholder="C:\ruta\al\bot"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Lenguaje</label>
            <select
              value={bot.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="input-field"
            >
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Archivo principal</label>
            <input
              type="text"
              value={bot.entryFile}
              onChange={(e) => setBot({ ...bot, entryFile: e.target.value })}
              className="input-field font-mono text-sm"
              placeholder="index.js / main.py / bot.jar"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Variables de entorno (una por linea, KEY=VALUE)
            </label>
            <textarea
              value={bot.envVars}
              onChange={(e) => setBot({ ...bot, envVars: e.target.value })}
              className="input-field font-mono text-sm h-20 resize-none"
              placeholder="DISCORD_TOKEN=tu_token_aqui"
            />
          </div>
          <div className="space-y-2 bg-slate-800/40 rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!bot.keepAlive}
                onChange={(e) => setBot({ ...bot, keepAlive: e.target.checked })}
                className="w-4 h-4 accent-panel-500"
              />
              Mantener vivo 24/7 (reiniciar automaticamente si se cae)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!bot.autoStart}
                onChange={(e) => setBot({ ...bot, autoStart: e.target.checked })}
                className="w-4 h-4 accent-panel-500"
              />
              Iniciar automaticamente al abrir el panel
            </label>
          </div>
          <p className="text-xs text-slate-500">
            No necesitas ejecutar <code className="text-slate-400">npm install</code> manualmente: el panel instala dependencias automaticamente en el primer inicio.
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center">
              <Plus className="w-4 h-4" />
              {editing ? 'Guardar' : 'Anadir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LogsModal({ bot, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const logRef = useRef(null)

  useEffect(() => {
    api.bots
      .logs(bot.id, 200)
      .then((data) => {
        setLogs(data.logs)
        setLoading(false)
      })
  }, [bot.id])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 fade-in" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl h-[70vh] flex flex-col slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-panel-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Logs - {bot.name}</h3>
              <p className="text-xs text-slate-500">{bot.directory}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={logRef} className="flex-1 overflow-auto p-4 font-mono text-xs space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-panel-500 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No hay logs disponibles</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`leading-5 ${
                  log.type === 'stderr'
                    ? 'text-red-400'
                    : log.type === 'exit' || log.type === 'stop'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                }`}
              >
                <span className="text-slate-600">[{new Date(log.time).toLocaleTimeString()}]</span> {log.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
