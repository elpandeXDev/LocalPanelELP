import express from 'express'
import fs from 'fs'
import path from 'path'
import {
  listLinkedDirs, addLinkedDir, removeLinkedDir, getLinkedDir,
} from '../config/stores.js'

const router = express.Router()

function listRoots() {
  if (process.platform !== 'win32') return ['/']
  const roots = []
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i)
    const root = `${letter}:\\`
    try {
      if (fs.existsSync(root)) roots.push(root)
    } catch {}
  }
  return roots
}

router.get('/', (req, res) => {
  const dirs = listLinkedDirs().map((d) => ({
    ...d,
    exists: fs.existsSync(d.path),
  }))
  res.json({ dirs })
})

router.post('/', (req, res) => {
  const { name, path: fsPath } = req.body
  if (!name || !fsPath) return res.status(400).json({ error: 'Nombre y ruta requeridos' })
  if (!fs.existsSync(fsPath)) return res.status(400).json({ error: 'La ruta no existe en el sistema' })
  if (!fs.statSync(fsPath).isDirectory()) return res.status(400).json({ error: 'La ruta no es un directorio' })

  const linked = addLinkedDir(name, fsPath)
  res.json({ success: true, dir: linked })
})

router.get('/browse', (req, res) => {
  const fsPath = (req.query.path || '').toString().trim()

  if (!fsPath) {
    const roots = listRoots().map((root) => ({
      name: root.replace(/\\$/, ''),
      path: root,
    }))
    return res.json({
      path: '',
      parent: null,
      roots,
      dirs: [],
    })
  }

  if (!fs.existsSync(fsPath)) {
    return res.status(404).json({ error: 'La ruta no existe' })
  }

  let stat
  try {
    stat = fs.statSync(fsPath)
  } catch {
    return res.status(400).json({ error: 'No se pudo leer la ruta' })
  }

  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'La ruta no es un directorio' })
  }

  let dirs = []
  try {
    dirs = fs.readdirSync(fsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(fsPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  } catch {
    return res.status(403).json({ error: 'No tienes permisos para abrir esta carpeta' })
  }

  const normalized = path.normalize(fsPath)
  const root = path.parse(normalized).root
  const isRoot = normalized.toLowerCase() === root.toLowerCase()

  res.json({
    path: normalized,
    parent: isRoot ? null : path.dirname(normalized),
    roots: [],
    dirs,
  })
})

router.delete('/:id', (req, res) => {
  removeLinkedDir(req.params.id)
  res.json({ success: true })
})

router.get('/:id', (req, res) => {
  const dir = getLinkedDir(req.params.id)
  if (!dir) return res.status(404).json({ error: 'No encontrado' })
  res.json({ dir: { ...dir, exists: fs.existsSync(dir.path) } })
})

export default router
