import { spawn, exec } from 'child_process'
import { getBot, updateBot } from './config/stores.js'
import fs from 'fs'
import path from 'path'

const processes = new Map()
const logs = new Map()

function getLog(id) {
  if (!logs.has(id)) logs.set(id, [])
  return logs.get(id)
}

function inferCommandForEntry(entryFile, directory, preferredLanguage) {
  const full = path.isAbsolute(entryFile) ? entryFile : path.join(directory, entryFile)
  const ext = path.extname(full).toLowerCase()
  const isWin = process.platform === 'win32'
  // If file doesn't exist but a project file exists, infer commands for ecosystems
  const csproj = fs.existsSync(full) ? '' : (fs.readdirSync(directory).find(f => f.endsWith('.csproj')) || '')
  const goMain = fs.existsSync(path.join(directory, 'main.go'))

  // By language hint
  if (preferredLanguage) {
    switch (preferredLanguage) {
      case 'node': return { cmd: isWin ? 'node.exe' : 'node', args: [entryFile || 'index.js'] }
      case 'python': return { cmd: isWin ? 'python.exe' : 'python3', args: [entryFile || 'main.py'] }
      case 'python3': return { cmd: 'python3', args: [entryFile || 'main.py'] }
      case 'java': return { cmd: isWin ? 'java.exe' : 'java', args: ['-jar', entryFile || 'bot.jar'] }
      case 'ruby': return { cmd: isWin ? 'ruby.exe' : 'ruby', args: [entryFile || 'bot.rb'] }
      case 'go': return { cmd: 'go', args: goMain ? ['run', '.'] : ['run', entryFile || 'main.go'] }
      case 'csharp':
        if (csproj) return { cmd: 'dotnet', args: ['run', '--project', csproj] }
        if (ext === '.dll') return { cmd: 'dotnet', args: [entryFile] }
        return { cmd: 'dotnet', args: ['run'] }
      default: break
    }
  }

  // Infer by extension
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return { cmd: isWin ? 'node.exe' : 'node', args: [entryFile] }
  if (ext === '.py') return { cmd: isWin ? 'python.exe' : 'python3', args: [entryFile] }
  if (ext === '.jar') return { cmd: isWin ? 'java.exe' : 'java', args: ['-jar', entryFile] }
  if (ext === '.rb') return { cmd: isWin ? 'ruby.exe' : 'ruby', args: [entryFile] }
  if (ext === '.go') return { cmd: 'go', args: ['run', entryFile] }
  if (ext === '.dll') return { cmd: 'dotnet', args: [entryFile] }
  if (ext === '.ps1') return { cmd: isWin ? 'powershell.exe' : 'pwsh', args: ['-ExecutionPolicy', 'Bypass', '-File', entryFile] }
  if (ext === '.sh') return { cmd: 'bash', args: [entryFile] }
  if (ext === '.exe') return { cmd: full, args: [] }

  // Fallbacks
  if (fs.existsSync(path.join(directory, 'package.json'))) return { cmd: isWin ? 'node.exe' : 'node', args: [entryFile || 'index.js'] }
  if (fs.existsSync(path.join(directory, 'requirements.txt'))) return { cmd: isWin ? 'python.exe' : 'python3', args: [entryFile || 'main.py'] }
  if (csproj) return { cmd: 'dotnet', args: ['run', '--project', csproj] }
  if (goMain) return { cmd: 'go', args: ['run', '.'] }

  return { cmd: isWin ? 'node.exe' : 'node', args: [entryFile || 'index.js'] }
}

export function startBot(botId) {
  const bot = getBot(botId)
  if (!bot) return { error: 'Bot no encontrado' }
  if (processes.has(botId)) return { error: 'El bot ya esta en ejecucion' }

  const log = getLog(botId)
  log.length = 0

  let { cmd, args } = inferCommandForEntry(bot.entryFile || '', bot.directory, bot.language)
  if (bot.customCommand) {
    cmd = bot.customCommand
    args = bot.customArgs ? bot.customArgs.split(' ') : []
  }

  const proc = spawn(cmd, args, {
    cwd: bot.directory,
    shell: true,
    env: { ...process.env, ...(bot.envVars ? parseEnvVars(bot.envVars) : {}) },
  })

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    log.push(...lines.map((l) => ({ type: 'stdout', text: l, time: new Date().toISOString() })))
    if (log.length > 500) log.splice(0, log.length - 500)
  })

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    log.push(...lines.map((l) => ({ type: 'stderr', text: l, time: new Date().toISOString() })))
    if (log.length > 500) log.splice(0, log.length - 500)
  })

  proc.on('close', (code) => {
    log.push({ type: 'exit', text: `Proceso terminado con codigo ${code}`, time: new Date().toISOString() })
    processes.delete(botId)
    updateBot(botId, { status: 'stopped', pid: null })
  })

  processes.set(botId, proc)
  updateBot(botId, { status: 'running', pid: proc.pid, lastStarted: new Date().toISOString() })

  return { success: true, pid: proc.pid }
}

