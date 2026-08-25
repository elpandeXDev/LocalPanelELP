import express from 'express'
import fs from 'fs'
import path from 'path'
import {
  loadBots, addBot, updateBot, removeBot, getBot,
  listLinkedDirs, getLinkedDir,
} from '../config/stores.js'
import {
  startBot, stopBot, restartBot, getBotLogs, getBotStatus, installBotDependencies,
} from '../processes.js'

const router = express.Router()

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', '__pycache__', '.venv', 'venv', 'env', 'build', 'dist', 'target', 'tmp', 'temp'])
const ROOT_SKIP_DIRS = new Set(['Windows', 'Program Files', 'Program Files (x86)', 'ProgramData', '$Recycle.Bin', 'System Volume Information', 'Recovery', 'PerfLogs'])
const BOT_HINTS = ['bot', 'discord', 'music', 'ticket', 'moderation', 'python', 'node', 'java']
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
  for (const hint of BOT_HINTS) {
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

const ENTRY_CANDIDATES = {
  node: ['index.js', 'bot.js', 'main.js', 'app.js', 'src/index.js', 'src/bot.js', 'src/main.js', 'index.mjs', 'index.cjs'],
  python: ['main.py', 'bot.py', 'app.py', 'run.py', '__main__.py', 'src/main.py', 'src/bot.py'],
  ruby: ['bot.rb', 'main.rb', 'app.rb'],
}

function detectNodeMainFile(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
    if (pkg.main && fs.existsSync(path.join(dir, pkg.main))) return pkg.main
  } catch {}
  return null
}

function detectJarFile(dir) {
  const searchDirs = [dir, path.join(dir, 'target'), path.join(dir, 'build', 'libs')]
  for (const searchDir of searchDirs) {
    try {
      if (!fs.existsSync(searchDir)) continue
      const jars = fs.readdirSync(searchDir)
        .filter((f) => f.toLowerCase().endsWith('.jar'))
        .filter((f) => !/sources|javadoc|original-/i.test(f))
      if (jars.length > 0) {
        const rel = searchDir === dir ? jars[0] : path.join(path.relative(dir, searchDir), jars[0])
        return rel
      }
    } catch {}
  }
  return null
}

function detectEntryFile(basePath, lang, fallback) {
  if (lang === 'node') {
    const main = detectNodeMainFile(basePath)
    if (main) return main
  }
  if (lang === 'java') {
    const jar = detectJarFile(basePath)
    if (jar) return jar
  }
  if (lang === 'csharp') {
    try {
      const csproj = fs.readdirSync(basePath).find((f) => f.endsWith('.csproj'))
      if (csproj) return csproj
    } catch {}
    return fallback
  }
  if (lang === 'go') {
    if (fs.existsSync(path.join(basePath, 'main.go'))) return 'main.go'
    return fallback
  }

  const candidates = ENTRY_CANDIDATES[lang] || []
  for (const c of candidates) {
    if (fs.existsSync(path.join(basePath, c))) return c
  }
  return fallback
}

function detectEnvTemplate(basePath) {
  const files = ['.env.example', '.env.sample', '.env']
  for (const f of files) {
    const p = path.join(basePath, f)
    if (!fs.existsSync(p)) continue
    try {
      const content = fs.readFileSync(p, 'utf-8')
      const keys = []
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx > 0) keys.push(trimmed.slice(0, idx).trim())
      }
      if (keys.length > 0) return keys.map((k) => `${k}=`).join('\n')
    } catch {}
  }
  return ''
}

