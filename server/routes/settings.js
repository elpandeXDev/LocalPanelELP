import { Router } from 'express'
import { execSync } from 'child_process'
import { loadSettings, saveSettings } from '../config/stores.js'

const router = Router()

function detectDocker() {
  try {
    const version = execSync('docker --version', { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim()
    let running = false
    try {
      execSync('docker info', { encoding: 'utf-8', timeout: 5000, windowsHide: true })
      running = true
    } catch {}
    return { installed: true, version, running }
  } catch {
    return { installed: false, version: null, running: false }
  }
}

router.get('/docker-status', (req, res) => {
  const docker = detectDocker()
  const settings = loadSettings()
  res.json({
    docker,
    executionMode: settings.executionMode,
  })
})

router.post('/execution-mode', (req, res) => {
  const { mode } = req.body
  if (mode !== 'local' && mode !== 'docker') {
    return res.status(400).json({ error: 'Modo invalido. Debe ser "local" o "docker".' })
  }

  if (mode === 'docker') {
    const docker = detectDocker()
    if (!docker.installed) {
      return res.status(400).json({ error: 'Docker no esta instalado en este sistema.' })
    }
    if (!docker.running) {
      return res.status(400).json({ error: 'Docker esta instalado pero no esta en ejecucion. Inicia Docker Desktop primero.' })
    }
  }

  const settings = saveSettings({ executionMode: mode })
  res.json({ success: true, executionMode: settings.executionMode })
})

export default router