export function stopBot(botId) {
  const proc = processes.get(botId)
  if (!proc) return { error: 'El bot no esta en ejecucion' }

  proc.kill('SIGTERM')
  setTimeout(() => {
    if (processes.has(botId)) {
      proc.kill('SIGKILL')
    }
  }, 3000)

  processes.delete(botId)
  updateBot(botId, { status: 'stopped', pid: null })

  const log = getLog(botId)
  log.push({ type: 'stop', text: 'Bot detenido por el usuario', time: new Date().toISOString() })

  return { success: true }
}

export function restartBot(botId) {
  stopBot(botId)
  setTimeout(() => startBot(botId), 1000)
  return { success: true }
}

export function getBotLogs(botId, lines = 100) {
  const log = getLog(botId)
  return log.slice(-lines)
}

export function getBotStatus(botId) {
  return {
    running: processes.has(botId),
    pid: processes.has(botId) ? processes.get(botId).pid : null,
  }
}

export function stopAllBots() {
  for (const [id, proc] of processes) {
    proc.kill('SIGTERM')
    updateBot(id, { status: 'stopped', pid: null })
  }
  processes.clear()
}

function parseEnvVars(str) {
  const env = {}
  for (const line of str.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  }
  return env
}

// ===== Minecraft Server Management =====

const mcProcesses = new Map()
const mcLogs = new Map()

function getMcLog(id) {
  if (!mcLogs.has(id)) mcLogs.set(id, [])
  return mcLogs.get(id)
}

function findServerJar(dirPath) {
  const priority = ['paper.jar', 'paperclip.jar', 'spigot.jar', 'craftbukkit.jar', 'forge.jar', 'fabric-server-launch.jar', 'bungeecord.jar', 'velocity.jar', 'waterfall.jar', 'server.jar']
  try {
    const items = fs.readdirSync(dirPath)
    const lower = items.map((i) => i.toLowerCase())
    for (const name of priority) {
      const idx = lower.indexOf(name)
      if (idx >= 0) return items[idx]
    }
    const jar = items.find((i) => i.toLowerCase().endsWith('.jar'))
    return jar || null
  } catch {
    return null
  }
}

function findStartScript(dirPath) {
  const candidates = ['start.bat', 'run.bat', 'server-start.bat', 'server_start.bat', 'start.sh', 'run.sh']
  for (const c of candidates) {
    const p = path.join(dirPath, c)
    if (fs.existsSync(p)) return c
  }
  return null
}

function forceKillProcessTree(proc, log, reason = 'Detencion agresiva forzada') {
  if (!proc?.pid) return

  if (process.platform === 'win32') {
    exec(`taskkill /PID ${proc.pid} /T /F`, () => {})
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {
      try { proc.kill('SIGKILL') } catch {}
    }
  }

  if (log) {
    log.push({ type: 'stop', text: `${reason} (PID ${proc.pid})`, time: new Date().toISOString() })
  }
}

