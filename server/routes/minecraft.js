import express from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec, execSync } from 'child_process'
import { listLinkedDirs, getLinkedDir } from '../config/stores.js'
import {
  startMcServer, stopMcServer, restartMcServer,
  sendMcCommand, getMcServerLogs, getMcServerStatus,
} from '../processes.js'

const router = express.Router()

const BACKUP_FOLDER = 'backups-panel'

function isTailscaleIp(ip) {
  const parts = ip.split('.').map((n) => Number(n))
  return parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
}

function classifyAddress(ifaceName, ip) {
  const name = ifaceName.toLowerCase()
  const isRadminByIp = ip.startsWith('26.')
  if (name.includes('tailscale') || isTailscaleIp(ip)) {
    return { source: 'Tailscale', priority: 100 }
  }
  if (name.includes('playit') || name.includes('tunnel')) {
    return { source: 'Playit.gg', priority: 90 }
  }
  if (name.includes('radmin') || isRadminByIp) {
    return { source: 'Radmin', priority: 80 }
  }
  return { source: 'LAN', priority: 10 }
}

function getPreferredAddress() {
  const nets = os.networkInterfaces()
  const candidates = []

  for (const ifaceName of Object.keys(nets)) {
    for (const iface of nets[ifaceName] || []) {
      const family = typeof iface.family === 'string' ? iface.family : String(iface.family)
      if (family !== 'IPv4') continue
      if (iface.internal) continue
      if (!iface.address || iface.address.startsWith('169.254.')) continue

      const { source, priority } = classifyAddress(ifaceName, iface.address)
      candidates.push({
        ip: iface.address,
        source,
        priority,
      })
    }
  }

  if (candidates.length === 0) {
    return { ip: 'localhost', source: 'Localhost' }
  }

  candidates.sort((a, b) => b.priority - a.priority)
  return { ip: candidates[0].ip, source: candidates[0].source }
}

function getDirSize(dirPath) {
  let total = 0
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const item of items) {
      const full = path.join(dirPath, item.name)
      if (item.isDirectory()) total += getDirSize(full)
      else total += fs.statSync(full).size
    }
  } catch {}
  return total
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const MC_MARKERS = [
  'server.properties', 'eula.txt',
  // server jars
  'server.jar', 'paper.jar', 'paperclip.jar', 'spigot.jar', 'craftbukkit.jar',
  'forge.jar', 'fabric-server-launch.jar',
  // proxies
  'bungeecord.jar', 'velocity.jar', 'waterfall.jar',
  // starters
  'start.bat', 'run.bat', 'start.sh', 'run.sh', 'server-start.bat', 'server_start.bat',
]

const MC_FOLDERS = ['world', 'world_nether', 'world_the_end', 'plugins', 'mods', 'config', 'logs', 'cache']
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', '__pycache__', '.venv', 'venv', 'env', 'build', 'dist', 'target', 'tmp', 'temp'])
const ROOT_SKIP_DIRS = new Set(['Windows', 'Program Files', 'Program Files (x86)', 'ProgramData', '$Recycle.Bin', 'System Volume Information', 'Recovery', 'PerfLogs'])
const SCAN_HINTS = ['mc', 'minecraft', 'server', 'paper', 'spigot', 'forge', 'fabric', 'bungee', 'velocity', 'mods', 'plugins']
const SCAN_CACHE_TTL_MS = 30_000
const scanCache = new Map()

function listWindowsDrives() {
  const roots = []
  if (process.platform !== 'win32') return ['/']
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i)
    const root = `${letter}:\\`
    try {
      if (fs.existsSync(root)) roots.push(root)
    } catch {}
  }
  return roots
}

function shouldSkipDirectory(name, currentDepth = 0) {
  const lower = name.toLowerCase()
  if (SKIP_DIRS.has(lower) || SKIP_DIRS.has(name)) return true
  if (currentDepth <= 1 && ROOT_SKIP_DIRS.has(name)) return true
  return false
}

function directoryPriorityScore(name) {
  const lower = name.toLowerCase()
  let score = 0
  for (const hint of SCAN_HINTS) {
    if (lower.includes(hint)) score += 1
  }
  return score
}

function getScanCache(key) {
  const cached = scanCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.time > SCAN_CACHE_TTL_MS) {
    scanCache.delete(key)
    return null
  }
  return cached.value
}

function setScanCache(key, value) {
  scanCache.set(key, { time: Date.now(), value })
}

