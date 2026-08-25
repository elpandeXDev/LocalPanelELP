import express from 'express'
import fs from 'fs'
import path from 'path'
import {
  loadBots, addBot, updateBot, removeBot, getBot,
  listLinkedDirs, getLinkedDir,
} from '../config/stores.js'
import {
  startBot, stopBot, restartBot, getBotLogs, getBotStatus,
} from '../processes.js'

const router = express.Router()

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', '__pycache__', '.venv', 'venv', 'env', 'build', 'dist', 'target', 'tmp', 'temp'])
const ROOT_SKIP_DIRS = new Set(['Windows', 'Program Files', 'Program Files (x86)', 'ProgramData', '$Recycle.Bin', 'System Volume Information', 'Recovery', 'PerfLogs'])
const BOT_HINTS = ['bot', 'discord', 'music', 'ticket', 'moderation', 'python', 'node', 'java']
const SCAN_CACHE_TTL_MS = 30_000
const scanCache = new Map()

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

const BOT_DETECTORS = {
  node: {
    name: 'Node.js',
    check: (dir) => {
      const pkg = path.join(dir, 'package.json')
      if (!fs.existsSync(pkg)) return false
      try {
        const content = JSON.parse(fs.readFileSync(pkg, 'utf-8'))
        const deps = { ...content.dependencies, ...content.devDependencies }
        return !!(deps['discord.js'] || deps['discordeno'] || deps['eris'] || deps['oceanic.js'])
      } catch { return false }
    },
    entryFile: 'index.js',
    icon: 'node',
  },
  python: {
    name: 'Python',
    check: (dir) => {
      const reqs = path.join(dir, 'requirements.txt')
      if (fs.existsSync(reqs)) {
        const content = fs.readFileSync(reqs, 'utf-8').toLowerCase()
        if (content.includes('discord.py') || content.includes('discord') || content.includes('pycord') || content.includes('nextcord')) {
          return true
        }
      }
      const pyproject = path.join(dir, 'pyproject.toml')
      if (fs.existsSync(pyproject)) {
        const content = fs.readFileSync(pyproject, 'utf-8').toLowerCase()
        if (content.includes('discord')) return true
      }
      return false
    },
    entryFile: 'main.py',
    icon: 'python',
  },
  java: {
    name: 'Java',
    check: (dir) => {
      const pom = path.join(dir, 'pom.xml')
      if (fs.existsSync(pom)) {
        const content = fs.readFileSync(pom, 'utf-8').toLowerCase()
        if (content.includes('jda') || content.includes('discord4j') || content.includes('javacord')) {
          return true
        }
      }
      const gradle = path.join(dir, 'build.gradle')
      if (fs.existsSync(gradle)) {
        const content = fs.readFileSync(gradle, 'utf-8').toLowerCase()
        if (content.includes('jda') || content.includes('discord4j') || content.includes('javacord')) {
          return true
        }
      }
      return false
    },
    entryFile: 'bot.jar',
    icon: 'java',
  },
  csharp: {
    name: 'C# (.NET)',
    check: (dir) => {
      const csproj = fs.readdirSync(dir).find((f) => f.endsWith('.csproj'))
      if (csproj) {
        const content = fs.readFileSync(path.join(dir, csproj), 'utf-8').toLowerCase()
        if (content.includes('discord.net') || content.includes('dsharpplus')) {
          return true
        }
      }
      return false
    },
    entryFile: '',
    icon: 'csharp',
  },
  go: {
    name: 'Go',
    check: (dir) => {
      const gomod = path.join(dir, 'go.mod')
      if (fs.existsSync(gomod)) {
        const content = fs.readFileSync(gomod, 'utf-8').toLowerCase()
        if (content.includes('discordgo') || content.includes('arikawa')) {
          return true
        }
      }
      return false
    },
    entryFile: '',
    icon: 'go',
  },
  ruby: {
    name: 'Ruby',
    check: (dir) => {
      const gemfile = path.join(dir, 'Gemfile')
      if (fs.existsSync(gemfile)) {
        const content = fs.readFileSync(gemfile, 'utf-8').toLowerCase()
        if (content.includes('discordrb') || content.includes('mij')) {
          return true
        }
      }
      return false
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
    for (const [lang, detector] of Object.entries(BOT_DETECTORS)) {
      if (detector.check(basePath)) {
        // Try to guess a common entry script when possible
        let detectedEntry = detector.entryFile
        const candidates = ['index.js', 'bot.js', 'main.js', 'app.js', 'main.py', 'bot.py']
        for (const c of candidates) {
          const p = path.join(basePath, c)
          if (fs.existsSync(p)) { detectedEntry = c; break }
        }
        results.push({
          language: lang,
          languageName: detector.name,
          path: basePath,
          name: path.basename(basePath),
          entryFile: detectedEntry,
          icon: detector.icon,
        })
        return results
      }
    }

    if (currentDepth < maxDepth) {
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
  const { name, directory, language, entryFile, envVars, autoStart } = req.body
  if (!name || !directory) return res.status(400).json({ error: 'Nombre y directorio requeridos' })
  if (!fs.existsSync(directory)) return res.status(400).json({ error: 'El directorio no existe' })

  const bot = addBot({
    name,
    directory,
    language: language || 'node',
    entryFile: entryFile || '',
    envVars: envVars || '',
    autoStart: autoStart || false,
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
  let basePath

  const cacheKey = JSON.stringify({ type: 'bots', mountId: mountId || 'all-disks', depth, maxVisited, maxMs })
  const cached = getScanCache(cacheKey)
  if (cached) return res.json({ ...cached, cached: true })

  if (!mountId || mountId === 'internal') {
    return res.json({ bots: [], message: 'Usa un directorio vinculado para detectar bots' })
  }

  const linked = getLinkedDir(mountId)
  if (!linked) return res.status(404).json({ error: 'Directorio no vinculado' })

  basePath = linked.path
  if (!fs.existsSync(basePath)) return res.status(404).json({ error: 'La ruta no existe' })

  const state = { visited: 0, maxVisited, startMs: Date.now(), maxMs }
  const bots = scanForBots(basePath, depth, 0, state)
  const payload = {
    bots,
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