const BOT_DETECTORS = {
  node: {
    name: 'Node.js',
    check: (dir, lowerNames) => {
      if (!lowerNames.includes('package.json')) return false
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
        const deps = { ...content.dependencies, ...content.devDependencies }
        return !!(deps['discord.js'] || deps['discordeno'] || deps['eris'] || deps['oceanic.js'])
      } catch { return false }
    },
    entryFile: 'index.js',
    icon: 'node',
  },
  python: {
    name: 'Python',
    check: (dir, lowerNames) => {
      if (lowerNames.includes('requirements.txt')) {
        try {
          const content = fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf-8').toLowerCase()
          if (content.includes('discord.py') || content.includes('discord') || content.includes('pycord') || content.includes('nextcord')) {
            return true
          }
        } catch {}
      }
      if (lowerNames.includes('pyproject.toml')) {
        try {
          const content = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf-8').toLowerCase()
          if (content.includes('discord')) return true
        } catch {}
      }
      return false
    },
    entryFile: 'main.py',
    icon: 'python',
  },
  java: {
    name: 'Java',
    check: (dir, lowerNames) => {
      if (lowerNames.includes('pom.xml')) {
        try {
          const content = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf-8').toLowerCase()
          if (content.includes('jda') || content.includes('discord4j') || content.includes('javacord')) {
            return true
          }
        } catch {}
      }
      if (lowerNames.includes('build.gradle')) {
        try {
          const content = fs.readFileSync(path.join(dir, 'build.gradle'), 'utf-8').toLowerCase()
          if (content.includes('jda') || content.includes('discord4j') || content.includes('javacord')) {
            return true
          }
        } catch {}
      }
      return false
    },
    entryFile: 'bot.jar',
    icon: 'java',
  },
  csharp: {
    name: 'C# (.NET)',
    check: (dir, lowerNames, fileNames) => {
      const csproj = fileNames.find((f) => f.endsWith('.csproj'))
      if (!csproj) return false
      try {
        const content = fs.readFileSync(path.join(dir, csproj), 'utf-8').toLowerCase()
        return content.includes('discord.net') || content.includes('dsharpplus')
      } catch { return false }
    },
    entryFile: '',
    icon: 'csharp',
  },
  go: {
    name: 'Go',
    check: (dir, lowerNames) => {
      if (!lowerNames.includes('go.mod')) return false
      try {
        const content = fs.readFileSync(path.join(dir, 'go.mod'), 'utf-8').toLowerCase()
        return content.includes('discordgo') || content.includes('arikawa')
      } catch { return false }
    },
    entryFile: '',
    icon: 'go',
  },
  ruby: {
    name: 'Ruby',
    check: (dir, lowerNames, fileNames) => {
      if (!lowerNames.includes('gemfile')) return false
      try {
        const gemfile = fileNames.find((f) => f.toLowerCase() === 'gemfile')
        const content = fs.readFileSync(path.join(dir, gemfile), 'utf-8').toLowerCase()
        return content.includes('discordrb') || content.includes('mij')
      } catch { return false }
    },
    entryFile: 'bot.rb',
    icon: 'ruby',
  },
}

function scanForBots(basePath, maxDepth = 5, currentDepth = 0, state = { visited: 0, maxVisited: 60_000, startMs: Date.now(), maxMs: 25_000 }) {
  const results = []
  if (currentDepth > maxDepth) return results
  if (state.visited >= state.maxVisited) return results
  if (Date.now() - state.startMs > state.maxMs) return results

  state.visited += 1

  try {
    const items = fs.readdirSync(basePath, { withFileTypes: true })

    const fileNames = []
    const subDirNames = []
    for (const item of items) {
      if (item.isSymbolicLink()) continue
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && !shouldSkipDirectory(item.name, currentDepth)) {
          subDirNames.push(item.name)
        }
      } else if (item.isFile()) {
        fileNames.push(item.name)
      }
    }
    const lowerNames = fileNames.map((f) => f.toLowerCase())

    for (const [lang, detector] of Object.entries(BOT_DETECTORS)) {
      if (detector.check(basePath, lowerNames, fileNames)) {
        const detectedEntry = detectEntryFile(basePath, lang, detector.entryFile)
        const envTemplate = detectEnvTemplate(basePath)
        results.push({
          language: lang,
          languageName: detector.name,
          path: basePath,
          name: path.basename(basePath),
          entryFile: detectedEntry,
          envTemplate,
          icon: detector.icon,
        })
        return results
      }
    }

    if (currentDepth < maxDepth) {
      const dirs = subDirNames.sort((a, b) => directoryPriorityScore(b) - directoryPriorityScore(a))

      for (const name of dirs) {
        if (state.visited >= state.maxVisited) break
        if (Date.now() - state.startMs > state.maxMs) break
        const fullPath = path.join(basePath, name)
        results.push(...scanForBots(fullPath, maxDepth, currentDepth + 1, state))
      }
    }
  } catch {}

  return results
}