function isMinecraftDir(dirPath) {
  try {
    const items = fs.readdirSync(dirPath)
    const lower = items.map((name) => name.toLowerCase())
    const hasRunBat = lower.includes('run.bat') || lower.includes('start.bat')
    const hasServerJar = lower.includes('server.jar')
    if (hasRunBat || hasServerJar) return true
    const hasMarker = lower.some((name) => MC_MARKERS.includes(name))
    if (hasMarker) return true
    const hasFolders = lower.some((name) => MC_FOLDERS.includes(name))
    const hasJar = lower.some((name) => name.endsWith('.jar'))
    return hasFolders && hasJar
  } catch {
    return false
  }
}

function detectServerType(dirPath) {
  try {
    const items = fs.readdirSync(dirPath)
    const lower = items.map((i) => i.toLowerCase())

    if (lower.includes('paper.jar') || lower.includes('paperclip.jar')) return 'Paper'
    if (lower.includes('spigot.jar')) return 'Spigot'
    if (lower.includes('craftbukkit.jar')) return 'CraftBukkit'
    if (lower.includes('forge.jar')) return 'Forge'
    if (lower.includes('fabric-server-launch.jar')) return 'Fabric'
    if (lower.includes('bungeecord.jar')) return 'BungeeCord'
    if (lower.includes('velocity.jar')) return 'Velocity'
    if (lower.includes('waterfall.jar')) return 'Waterfall'
    if (lower.includes('server.jar')) {
      if (items.includes('plugins')) return 'Spigot/Paper'
      if (items.includes('mods')) return 'Forge'
      return 'Vanilla'
    }
    if (lower.some((f) => f.endsWith('.jar'))) return 'Java (Jar)'
  } catch {
    return null
  }
  return null
}

function parseServerProperties(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const props = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      props[key] = value
    }
  }
  return props
}

function serializeServerProperties(props) {
  const lines = []
  lines.push('#Minecraft server properties')
  lines.push('#Generated by LocalPanelELP')
  lines.push(`#${new Date().toISOString()}`)
  for (const [key, value] of Object.entries(props)) {
    lines.push(`${key}=${value}`)
  }
  return lines.join('\n') + '\n'
}

