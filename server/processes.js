import { spawn, exec } from 'child_process'
import { getBot, updateBot } from './config/stores.js'
import fs from 'fs'
import path from 'path'

const processes = new Map()
const logs = new Map()
const manualStops = new Set()
const crashState = new Map()
const MAX_RESTART_ATTEMPTS = 5
const RESTART_RESET_MS = 60_000

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

function hasNodeModules(directory) {
  return fs.existsSync(path.join(directory, 'node_modules'))
}

function hasPythonDeps(directory) {
  return fs.existsSync(path.join(directory, '.deps_installed'))
}

function resolveInstallCommand(bot) {
  const isWin = process.platform === 'win32'
  const dir = bot.directory

  if ((bot.language === 'node' || fs.existsSync(path.join(dir, 'package.json'))) && !hasNodeModules(dir)) {
    return { cmd: isWin ? 'npm.cmd' : 'npm', args: ['install'] }
  }
  if ((bot.language === 'python' || bot.language === 'python3') && fs.existsSync(path.join(dir, 'requirements.txt')) && !hasPythonDeps(dir)) {
    return { cmd: isWin ? 'pip.exe' : 'pip3', args: ['install', '-r', 'requirements.txt'] }
  }
  if (bot.language === 'go' && fs.existsSync(path.join(dir, 'go.mod'))) {
    return { cmd: 'go', args: ['mod', 'download'] }
  }
  if (bot.language === 'ruby' && fs.existsSync(path.join(dir, 'Gemfile'))) {
    return { cmd: isWin ? 'bundle.bat' : 'bundle', args: ['install'] }
  }
  if (bot.language === 'csharp') {
    const csproj = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.endsWith('.csproj')) : null
    if (csproj) return { cmd: 'dotnet', args: ['restore', csproj] }
  }
  return null
}

export function installBotDependencies(botId) {
  const bot = getBot(botId)
  if (!bot) return { error: 'Bot no encontrado' }

  const install = resolveInstallCommand(bot)
  const log = getLog(botId)

  if (!install) {
    log.push({ type: 'stdout', text: 'No se detectaron dependencias pendientes por instalar.', time: new Date().toISOString() })
    return { success: true, skipped: true }
  }

  log.push({ type: 'stdout', text: `Instalando dependencias: ${install.cmd} ${install.args.join(' ')}`, time: new Date().toISOString() })

  const proc = spawn(install.cmd, install.args, {
    cwd: bot.directory,
    shell: true,
    env: process.env,
    windowsHide: true,
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
    if ((bot.language === 'python' || bot.language === 'python3') && code === 0) {
      try { fs.writeFileSync(path.join(bot.directory, '.deps_installed'), new Date().toISOString()) } catch {}
    }
    log.push({ type: code === 0 ? 'stdout' : 'stderr', text: `Instalacion de dependencias finalizada (codigo ${code})`, time: new Date().toISOString() })
  })

  return { success: true, started: true }
}

export function startBot(botId) {
  const bot = getBot(botId)
  if (!bot) return { error: 'Bot no encontrado' }
  if (processes.has(botId)) return { error: 'El bot ya esta en ejecucion' }

  const log = getLog(botId)
  log.length = 0
  manualStops.delete(botId)

  const install = resolveInstallCommand(bot)
  if (install) {
    installBotDependencies(botId)
  }

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

  const startedAt = Date.now()

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

    const wasManualStop = manualStops.delete(botId)
    const currentBot = getBot(botId)
    const ranMs = Date.now() - startedAt

    if (wasManualStop || !currentBot || currentBot.keepAlive === false) {
      updateBot(botId, { status: 'stopped', pid: null })
      return
    }

    if (ranMs > RESTART_RESET_MS) {
      crashState.delete(botId)
    }

    const state = crashState.get(botId) || { attempts: 0 }
    state.attempts += 1
    crashState.set(botId, state)

    if (state.attempts > MAX_RESTART_ATTEMPTS) {
      log.push({ type: 'stderr', text: 'Se alcanzo el maximo de reinicios automaticos. El bot no se reiniciara solo.', time: new Date().toISOString() })
      updateBot(botId, { status: 'crashed', pid: null })
      return
    }

    const delayMs = Math.min(30_000, 1000 * 2 ** (state.attempts - 1))
    updateBot(botId, { status: 'restarting', pid: null })
    log.push({ type: 'stop', text: `El bot se detuvo inesperadamente. Reiniciando en ${Math.round(delayMs / 1000)}s (intento ${state.attempts}/${MAX_RESTART_ATTEMPTS})...`, time: new Date().toISOString() })

    setTimeout(() => {
      if (!processes.has(botId)) startBot(botId)
    }, delayMs)
  })

  processes.set(botId, proc)
  updateBot(botId, { status: 'running', pid: proc.pid, lastStarted: new Date().toISOString() })

  return { success: true, pid: proc.pid }
}

export function stopBot(botId) {
  const proc = processes.get(botId)
  if (!proc) return { error: 'El bot no esta en ejecucion' }

  manualStops.add(botId)
  crashState.delete(botId)

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
  manualStops.add(botId)
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
    manualStops.add(id)
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
const MC_JAR_PRIORITY = ['paper.jar', 'paperclip.jar', 'spigot.jar', 'craftbukkit.jar', 'forge.jar', 'fabric-server-launch.jar', 'bungeecord.jar', 'velocity.jar', 'waterfall.jar', 'server.jar']
let cachedJavaCommand = null

function getMcLog(id) {
  if (!mcLogs.has(id)) mcLogs.set(id, [])
  return mcLogs.get(id)
}

function resolveJavaCommand() {
  if (cachedJavaCommand) return cachedJavaCommand

  const isWin = process.platform === 'win32'
  const javaBinary = isWin ? 'java.exe' : 'java'
  const javaHome = process.env.JAVA_HOME

  if (javaHome) {
    const javaFromHome = path.join(javaHome, 'bin', javaBinary)
    if (fs.existsSync(javaFromHome)) {
      cachedJavaCommand = javaFromHome
      return cachedJavaCommand
    }
  }

  cachedJavaCommand = javaBinary
  return cachedJavaCommand
}

function findServerJar(dirPath) {
  try {
    for (const name of MC_JAR_PRIORITY) {
      if (fs.existsSync(path.join(dirPath, name))) return name
    }

    const items = fs.readdirSync(dirPath)
    const byLowerName = new Map(items.map((item) => [item.toLowerCase(), item]))
    for (const name of MC_JAR_PRIORITY) {
      const match = byLowerName.get(name)
      if (match) return match
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
  const javaCmd = resolveJavaCommand()

  let cmd, args
  if (startScript) {
    cmd = startScript
    args = []
  } else if (isForge) {
    cmd = javaCmd
    args = ['-jar', jar]
  } else if (isFabric) {
    cmd = javaCmd
    args = ['-jar', jar, 'nogui']
  } else {
    cmd = javaCmd
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
    env: process.env,
    windowsHide: true,
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