router.get('/', (req, res) => {
  const bots = loadBots().map((bot) => {
    const status = getBotStatus(bot.id)
    return { ...bot, ...status }
  })
  res.json({ bots })
})

router.post('/', (req, res) => {
  const { name, directory, language, entryFile, envVars, autoStart, keepAlive } = req.body
  if (!name || !directory) return res.status(400).json({ error: 'Nombre y directorio requeridos' })
  if (!fs.existsSync(directory)) return res.status(400).json({ error: 'El directorio no existe' })

  const bot = addBot({
    name,
    directory,
    language: language || 'node',
    entryFile: entryFile || '',
    envVars: envVars || '',
    autoStart: autoStart || false,
    keepAlive: keepAlive !== false,
    status: 'stopped',
  })
  res.json({ success: true, bot })
})

router.put('/:id', (req, res) => {
  const bot = updateBot(req.params.id, req.body)
  if (!bot) return res.status(404).json({ error: 'Bot no encontrado' })
  res.json({ success: true, bot })
})

router.delete('/:id', (req, res) => {
  stopBot(req.params.id)
  removeBot(req.params.id)
  res.json({ success: true })
})

router.post('/:id/start', (req, res) => {
  const result = startBot(req.params.id)
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.post('/:id/stop', (req, res) => {
  const result = stopBot(req.params.id)
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.post('/:id/restart', (req, res) => {
  const result = restartBot(req.params.id)
  res.json(result)
})

router.post('/:id/install', (req, res) => {
  const result = installBotDependencies(req.params.id)
  if (result.error) return res.status(400).json(result)
  res.json(result)
})

router.get('/:id/logs', (req, res) => {
  const lines = parseInt(req.query.lines) || 100
  const logs = getBotLogs(req.params.id, lines)
  res.json({ logs })
})

router.get('/:id/status', (req, res) => {
  const status = getBotStatus(req.params.id)
  res.json(status)
})

router.get('/detect', (req, res) => {
  const mountId = (req.query.mount || '').toString()
  const depth = Math.max(1, Math.min(8, parseInt(req.query.depth) || 5))
  const maxVisited = Math.max(5_000, Math.min(300_000, parseInt(req.query.maxDirs) || (mountId === 'all-disks' || mountId === 'internal' || !mountId ? 90_000 : 60_000)))
  const maxMs = Math.max(5_000, Math.min(180_000, parseInt(req.query.maxMs) || (mountId === 'all-disks' || mountId === 'internal' || !mountId ? 45_000 : 25_000)))
  const roots = []

  const cacheKey = JSON.stringify({ type: 'bots', mountId: mountId || 'all-disks', depth, maxVisited, maxMs })
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
    all.push(...scanForBots(root, depth, 0, state))
    if (state.visited >= state.maxVisited) break
    if (Date.now() - state.startMs > state.maxMs) break
  }

  const seen = new Set()
  const bots = all.filter((b) => {
    if (seen.has(b.path)) return false
    seen.add(b.path)
    return true
  })

  const payload = {
    bots,
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

router.get('/languages', (req, res) => {
  res.json({
    languages: Object.entries(BOT_DETECTORS).map(([id, d]) => ({
      id,
      name: d.name,
      entryFile: d.entryFile,
    })),
  })
})

export default router