const PROPERTY_META = {
  'server-port': { label: 'Puerto del servidor', type: 'number', default: '25565', group: 'Red' },
  'max-players': { label: 'Maximo de jugadores', type: 'number', default: '20', group: 'General' },
  'motd': { label: 'MOTD (Mensaje del dia)', type: 'text', default: 'A Minecraft Server', group: 'General' },
  'gamemode': { label: 'Modo de juego', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], default: 'survival', group: 'General' },
  'difficulty': { label: 'Dificultad', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'easy', group: 'General' },
  'level-name': { label: 'Nombre del mundo', type: 'text', default: 'world', group: 'Mundo' },
  'level-seed': { label: 'Semilla del mundo', type: 'text', default: '', group: 'Mundo' },
  'level-type': { label: 'Tipo de mundo', type: 'select', options: ['default', 'flat', 'largebiomes', 'amplified', 'buffet'], default: 'default', group: 'Mundo' },
  'pvp': { label: 'PvP activado', type: 'boolean', default: 'true', group: 'General' },
  'online-mode': { label: 'Modo online (premium)', type: 'boolean', default: 'true', group: 'Red' },
  'white-list': { label: 'Lista blanca', type: 'boolean', default: 'false', group: 'Seguridad' },
  'enforce-whitelist': { label: 'Forzar lista blanca', type: 'boolean', default: 'false', group: 'Seguridad' },
  'allow-flight': { label: 'Permitir vuelo', type: 'boolean', default: 'false', group: 'General' },
  'allow-nether': { label: 'Permitir Nether', type: 'boolean', default: 'true', group: 'Mundo' },
  'allow-end': { label: 'Permitir End', type: 'boolean', default: 'true', group: 'Mundo' },
  'spawn-animals': { label: 'Generar animales', type: 'boolean', default: 'true', group: 'Mundo' },
  'spawn-monsters': { label: 'Generar monstruos', type: 'boolean', default: 'true', group: 'Mundo' },
  'spawn-npcs': { label: 'Generar NPCs', type: 'boolean', default: 'true', group: 'Mundo' },
  'spawn-protection': { label: 'Proteccion de spawn', type: 'number', default: '16', group: 'Seguridad' },
  'view-distance': { label: 'Distancia de vision', type: 'number', default: '10', group: 'Rendimiento' },
  'simulation-distance': { label: 'Distancia de simulacion', type: 'number', default: '10', group: 'Rendimiento' },
  'max-world-size': { label: 'Tamano maximo del mundo', type: 'number', default: '29999984', group: 'Mundo' },
  'max-build-height': { label: 'Altura maxima de construccion', type: 'number', default: '256', group: 'Mundo' },
  'server-ip': { label: 'IP del servidor', type: 'text', default: '', group: 'Red' },
  'resource-pack': { label: 'URL del resource pack', type: 'text', default: '', group: 'General' },
  'resource-pack-sha1': { label: 'SHA1 del resource pack', type: 'text', default: '', group: 'General' },
  'require-resource-pack': { label: 'Requerir resource pack', type: 'boolean', default: 'false', group: 'General' },
  'enable-command-block': { label: 'Command blocks', type: 'boolean', default: 'false', group: 'General' },
  'enable-rcon': { label: 'RCON activado', type: 'boolean', default: 'false', group: 'Seguridad' },
  'rcon.port': { label: 'Puerto RCON', type: 'number', default: '25575', group: 'Seguridad' },
  'rcon.password': { label: 'Contrasena RCON', type: 'text', default: '', group: 'Seguridad' },
  'enable-query': { label: 'Query activado', type: 'boolean', default: 'false', group: 'Red' },
  'query.port': { label: 'Puerto Query', type: 'number', default: '25565', group: 'Red' },
  'op-permission-level': { label: 'Nivel de permisos OP', type: 'select', options: ['1', '2', '3', '4'], default: '4', group: 'Seguridad' },
  'force-gamemode': { label: 'Forzar modo de juego', type: 'boolean', default: 'false', group: 'General' },
  'generate-structures': { label: 'Generar estructuras', type: 'boolean', default: 'true', group: 'Mundo' },
  'hardcore': { label: 'Modo hardcore', type: 'boolean', default: 'false', group: 'General' },
  'snooper-enabled': { label: 'Snooper', type: 'boolean', default: 'true', group: 'Rendimiento' },
  'announce-player-achievements': { label: 'Anunciar logros', type: 'boolean', default: 'true', group: 'General' },
  'enable-jmx-monitoring': { label: 'Monitoreo JMX', type: 'boolean', default: 'false', group: 'Rendimiento' },
  'enable-status': { label: 'Estado del servidor visible', type: 'boolean', default: 'true', group: 'Red' },
  'hide-online-players': { label: 'Ocultar jugadores online', type: 'boolean', default: 'false', group: 'Red' },
  'use-native-transport': { label: 'Transporte nativo', type: 'boolean', default: 'true', group: 'Rendimiento' },
  'network-compression-threshold': { label: 'Umbral de compresion', type: 'number', default: '256', group: 'Rendimiento' },
  'prevent-proxy-connections': { label: 'Prevenir conexiones proxy', type: 'boolean', default: 'false', group: 'Seguridad' },
  'use-native-transport': { label: 'Transporte nativo', type: 'boolean', default: 'true', group: 'Rendimiento' },
}

