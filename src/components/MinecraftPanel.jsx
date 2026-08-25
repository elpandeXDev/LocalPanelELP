import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api.js'
import {
  Gamepad2, Search, Loader2, Save, CheckCircle, AlertCircle,
  Server, ChevronRight, ToggleLeft, ToggleRight,
  Play, Square, RotateCw, Terminal, Send,
  Cpu, HardDrive, Activity, Clock, Download, Trash2, FolderOpen,
  Settings, Database, FileText, Zap, Wifi,
} from 'lucide-react'

export default function MinecraftPanel() {
  const [mounts, setMounts] = useState([])
  const [selectedMount, setSelectedMount] = useState('all-disks')
  const [scanning, setScanning] = useState(false)
  const [servers, setServers] = useState([])
  const [selectedServer, setSelectedServer] = useState(null)
  const [properties, setProperties] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loadingProps, setLoadingProps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [eulaAccepted, setEulaAccepted] = useState(false)
  const [hasEula, setHasEula] = useState(false)
  const [localIp, setLocalIp] = useState('localhost')
  const [localIpSource, setLocalIpSource] = useState('LAN')

  const [serverRunning, setServerRunning] = useState(false)
  const [serverPid, setServerPid] = useState(null)
  const [serverLogs, setServerLogs] = useState([])
  const [command, setCommand] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [minMem, setMinMem] = useState('1024M')
  const [maxMem, setMaxMem] = useState('2048M')
  const logRef = useRef(null)
  const pollRef = useRef(null)
  const resourceRef = useRef(null)

  const [activeTab, setActiveTab] = useState('console')
  const [resources, setResources] = useState({ running: false, cpu: null, memory: null, disk: 0 })
  const [backups, setBackups] = useState([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)

  const [networkStatus, setNetworkStatus] = useState(null)
  const [networkLoading, setNetworkLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState(null)

  const isActionLoading = (action) => actionLoading === action
  const isAnyActionLoading = !!actionLoading

  useEffect(() => {
    api.linked.list()
      .then((data) => setMounts(Array.isArray(data?.dirs) ? data.dirs : []))
      .catch(() => setMounts([]))
  }, [])

  const checkServerStatus = useCallback(async (dirPath) => {
    try {
      const status = await api.minecraft.getServerStatus(dirPath)
      setServerRunning(status.running)
      setServerPid(status.pid)
    } catch {}
  }, [])

  const fetchLogs = useCallback(async (dirPath) => {
    try {
      const data = await api.minecraft.getServerLogs(dirPath, 200)
      setServerLogs(data.logs || [])
      setServerRunning(data.running)
      setServerPid(data.pid)
    } catch {}
  }, [])

  const fetchResources = useCallback(async (dirPath) => {
    try {
      const res = await api.minecraft.getServerResources(dirPath)
      setResources(res)
    } catch {}
  }, [])

  const fetchBackups = useCallback(async (dirPath) => {
    setBackupsLoading(true)
    try {
      const data = await api.minecraft.getBackups(dirPath)
      setBackups(data.backups || [])
    } catch {}
    setBackupsLoading(false)
  }, [])

  const fetchNetworkStatus = useCallback(async (dirPath) => {
    setNetworkLoading(true)
    try {
      const data = await api.minecraft.networkStatus(dirPath)
      setNetworkStatus(data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setNetworkLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedServer && activeTab === 'console') {
      fetchLogs(selectedServer.path)
      pollRef.current = setInterval(() => fetchLogs(selectedServer.path), 2000)
      resourceRef.current = setInterval(() => fetchResources(selectedServer.path), 3000)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
        if (resourceRef.current) clearInterval(resourceRef.current)
      }
    }
  }, [selectedServer, activeTab, fetchLogs, fetchResources])

  useEffect(() => {
    if (selectedServer && activeTab === 'backups') {
      fetchBackups(selectedServer.path)
    }
  }, [selectedServer, activeTab, fetchBackups])

  useEffect(() => {
    if (selectedServer && activeTab === 'network') {
      fetchNetworkStatus(selectedServer.path)
    }
  }, [selectedServer, activeTab, fetchNetworkStatus])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [serverLogs])

  const handleScan = async () => {
    setScanning(true)
    setServers([])
    setSelectedServer(null)
    setActiveTab('console')
    try {
      const data = await api.minecraft.detect(selectedMount)
      setServers(data.servers)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setScanning(false)
    }
  }

  const handleSelectServer = async (server) => {
    setSelectedServer(server)
    setLoadingProps(true)
    setProperties(null)
    setActiveTab('console')
    setMessage(null)
    try {
      const data = await api.minecraft.getProperties(server.path)
      setProperties(data.properties)
      setMeta(data.meta)
      setHasEula(data.hasEula)
      setEulaAccepted(data.eulaContent && data.eulaContent.includes('eula=true'))
      setLocalIp(data.localIp || 'localhost')
      setLocalIpSource(data.localIpSource || 'LAN')
      checkServerStatus(server.path)
      fetchResources(server.path)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoadingProps(false)
    }
  }

  const handleSaveProperties = async () => {
    if (!selectedServer) return
    setSaving(true)
    setMessage(null)
    try {
      await api.minecraft.saveProperties(selectedServer.path, properties)
      setMessage({ type: 'success', text: 'Propiedades guardadas correctamente' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleAcceptEula = async () => {
    if (!selectedServer) return
    try {
      await api.minecraft.acceptEula(selectedServer.path)
      setEulaAccepted(true)
      setHasEula(true)
      setMessage({ type: 'success', text: 'EULA aceptada' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleStartServer = async () => {
    if (!selectedServer) return
    setActionLoading('start')
    setMessage(null)
    try {
      const result = await api.minecraft.startServer(selectedServer.path, minMem, maxMem)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setServerRunning(true)
        setServerPid(result.pid)
        fetchLogs(selectedServer.path)
        fetchResources(selectedServer.path)
        checkServerStatus(selectedServer.path)
        setMessage({ type: 'success', text: `Servidor iniciado (PID: ${result.pid})` })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  const handleStopServer = async () => {
    if (!selectedServer) return
    setActionLoading('stop')
    try {
      const result = await api.minecraft.stopServer(selectedServer.path)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setServerRunning(false)
        setServerPid(null)
        setResources({ running: false, cpu: null, memory: null, disk: resources.disk })
        fetchLogs(selectedServer.path)
        checkServerStatus(selectedServer.path)
        setMessage({ type: 'success', text: 'Servidor detenido' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestartServer = async () => {
    if (!selectedServer) return
    setActionLoading('restart')
    try {
      await api.minecraft.restartServer(selectedServer.path, minMem, maxMem)
      setMessage({ type: 'success', text: 'Reiniciando servidor...' })
      setTimeout(() => {
        checkServerStatus(selectedServer.path)
        fetchLogs(selectedServer.path)
        fetchResources(selectedServer.path)
        setActionLoading(null)
      }, 4000)
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      setActionLoading(null)
    }
  }

  const handleSendCommand = async (e) => {
    e.preventDefault()
    if (!command.trim() || !selectedServer) return
    try {
      await api.minecraft.sendCommand(selectedServer.path, command)
      setCommand('')
      fetchLogs(selectedServer.path)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleCreateBackup = async () => {
    if (!selectedServer) return
    setCreatingBackup(true)
    try {
      const result = await api.minecraft.createBackup(selectedServer.path)
      if (result.success) {
        setMessage({ type: 'success', text: 'Backup creado correctamente' })
        fetchBackups(selectedServer.path)
      }
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDeleteBackup = async (name) => {
    if (!selectedServer) return
    if (!confirm(`¿Eliminar el backup "${name}"?`)) return
    try {
      await api.minecraft.deleteBackup(selectedServer.path, name)
      setBackups(prev => prev.filter(b => b.name !== name))
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleOptimizeNetwork = async () => {
    if (!selectedServer) return
    setOptimizing(true)
    setOptimizeResult(null)
    try {
      const data = await api.minecraft.networkOptimize(selectedServer.path)
      setOptimizeResult(data.results)
      if (data.success) {
        setMessage({ type: 'success', text: 'Red optimizada correctamente' })
      } else {
        setMessage({ type: 'error', text: 'Algunos ajustes no se pudieron aplicar (requiere admin)' })
      }
      setTimeout(() => setMessage(null), 4000)
      fetchNetworkStatus(selectedServer.path)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setOptimizing(false)
    }
  }

  const updateProperty = (key, value) => {
    setProperties((prev) => ({ ...prev, [key]: value }))
  }

  const groupedMeta = () => {
    if (!meta) return {}
    const groups = {}
    for (const [key, info] of Object.entries(meta)) {
      const g = info.group || 'Otros'
      if (!groups[g]) groups[g] = []
      groups[g].push({ key, ...info })
    }
    return groups
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getAddress = () => {
    const port = properties?.['server-port'] || '25565'
    const ip = properties?.['server-ip'] || localIp
    return `${ip}:${port}`
  }

  const InfoCard = ({ icon: Icon, label, value, color = 'panel-400' }) => (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 text-${color}`} />
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === id
          ? 'bg-panel-600/30 text-panel-400 border border-panel-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )

  return (
    <div className="space-y-4 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gamepad2 className="w-7 h-7 text-panel-400" />
          Minecraft
        </h1>
        <p className="text-slate-400 mt-1">Detecta, configura y administra servidores de Minecraft</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-panel-400" />
          <h3 className="font-semibold text-white">Detectar servidores</h3>
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
            Escaneo global activado: revisa todas las unidades disponibles y busca servidores con `run.bat` o `server.jar`.
          </p>
        )}
        {selectedMount !== 'all-disks' && (
          <p className="text-xs text-slate-500 mt-2">
            También puedes usar “Todos los discos (A: - Z:)” para escanear globalmente.
          </p>
        )}
      </div>

      {servers.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-3">Servidores encontrados ({servers.length})</h3>
          <div className="space-y-2">
            {servers.map((server, i) => (
              <button
                key={i}
                onClick={() => handleSelectServer(server)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  selectedServer?.path === server.path
                    ? 'bg-panel-600/20 border-panel-500/30'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                <Gamepad2 className="w-5 h-5 text-panel-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{server.name}</p>
                  <p className="text-xs text-slate-500 truncate">{server.path}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-panel-600/20 text-panel-400 rounded-md flex-shrink-0">
                  {server.type}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {servers.length === 0 && !scanning && !selectedServer && (
        <div className="card p-8 text-center">
          <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            No se encontraron servidores. Se buscan carpetas que tengan `run.bat` o `server.jar` (o ambos).
          </p>
        </div>
      )}

      {selectedServer && (
        <>
          {/* Control Bar */}
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-panel-400" />
                <div>
                  <h3 className="font-semibold text-white">{selectedServer.name}</h3>
                  <p className="text-xs text-slate-500">{selectedServer.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartServer}
                  disabled={isAnyActionLoading || serverRunning || !eulaAccepted}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isActionLoading('start') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isActionLoading('start') ? 'Iniciando...' : 'Start'}
                </button>
                <button
                  onClick={handleRestartServer}
                  disabled={isAnyActionLoading || !serverRunning}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {isActionLoading('restart') ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                  {isActionLoading('restart') ? 'Reiniciando...' : 'Restart'}
                </button>
                <button
                  onClick={handleStopServer}
                  disabled={isAnyActionLoading || !serverRunning}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {isActionLoading('stop') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  {isActionLoading('stop') ? 'Deteniendo...' : 'Stop'}
                </button>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <InfoCard icon={Server} label="Nombre" value={selectedServer.name} />
              <InfoCard icon={Activity} label="Estado" value={serverRunning ? 'Running' : 'Stopped'} color={serverRunning ? 'emerald-400' : 'slate-400'} />
              <InfoCard icon={Clock} label="Dirección" value={`${getAddress()} (${localIpSource})`} />
              <InfoCard icon={Cpu} label="CPU" value={resources.cpu ? `${resources.cpu}%` : 'N/A'} color={resources.cpu ? 'amber-400' : 'slate-400'} />
              <InfoCard icon={Zap} label="Memoria" value={resources.memory ? formatBytes(resources.memory) : 'N/A'} />
              <InfoCard icon={HardDrive} label="Disco" value={formatBytes(resources.disk)} />
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Memoria Java:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={minMem}
                  onChange={(e) => setMinMem(e.target.value)}
                  className="input-field py-1 text-xs w-24"
                  placeholder="1024M"
                />
                <span className="text-xs text-slate-500">-</span>
                <input
                  type="text"
                  value={maxMem}
                  onChange={(e) => setMaxMem(e.target.value)}
                  className="input-field py-1 text-xs w-24"
                  placeholder="2048M"
                />
              </div>
              {!eulaAccepted && (
                <button onClick={handleAcceptEula} className="btn-secondary text-xs py-1.5 ml-4">
                  <CheckCircle className="w-3 h-3" />
                  Aceptar EULA
                </button>
              )}
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 mt-4 fade-in ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </div>
            )}

            {!eulaAccepted && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm rounded-lg px-4 py-3 mt-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Debes aceptar el EULA de Minecraft antes de iniciar el servidor.
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
            <TabButton id="console" icon={Terminal} label="Consola" />
            <TabButton id="config" icon={Settings} label="Configuración" />
            <TabButton id="network" icon={Wifi} label="Red" />
            <TabButton id="backups" icon={Database} label="Backups" />
          </div>

          {/* Console Tab */}
          {activeTab === 'console' && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-panel-400" />
                  <h3 className="font-semibold text-white text-sm">Consola del servidor</h3>
                </div>
                <span className={`text-xs flex items-center gap-1.5 ${serverRunning ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${serverRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  {serverRunning ? 'Online' : 'Offline'}
                </span>
              </div>
              <div
                ref={logRef}
                className="bg-slate-950 p-4 font-mono text-xs space-y-0.5 h-96 overflow-auto"
              >
                {serverLogs.length === 0 ? (
                  <p className="text-slate-600 text-center py-8">
                    {serverRunning ? 'Esperando salida del servidor...' : 'El servidor no esta en ejecucion. Pulsa "Start" para iniciarlo.'}
                  </p>
                ) : (
                  serverLogs.map((log, i) => (
                    <div
                      key={i}
                      className={`leading-5 ${
                        log.type === 'stderr'
                          ? 'text-red-400'
                          : log.type === 'exit' || log.type === 'stop'
                            ? 'text-amber-400'
                            : log.type === 'command'
                              ? 'text-cyan-400 font-semibold'
                              : 'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-600">[{new Date(log.time).toLocaleTimeString()}]</span> {log.text}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendCommand} className="flex items-center gap-2 p-3 border-t border-slate-800 bg-slate-900">
                <span className="text-panel-400 font-mono text-sm pl-2">&gt;</span>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Escribe un comando (ej. say Hola, give @p diamond, stop)..."
                  className="flex-1 bg-slate-800 text-slate-100 font-mono text-sm px-3 py-2 rounded-lg outline-none border border-slate-700 focus:border-panel-500"
                  disabled={!serverRunning}
                />
                <button
                  type="submit"
                  disabled={!serverRunning || !command.trim()}
                  className="btn-primary text-sm py-2 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  Enviar
                </button>
              </form>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-panel-400" />
                  Configuración (server.properties)
                </h3>
                <button onClick={handleSaveProperties} disabled={saving || !properties} className="btn-primary text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              </div>

              {loadingProps ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
                </div>
              ) : properties ? (
                <div className="space-y-5">
                  {Object.entries(groupedMeta()).map(([group, props]) => (
                    <div key={group}>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{group}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {props.map((prop) => (
                          <PropertyInput
                            key={prop.key}
                            prop={prop}
                            value={properties[prop.key] ?? prop.default}
                            onChange={(val) => updateProperty(prop.key, val)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Network Tab */}
          {activeTab === 'network' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-panel-400" />
                  Optimización de Red
                </h3>
                <button
                  onClick={handleOptimizeNetwork}
                  disabled={optimizing}
                  className="btn-primary text-sm"
                >
                  {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Optimizar Red
                </button>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-lg px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 inline mr-2 flex-shrink-0" />
                La optimización TCP requiere ejecutar el panel como administrador. Los cambios se aplican a nivel del sistema operativo y afectan a todas las conexiones.
              </div>

              {networkLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
                </div>
              ) : networkStatus ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ajustes TCP del Sistema</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <NetworkRow label="Auto-Tuning TCP" value={networkStatus.tcp?.autoTuning || 'Desconocido'} good={networkStatus.tcp?.autoTuning === 'normal'} />
                      <NetworkRow label="Proveedor de Congestión" value={networkStatus.tcp?.congestionProvider || 'Desconocido'} good={networkStatus.tcp?.congestionProvider === 'ctcp'} />
                      <NetworkRow label="RSS (Receive Side Scaling)" value={networkStatus.tcp?.rss || 'Desconocido'} good={networkStatus.tcp?.rss === 'enabled'} />
                      <NetworkRow label="TCP Timestamps" value={networkStatus.tcp?.timestamps || 'Desconocido'} good={networkStatus.tcp?.timestamps === 'enabled'} />
                      <NetworkRow label="Heurísticas TCP" value={networkStatus.tcp?.heuristics || 'Desconocido'} good={networkStatus.tcp?.heuristics === 'disabled'} />
                      <NetworkRow label="ECN (Congestion Notification)" value={networkStatus.tcp?.ecn || 'Desconocido'} good={networkStatus.tcp?.ecn === 'enabled'} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Configuración del Servidor (server.properties)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <NetworkRow label="Umbral de Compresión" value={networkStatus.serverProperties?.['network-compression-threshold'] || '256'} good={networkStatus.serverProperties?.['network-compression-threshold'] === '256'} />
                      <NetworkRow label="Distancia de Visión" value={networkStatus.serverProperties?.['view-distance'] || '10'} good={Number(networkStatus.serverProperties?.['view-distance'] || 10) <= 7} />
                      <NetworkRow label="Distancia de Simulación" value={networkStatus.serverProperties?.['simulation-distance'] || '10'} good={Number(networkStatus.serverProperties?.['simulation-distance'] || 10) <= 5} />
                      <NetworkRow label="Transporte Nativo" value={networkStatus.serverProperties?.['use-native-transport'] || 'true'} good={networkStatus.serverProperties?.['use-native-transport'] === 'true'} />
                    </div>
                  </div>

                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Optimizaciones JVM aplicadas automáticamente</h4>
                    <ul className="text-xs text-slate-400 space-y-1">
                      <li>- <code className="text-slate-300">java.net.preferIPv4Stack=true</code> — Evita resolución IPv6 lenta</li>
                      <li>- <code className="text-slate-300">networkaddress.cache.ttl=30</code> — Cache DNS corta para tunnels dinámicos</li>
                      <li>- <code className="text-slate-300">io.netty.allocator.type=unpooled</code> — Reduce latencia de asignación</li>
                      <li>- <code className="text-slate-300">io.netty.recycler.maxCapacity.default=0</code> — Elimina pool de reciclaje</li>
                    </ul>
                  </div>

                  {optimizeResult && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Resultado de la Optimización</h4>
                      <div className="space-y-2">
                        {optimizeResult.map((r, i) => (
                          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${r.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {r.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                            <span className="flex-1">{r.label}</span>
                            {!r.success && <span className="text-xs text-slate-500">{r.output}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">No se pudo cargar el estado de red</p>
              )}
            </div>
          )}

          {/* Backups Tab */}
          {activeTab === 'backups' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-panel-400" />
                  Backups del servidor
                </h3>
                <button onClick={handleCreateBackup} disabled={creatingBackup} className="btn-primary text-sm">
                  {creatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                  Crear Backup
                </button>
              </div>

              {backupsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay backups creados</p>
                  <p className="text-xs mt-1">Crea tu primer backup para proteger tu servidor</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.map((backup, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-panel-400" />
                        <div>
                          <p className="text-sm text-slate-200 font-medium">{backup.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(backup.size)} • {new Date(backup.created).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => api.minecraft.downloadBackup(selectedServer.path, backup.name)}
                          className="btn-secondary text-sm py-1.5"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.name)}
                          className="btn-danger text-sm py-1.5"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NetworkRow({ label, value, good }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`text-sm font-medium flex items-center gap-1.5 ${good ? 'text-emerald-400' : 'text-amber-400'}`}>
        <span className={`w-2 h-2 rounded-full ${good ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {value}
      </span>
    </div>
  )
}

function PropertyInput({ prop, value, onChange }) {
  if (prop.type === 'boolean') {
    const bool = value === 'true' || value === true
    return (
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
        <span className="text-sm text-slate-300">{prop.label}</span>
        <button
          onClick={() => onChange(bool ? 'false' : 'true')}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${
            bool ? 'text-panel-400' : 'text-slate-500'
          }`}
        >
          {bool ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
          {bool ? 'ON' : 'OFF'}
        </button>
      </div>
    )
  }

  if (prop.type === 'select') {
    return (
      <div className="p-3 bg-slate-800/50 rounded-lg">
        <label className="block text-sm text-slate-300 mb-2">{prop.label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field py-1.5 text-sm"
        >
          {(prop.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg">
      <label className="block text-sm text-slate-300 mb-2">{prop.label}</label>
      <input
        type={prop.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-1.5 text-sm"
      />
    </div>
  )
}