export function startMcServer(serverId, dirPath, options = {}) {
  if (mcProcesses.has(serverId)) return { error: 'El servidor ya esta en ejecucion' }

  // If a start script exists, prefer using it
  const startScript = findStartScript(dirPath)
  let jar = null
  if (!startScript) {
    jar = findServerJar(dirPath)
    if (!jar) return { error: 'No se encontro ningun archivo .jar del servidor ni script de arranque' }
  }

  const log = getMcLog(serverId)
  log.length = 0

  const isForge = jar ? jar.toLowerCase().includes('forge') : false
  const isFabric = jar ? jar.toLowerCase().includes('fabric') : false

  let cmd, args
  if (startScript) {
    cmd = startScript
    args = []
  } else if (isForge) {
    cmd = process.platform === 'win32' ? 'java.exe' : 'java'
    args = ['-jar', jar]
  } else if (isFabric) {
    cmd = process.platform === 'win32' ? 'java.exe' : 'java'
    args = ['-jar', jar, 'nogui']
  } else {
    cmd = process.platform === 'win32' ? 'java.exe' : 'java'
    const minMem = options.minMemory || '1024M'
    const maxMem = options.maxMemory || '2048M'
    args = [`-Xms${minMem}`, `-Xmx${maxMem}`, '-jar', jar, 'nogui']
  }

  log.push({ type: 'stdout', text: startScript ? `Iniciando servidor con script: ${startScript}` : `Iniciando servidor: ${jar}`, time: new Date().toISOString() })
  log.push({ type: 'stdout', text: `Comando: ${cmd} ${args.join(' ')}`, time: new Date().toISOString() })
  log.push({ type: 'stdout', text: `Directorio: ${dirPath}`, time: new Date().toISOString() })

  const useShell = !!startScript

  const proc = spawn(cmd, args, {
    cwd: dirPath,
    shell: useShell,
    env: { ...process.env },
  })

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    log.push(...lines.map((l) => ({ type: 'stdout', text: l, time: new Date().toISOString() })))
    if (log.length > 1000) log.splice(0, log.length - 1000)
  })

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    log.push(...lines.map((l) => ({ type: 'stderr', text: l, time: new Date().toISOString() })))
    if (log.length > 1000) log.splice(0, log.length - 1000)
  })

  proc.on('close', (code) => {
    log.push({ type: 'exit', text: `Servidor detenido (codigo ${code})`, time: new Date().toISOString() })
    mcProcesses.delete(serverId)
  })

  proc.on('error', (err) => {
    log.push({ type: 'stderr', text: `Error al iniciar proceso: ${err.message}`, time: new Date().toISOString() })
    mcProcesses.delete(serverId)
  })

  mcProcesses.set(serverId, proc)

  return { success: true, pid: proc.pid }
}

export function stopMcServer(serverId) {
  const proc = mcProcesses.get(serverId)
  if (!proc) return { error: 'El servidor no esta en ejecucion' }

  const log = getMcLog(serverId)
  log.push({ type: 'stop', text: 'Enviando comando stop al servidor...', time: new Date().toISOString() })

  try {
    proc.stdin.write('stop\n')
  } catch {
    proc.kill('SIGTERM')
  }

  const isSameProc = () => mcProcesses.get(serverId) === proc

  setTimeout(() => {
    if (isSameProc()) {
      try { proc.kill('SIGTERM') } catch {}
      log.push({ type: 'stop', text: 'Forzando detencion (SIGTERM)...', time: new Date().toISOString() })
    }
  }, 2500)

  setTimeout(() => {
    if (isSameProc()) {
      forceKillProcessTree(proc, log, 'Servidor no respondio al stop/SIGTERM')
      mcProcesses.delete(serverId)
    }
  }, 5000)

  return { success: true }
}

export function restartMcServer(serverId, dirPath, options) {
  stopMcServer(serverId)
  setTimeout(() => startMcServer(serverId, dirPath, options), 3000)
  return { success: true }
}

export function sendMcCommand(serverId, command) {
  const proc = mcProcesses.get(serverId)
  if (!proc) return { error: 'El servidor no esta en ejecucion' }

  const log = getMcLog(serverId)
  log.push({ type: 'command', text: `> ${command}`, time: new Date().toISOString() })

  try {
    proc.stdin.write(command + '\n')
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

export function getMcServerLogs(serverId, lines = 200) {
  const log = getMcLog(serverId)
  return log.slice(-lines)
}

export function getMcServerStatus(serverId) {
  return {
    running: mcProcesses.has(serverId),
    pid: mcProcesses.has(serverId) ? mcProcesses.get(serverId).pid : null,
  }
}

export function stopAllMcServers() {
  for (const [id, proc] of mcProcesses) {
    try { proc.stdin.write('stop\n') } catch {}
    setTimeout(() => {
      try { proc.kill('SIGTERM') } catch {}
      forceKillProcessTree(proc)
    }, 3000)
  }
  mcProcesses.clear()
}

export function stopAllProcesses() {
  stopAllBots()
  stopAllMcServers()
}