function readServerPort(dirPath) {
  try {
    const p = path.join(dirPath, 'server.properties')
    if (!fs.existsSync(p)) return null
    const content = fs.readFileSync(p, 'utf-8')
    const m = content.match(/^server-port\s*=\s*(\d+)/m)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function scanForMinecraftDirs(basePath, maxDepth = 5, currentDepth = 0, state = { visited: 0, maxVisited: 60_000, startMs: Date.now(), maxMs: 25_000 }) {
  const results = []
  if (currentDepth > maxDepth) return results
  if (state.visited >= state.maxVisited) return results
  if (Date.now() - state.startMs > state.maxMs) return results

  state.visited += 1

  try {
    if (isMinecraftDir(basePath)) {
      results.push({
        name: path.basename(basePath) || basePath,
        path: basePath,
        type: detectServerType(basePath),
        port: readServerPort(basePath),
      })
    }

    const items = fs.readdirSync(basePath, { withFileTypes: true })
    const dirs = items
      .filter((item) => item.isDirectory())
      .filter((item) => !item.name.startsWith('.'))
      .filter((item) => !item.isSymbolicLink())
      .filter((item) => !shouldSkipDirectory(item.name, currentDepth))
      .sort((a, b) => directoryPriorityScore(b.name) - directoryPriorityScore(a.name))

    for (const item of dirs) {
      if (state.visited >= state.maxVisited) break
      if (Date.now() - state.startMs > state.maxMs) break
      const fullPath = path.join(basePath, item.name)
      if (currentDepth < maxDepth) {
        results.push(...scanForMinecraftDirs(fullPath, maxDepth, currentDepth + 1, state))
      }
    }
  } catch {}
  return results
}

router.get('/detect', (req, res) => {
  const mountId = (req.query.mount || '').toString()
  const depth = Math.max(1, Math.min(8, parseInt(req.query.depth) || 5))
  const maxVisited = Math.max(5_000, Math.min(300_000, parseInt(req.query.maxDirs) || (mountId === 'all-disks' || mountId === 'internal' || !mountId ? 90_000 : 60_000)))
  const maxMs = Math.max(5_000, Math.min(180_000, parseInt(req.query.maxMs) || (mountId === 'all-disks' || mountId === 'internal' || !mountId ? 45_000 : 25_000)))
  const roots = []

  const cacheKey = JSON.stringify({ type: 'minecraft', mountId: mountId || 'all-disks', depth, maxVisited, maxMs })
  const cached = getScanCache(cacheKey)
  if (cached) return res.json({ ...cached, cached: true })

  if (!mountId || mountId === 'internal' || mountId === 'all-disks') {
    roots.push(...listWindowsDrives())
  } else {
    const linked = getLinkedDir(mountId)
    if (!linked) return res.status(404).json({ error: 'Directorio no vinculado' })
    if (!fs.existsSync(linked.path)) return res.status(404).json({ error: 'La ruta no existe' })
    roots.push(linked.path)
  }

  const all = []
  const state = { visited: 0, maxVisited, startMs: Date.now(), maxMs }
  for (const root of roots) {
    all.push(...scanForMinecraftDirs(root, depth, 0, state))
    if (state.visited >= state.maxVisited) break
    if (Date.now() - state.startMs > state.maxMs) break
  }

  const seen = new Set()
  const servers = all.filter((s) => {
    if (seen.has(s.path)) return false
    seen.add(s.path)
    return true
  })

  const payload = {
    servers,
    scannedRoots: roots,
    stats: {
      visitedDirs: state.visited,
      durationMs: Date.now() - state.startMs,
      maxVisited,
      maxMs,
      truncated: state.visited >= state.maxVisited || (Date.now() - state.startMs > state.maxMs),
    },
  }

  setScanCache(cacheKey, payload)
  res.json(payload)
})

router.get('/server-properties', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  if (!dirPath || !fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'Directorio no encontrado' })
  }

  const propsFile = path.join(dirPath, 'server.properties')
  let props = {}
  if (fs.existsSync(propsFile)) {
    props = parseServerProperties(propsFile)
  }

  const net = getPreferredAddress()

  res.json({
    properties: props,
    meta: PROPERTY_META,
    serverType: detectServerType(dirPath),
    localIp: net.ip,
    localIpSource: net.source,
    hasEula: fs.existsSync(path.join(dirPath, 'eula.txt')),
    eulaContent: fs.existsSync(path.join(dirPath, 'eula.txt'))
      ? fs.readFileSync(path.join(dirPath, 'eula.txt'), 'utf-8')
      : null,
  })
})

router.post('/server-properties', (req, res) => {
  const { dirPath, properties } = req.body
  if (!dirPath || !properties) return res.status(400).json({ error: 'Parametros requeridos' })

  const propsFile = path.join(dirPath, 'server.properties')
  try {
    fs.writeFileSync(propsFile, serializeServerProperties(properties))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/accept-eula', (req, res) => {
  const { dirPath } = req.body
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })

  const eulaFile = path.join(dirPath, 'eula.txt')
  try {
    fs.writeFileSync(eulaFile, '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\neula=true\n')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/property-meta', (req, res) => {
  res.json({ meta: PROPERTY_META })
})

// ===== Server Process Management =====

function getServerId(dirPath) {
  return Buffer.from(dirPath).toString('hex')
}

router.post('/server/start', (req, res) => {
  const { dirPath, minMemory, maxMemory } = req.body
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'Directorio no encontrado' })

  const eulaPath = path.join(dirPath, 'eula.txt')
  if (fs.existsSync(eulaPath)) {
    const eula = fs.readFileSync(eulaPath, 'utf-8')
    if (!eula.includes('eula=true')) {
      return res.status(400).json({ error: 'Debes aceptar el EULA antes de iniciar el servidor' })
    }
  }

  const id = getServerId(dirPath)
  const result = startMcServer(id, dirPath, { minMemory, maxMemory })
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.post('/server/stop', (req, res) => {
  const { dirPath } = req.body
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const id = getServerId(dirPath)
  const result = stopMcServer(id)
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.post('/server/restart', (req, res) => {
  const { dirPath, minMemory, maxMemory } = req.body
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const id = getServerId(dirPath)
  const result = restartMcServer(id, dirPath, { minMemory, maxMemory })
  res.json(result)
})

router.post('/server/command', (req, res) => {
  const { dirPath, command } = req.body
  if (!dirPath || !command) return res.status(400).json({ error: 'Parametros requeridos' })
  const id = getServerId(dirPath)
  const result = sendMcCommand(id, command)
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.get('/server/logs', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const lines = parseInt(req.query.lines) || 200
  const id = getServerId(dirPath)
  const logs = getMcServerLogs(id, lines)
  const status = getMcServerStatus(id)
  res.json({ logs, ...status })
})

router.get('/server/status', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const id = getServerId(dirPath)
  const status = getMcServerStatus(id)
  res.json(status)
})

router.get('/server/resources', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const id = getServerId(dirPath)
  const status = getMcServerStatus(id)
  const disk = getDirSize(dirPath)

  if (!status.running) {
    return res.json({ running: false, cpu: null, memory: null, disk: disk })
  }

  const ps = `$p = Get-Process -Id ${status.pid} -ErrorAction SilentlyContinue; if ($p) { $c1 = $p.CPU; Start-Sleep -Milliseconds 300; $p.Refresh(); $c2 = (Get-Process -Id ${status.pid}).CPU; $cores = [Environment]::ProcessorCount; $pct = [math]::Round((($c2 - $c1) / 0.3 / $cores) * 100, 1); Write-Output "$pct|$($p.WorkingSet64)" }`

  exec(`powershell -NoProfile -Command "${ps}"`, (err, stdout) => {
    if (err || !stdout.trim()) {
      return res.json({ running: true, cpu: null, memory: null, disk: disk })
    }
    const [cpu, mem] = stdout.trim().split('|')
    res.json({
      running: true,
      cpu: cpu ? parseFloat(cpu) : null,
      memory: mem ? parseInt(mem) : null,
      disk: disk
    })
  })
})

// ===== Backups =====

router.get('/backups', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const backupDir = path.join(dirPath, BACKUP_FOLDER)
  if (!fs.existsSync(backupDir)) return res.json({ backups: [] })
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => {
      const st = fs.statSync(path.join(backupDir, f))
      return { name: f, size: st.size, created: st.mtime }
    })
    .sort((a, b) => b.created - a.created)
  res.json({ backups })
})

router.post('/backups/create', (req, res) => {
  const { dirPath } = req.body
  if (!dirPath) return res.status(400).json({ error: 'Directorio requerido' })
  const backupDir = path.join(dirPath, BACKUP_FOLDER)
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
  const dest = path.join(backupDir, name)
  
  const ps = `$items = Get-ChildItem '${dirPath}' | Where-Object { $_.Name -ne '${BACKUP_FOLDER}' } | Select-Object -ExpandProperty FullName; Compress-Archive -Path $items -DestinationPath '${dest}' -Force -CompressionLevel Optimal`
  
  exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 300000 }, (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true, name })
  })
})

router.post('/backups/delete', (req, res) => {
  const { dirPath, name } = req.body
  if (!dirPath || !name) return res.status(400).json({ error: 'Parametros requeridos' })
  const backupDir = path.join(dirPath, BACKUP_FOLDER)
  const filePath = path.join(backupDir, name)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup no encontrado' })
  fs.unlinkSync(filePath)
  res.json({ success: true })
})

router.get('/backups/download', (req, res) => {
  const { path: dirPath, name } = req.query
  if (!dirPath || !name) return res.status(400).send('Parametros requeridos')
  const backupDir = path.join(dirPath, BACKUP_FOLDER)
  const filePath = path.join(backupDir, name)
  if (!fs.existsSync(filePath)) return res.status(404).send('Backup no encontrado')
  res.download(filePath)
})

// ===== Network Optimization =====

function runNetsh(args) {
  try {
    return execSync(`netsh ${args}`, { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim()
  } catch {
    return null
  }
}

// Spawning powershell.exe has significant cold-start overhead (module loading, etc.),
// often 0.5-2s per process. Running many sequential -Command invocations (one per
// setting) made the "Optimizar Red" button and status refresh feel stuck for many
// seconds. Instead, a single consolidated script is written to a temp .ps1 file and
// executed in ONE process, cutting latency down to a single powershell startup.
function runPowershellScript(scriptContent, timeoutMs = 10000) {
  const tmpFile = path.join(os.tmpdir(), `lpelp-net-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
  try {
    fs.writeFileSync(tmpFile, scriptContent, 'utf-8')
    const out = execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { encoding: 'utf-8', timeout: timeoutMs, windowsHide: true }
    )
    return { success: true, output: out.trim() }
  } catch (err) {
    const output = (err.stdout || err.stderr || err.message || '').toString().trim()
    return { success: false, output }
  } finally {
    fs.unlink(tmpFile, () => {})
  }
}

function isPrivilegeError(text) {
  if (!text) return false
  return /access is denied|acceso denegado|elevat|elevaci[oó]n|requires? administrator|administrador|permission denied|permiso denegado/i.test(text)
}

// netsh output field labels are localized on non-English Windows installs (e.g. Spanish),
// which breaks lookups by English key. PowerShell's NetTCPIP cmdlets return
// locale-independent property names, so they are used as the primary source.
// Note: the underlying properties are CIM enums, which ConvertTo-Json serializes
// as raw numeric values unless explicitly converted with .ToString() first.
function getNetworkInfoPowershell() {
  const script = [
    '$s = Get-NetTCPSetting -SettingName InternetCustom',
    '$r = Get-NetOffloadGlobalSetting',
    '[PSCustomObject]@{',
    '  AutoTuningLevelLocal = $s.AutoTuningLevelLocal.ToString()',
    '  CongestionProvider   = $s.CongestionProvider.ToString()',
    '  EcnCapability        = $s.EcnCapability.ToString()',
    '  Timestamps           = $s.Timestamps.ToString()',
    '  InitialRto           = [int]$s.InitialRto',
    '  ScalingHeuristics    = $s.ScalingHeuristics.ToString()',
    '  ReceiveSideScaling   = $r.ReceiveSideScaling.ToString()',
    '} | ConvertTo-Json -Compress',
  ].join('\n')

  const { success, output } = runPowershellScript(script, 6000)
  if (!success || !output) return null
  try {
    return JSON.parse(output)
  } catch {
    return null
  }
}

const OPTIMIZE_COMMANDS = [
  { label: 'TCP Auto-Tuning (normal)', action: 'Set-NetTCPSetting -SettingName InternetCustom -AutoTuningLevelLocal Normal' },
  { label: 'CTCP (Compound TCP)', action: 'Set-NetTCPSetting -SettingName InternetCustom -CongestionProvider CTCP' },
  { label: 'Desactivar heuristics TCP', action: 'Set-NetTCPSetting -SettingName InternetCustom -ScalingHeuristics Disabled' },
  { label: 'RSS (Receive Side Scaling)', action: 'Set-NetOffloadGlobalSetting -ReceiveSideScaling Enabled' },
  { label: 'TCP Timestamps', action: 'Set-NetTCPSetting -SettingName InternetCustom -Timestamps Enabled' },
  { label: 'Initial RTO 300ms', action: 'Set-NetTCPSetting -SettingName InternetCustom -InitialRto 300' },
  { label: 'ECN (Explicit Congestion Notification)', action: 'Set-NetTCPSetting -SettingName InternetCustom -EcnCapability Enabled' },
]

function runNetworkOptimizePowershell() {
  const lines = ['$results = @()']
  for (const { label, action } of OPTIMIZE_COMMANDS) {
    const safeLabel = label.replace(/'/g, "''")
    lines.push(
      `try { ${action} -ErrorAction Stop; $results += [PSCustomObject]@{label='${safeLabel}';success=$true;output='OK'} } ` +
      `catch { $results += [PSCustomObject]@{label='${safeLabel}';success=$false;output=$_.Exception.Message} }`
    )
  }
  lines.push('$results | ConvertTo-Json -Compress')

  const { success, output } = runPowershellScript(lines.join('\n'), 12000)
  if (!success || !output) return null
  try {
    const parsed = JSON.parse(output)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return null
  }
}

function parseTcpGlobal(output) {
  const settings = {}
  if (!output) return settings
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    const idx = trimmed.indexOf(':')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      settings[key] = val
    }
  }
  return settings
}

router.get('/network-status', (req, res) => {
  const dirPath = (req.query.path || '').toString()
  const isWin = process.platform === 'win32'

  const psSettings = isWin ? getNetworkInfoPowershell() : null

  // Fallback to netsh text parsing only if PowerShell NetTCPIP module is unavailable
  const tcpGlobal = isWin && !psSettings ? parseTcpGlobal(runNetsh('int tcp show global')) : {}
  const heuristicsFallback = isWin && !psSettings ? runNetsh('int tcp show heuristics') : ''

  const congestionProvider = psSettings?.CongestionProvider
    || tcpGlobal['Congestion Control Provider'] || tcpGlobal['Add-On Congestion Control Provider'] || 'unknown'
  const autoTuning = psSettings?.AutoTuningLevelLocal
    || tcpGlobal['Receive Window Auto-Tuning Level'] || 'unknown'
  const rss = psSettings?.ReceiveSideScaling || tcpGlobal['RSS'] || 'unknown'
  const timestamps = psSettings?.Timestamps
    || tcpGlobal['TCP Timestamps'] || 'unknown'
  const initialRto = (psSettings?.InitialRto != null ? String(psSettings.InitialRto) : null)
    || tcpGlobal['Initial RTO'] || 'unknown'
  const ecn = psSettings?.EcnCapability
    || tcpGlobal['ECN Capability'] || 'unknown'
  const heuristicsValue = psSettings?.ScalingHeuristics || heuristicsFallback

  let serverProps = {}
  if (dirPath && fs.existsSync(dirPath)) {
    const propsFile = path.join(dirPath, 'server.properties')
    if (fs.existsSync(propsFile)) {
      serverProps = parseServerProperties(propsFile)
    }
  }

  res.json({
    isWindows: isWin,
    tcp: {
      autoTuning,
      congestionProvider,
      rss,
      timestamps,
      initialRto,
      ecn,
      heuristics: /disabled/i.test(String(heuristicsValue)) ? 'disabled' : 'enabled',
    },
    serverProperties: {
      'network-compression-threshold': serverProps['network-compression-threshold'] || '256',
      'view-distance': serverProps['view-distance'] || '10',
      'simulation-distance': serverProps['simulation-distance'] || '10',
      'use-native-transport': serverProps['use-native-transport'] || 'true',
      'player-idle-timeout': serverProps['player-idle-timeout'] || '0',
    },
  })
})

router.post('/network-optimize', (req, res) => {
  const { dirPath } = req.body
  const isWin = process.platform === 'win32'
  const results = []

  if (isWin) {
    const psResults = runNetworkOptimizePowershell()
    if (psResults) {
      for (const r of psResults) {
        let finalOutput = 'OK'
        if (!r.success) {
          finalOutput = isPrivilegeError(r.output)
            ? 'Requiere privilegios de administrador. Ejecuta el panel como Administrador.'
            : (r.output || 'Error desconocido')
        }
        results.push({ label: r.label, success: r.success, output: finalOutput })
      }
    } else {
      results.push({ label: 'Optimizacion TCP', success: false, output: 'No se pudo ejecutar PowerShell' })
    }
  } else {
    results.push({ label: 'Optimizacion TCP', success: false, output: 'Solo disponible en Windows' })
  }

  if (dirPath && fs.existsSync(dirPath)) {
    const propsFile = path.join(dirPath, 'server.properties')
    let props = {}
    if (fs.existsSync(propsFile)) {
      props = parseServerProperties(propsFile)
    }

    props['network-compression-threshold'] = '256'
    props['view-distance'] = props['view-distance'] || '7'
    props['simulation-distance'] = props['simulation-distance'] || '5'
    props['use-native-transport'] = 'true'
    props['player-idle-timeout'] = '0'

    try {
      fs.writeFileSync(propsFile, serializeServerProperties(props))
      results.push({ label: 'server.properties optimizado', success: true, output: 'compression=256, view=7, sim=5, native=true' })
    } catch (err) {
      results.push({ label: 'server.properties optimizado', success: false, output: err.message })
    }
  }

  const allOk = results.every((r) => r.success)
  res.json({ success: allOk, results })
})

export default router
