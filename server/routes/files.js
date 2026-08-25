import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import multer from 'multer'
import AdmZip from 'adm-zip'
import * as tar from 'tar'
import { getLinkedDir } from '../config/stores.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage')

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

const router = express.Router()

const EDITABLE_EXTS = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss',
  '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.rs', '.sh', '.bat',
  '.ps1', '.yml', '.yaml', '.xml', '.toml', '.ini', '.cfg', '.conf', '.properties',
  '.env', '.gitignore', '.sql', '.vue', '.svelte', '.gradle', '.csv',
  '.log', '.lang', '.mcmeta', '.motd',
])

const MAX_EDIT_SIZE = 5 * 1024 * 1024

function getBaseDir(mountId) {
  if (!mountId || mountId === 'internal') return STORAGE_DIR
  const linked = getLinkedDir(mountId)
  if (!linked) return null
  return linked.path
}

const BINARY_EXTS = new Set([
  '.exe', '.msi', '.dll', '.so', '.dylib', '.bin',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.tiff', '.heic',
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jar', '.class', '.war', '.ear',
  '.pyc', '.pyo', '.o', '.obj', '.a', '.lib',
  '.dat', '.db', '.sqlite', '.db3',
])

function isEditable(filename) {
  const ext = path.extname(filename).toLowerCase()
  if (BINARY_EXTS.has(ext)) return false
  return true
}

function multerStorage(mountId) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = req.body.directory || ''
      const base = getBaseDir(req.body.mount || mountId) || STORAGE_DIR
      const targetDir = path.join(base, dir)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      cb(null, targetDir)
    },
    filename: (req, file, cb) => {
      const dir = req.body.directory || ''
      const base = getBaseDir(req.body.mount || mountId) || STORAGE_DIR
      const targetPath = path.join(base, dir, file.originalname)
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(file.originalname)
        const baseName = path.basename(file.originalname, ext)
        let counter = 1
        let newName = `${baseName} (${counter})${ext}`
        while (fs.existsSync(path.join(base, dir, newName))) {
          counter++
          newName = `${baseName} (${counter})${ext}`
        }
        return cb(null, newName)
      }
      cb(null, file.originalname)
    },
  })
}

function safeJoin(base, target) {
  const targetPath = path.resolve(base, target)
  if (!targetPath.startsWith(path.resolve(base))) {
    return null
  }
  return targetPath
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`
}

function getFileIcon(name, isDir) {
  if (isDir) return 'folder'
  const ext = path.extname(name).toLowerCase()
  const types = {
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.bmp': 'image', '.webp': 'image', '.svg': 'image', '.ico': 'image',
    '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video', '.wmv': 'video', '.flv': 'video', '.webm': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.ogg': 'audio', '.m4a': 'audio',
    '.pdf': 'pdf',
    '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive', '.gz': 'archive',
    '.doc': 'document', '.docx': 'document', '.odt': 'document',
    '.xls': 'spreadsheet', '.xlsx': 'spreadsheet', '.ods': 'spreadsheet', '.csv': 'spreadsheet',
    '.ppt': 'presentation', '.pptx': 'presentation',
    '.js': 'code', '.jsx': 'code', '.ts': 'code', '.tsx': 'code', '.html': 'code', '.css': 'code', '.json': 'code', '.xml': 'code', '.py': 'code', '.java': 'code', '.c': 'code', '.cpp': 'code', '.cs': 'code', '.php': 'code', '.rb': 'code', '.go': 'code', '.rs': 'code', '.sh': 'code', '.bat': 'code', '.ps1': 'code',
    '.txt': 'text', '.md': 'text', '.log': 'text',
    '.exe': 'executable', '.msi': 'executable', '.dmg': 'executable', '.deb': 'executable', '.rpm': 'executable', '.app': 'executable',
    '.jar': 'java', '.yml': 'config', '.yaml': 'config', '.toml': 'config', '.ini': 'config', '.cfg': 'config', '.conf': 'config', '.properties': 'config', '.env': 'config',
  }
  return types[ext] || 'file'
}

function listDirectory(dirPath, relativePath) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  return items
    .filter((item) => !item.name.startsWith('.'))
    .map((item) => {
      const fullPath = path.join(dirPath, item.name)
      const stat = fs.statSync(fullPath)
      return {
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        size: item.isDirectory() ? null : stat.size,
        sizeFormatted: item.isDirectory() ? '-' : formatBytes(stat.size),
        modified: stat.mtime,
        icon: getFileIcon(item.name, item.isDirectory()),
        path: path.join(relativePath, item.name).replace(/\\/g, '/'),
        editable: !item.isDirectory() && isEditable(item.name) && stat.size < MAX_EDIT_SIZE,
        isArchive: !item.isDirectory() && isArchive(item.name),
      }
    })
    .sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
}

function getDirSize(dirPath) {
  let total = 0
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      total += getDirSize(fullPath)
    } else {
      const stat = fs.statSync(fullPath)
      total += stat.size
    }
  }
  return total
}

function countItems(dirPath) {
  let files = 0
  let folders = 0
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const item of items) {
    if (item.isDirectory()) {
      folders++
      const sub = countItems(path.join(dirPath, item.name))
      files += sub.files
      folders += sub.folders
    } else {
      files++
    }
  }
  return { files, folders }
}

router.get('/list', (req, res) => {
  const mount = (req.query.mount || 'internal').toString()
  const dir = (req.query.path || '').toString()
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, dir)
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Directorio no encontrado' })
  }
  try {
    const items = listDirectory(targetPath, dir)
    res.json({ items, path: dir, mount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/upload', (req, res) => {
  const mount = req.body.mount || 'internal'
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })

  const dynamicUpload = multer({
    storage: multerStorage(mount),
    limits: { fileSize: 1024 * 1024 * 1024 * 10 },
  })

  dynamicUpload.array('files', 100)(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message })
    const files = req.files || []
    res.json({
      success: true,
      uploaded: files.map((f) => ({ name: f.originalname, size: f.size })),
    })
  })
})

router.get('/download', (req, res) => {
  const mount = (req.query.mount || 'internal').toString()
  const filePath = (req.query.path || '').toString()
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, filePath)
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'No se puede descargar un directorio' })
  }
  res.download(targetPath)
})

router.post('/mkdir', (req, res) => {
  const { name, directory = '', mount = 'internal' } = req.body
  if (!name) return res.status(400).json({ error: 'Nombre requerido' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, path.join(directory, name))
  if (!targetPath) return res.status(400).json({ error: 'Ruta invalida' })
  if (fs.existsSync(targetPath)) {
    return res.status(409).json({ error: 'Ya existe' })
  }
  fs.mkdirSync(targetPath, { recursive: true })
  res.json({ success: true })
})

router.post('/rename', (req, res) => {
  const { oldPath, newName, mount = 'internal' } = req.body
  if (!oldPath || !newName) return res.status(400).json({ error: 'Parametros requeridos' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const oldFullPath = safeJoin(base, oldPath)
  if (!oldFullPath || !fs.existsSync(oldFullPath)) {
    return res.status(404).json({ error: 'No encontrado' })
  }
  const dir = path.dirname(oldFullPath)
  const newFullPath = path.join(dir, newName)
  if (fs.existsSync(newFullPath)) {
    return res.status(409).json({ error: 'Ya existe un archivo con ese nombre' })
  }
  fs.renameSync(oldFullPath, newFullPath)
  res.json({ success: true })
})

router.post('/delete', (req, res) => {
  const { path: itemPath, mount = 'internal' } = req.body
  if (!itemPath) return res.status(400).json({ error: 'Ruta requerida' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, itemPath)
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'No encontrado' })
  }
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true })
  } else {
    fs.unlinkSync(targetPath)
  }
  res.json({ success: true })
})

router.post('/move', (req, res) => {
  const { source, destination, mount = 'internal' } = req.body
  if (!source || !destination) return res.status(400).json({ error: 'Parametros requeridos' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const srcPath = safeJoin(base, source)
  const destPath = safeJoin(base, path.join(destination, path.basename(source)))
  if (!srcPath || !fs.existsSync(srcPath)) {
    return res.status(404).json({ error: 'Origen no encontrado' })
  }
  if (fs.existsSync(destPath)) {
    return res.status(409).json({ error: 'Destino ya existe' })
  }
  const destDir = path.dirname(destPath)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  fs.renameSync(srcPath, destPath)
  res.json({ success: true })
})

router.get('/stats', (req, res) => {
  try {
    const totalSize = getDirSize(STORAGE_DIR)
    const counts = countItems(STORAGE_DIR)
    res.json({
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      totalFiles: counts.files,
      totalFolders: counts.folders,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/search', (req, res) => {
  const query = (req.query.q || '').toString().toLowerCase()
  const mount = (req.query.mount || 'internal').toString()
  if (!query) return res.json({ results: [] })

  const base = getBaseDir(mount)
  if (!base) return res.json({ results: [] })

  function searchDir(dirPath, relativePath, results, maxDepth = 5) {
    if (maxDepth <= 0 || results.length >= 100) return
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const item of items) {
      if (results.length >= 100) break
      if (item.name.toLowerCase().includes(query)) {
        results.push({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(relativePath, item.name).replace(/\\/g, '/'),
          icon: getFileIcon(item.name, item.isDirectory()),
        })
      }
      if (item.isDirectory()) {
        searchDir(path.join(dirPath, item.name), path.join(relativePath, item.name), results, maxDepth - 1)
      }
    }
  }

  try {
    const results = []
    searchDir(base, '', results)
    res.json({ results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/read', (req, res) => {
  const mount = (req.query.mount || 'internal').toString()
  const filePath = (req.query.path || '').toString()
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, filePath)
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'Es un directorio' })
  }
  if (stat.size > MAX_EDIT_SIZE) {
    return res.status(400).json({ error: `Archivo demasiado grande (max ${formatBytes(MAX_EDIT_SIZE)})` })
  }
  try {
    const content = fs.readFileSync(targetPath, 'utf-8')
    res.json({
      content,
      path: filePath,
      mount,
      name: path.basename(filePath),
      size: stat.size,
      editable: isEditable(path.basename(filePath)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/save', (req, res) => {
  const { path: filePath, content, mount = 'internal' } = req.body
  if (!filePath) return res.status(400).json({ error: 'Ruta requerida' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, filePath)
  if (!targetPath) return res.status(400).json({ error: 'Ruta invalida' })
  try {
    fs.writeFileSync(targetPath, content, 'utf-8')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/create-file', (req, res) => {
  const { name, directory = '', mount = 'internal' } = req.body
  if (!name) return res.status(400).json({ error: 'Nombre requerido' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, path.join(directory, name))
  if (!targetPath) return res.status(400).json({ error: 'Ruta invalida' })
  if (fs.existsSync(targetPath)) {
    return res.status(409).json({ error: 'Ya existe' })
  }
  const dir = path.dirname(targetPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(targetPath, '', 'utf-8')
  res.json({ success: true })
})

const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.bz2'])

function isArchive(filename) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.tar.gz')) return true
  if (lower.endsWith('.tar.bz2')) return true
  const ext = path.extname(lower)
  return ARCHIVE_EXTS.has(ext)
}

function getArchiveBaseName(filename) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.tar.gz')) return path.basename(filename, '.tar.gz').replace(/\.tar\.gz$/i, '') || filename
  if (lower.endsWith('.tar.bz2')) return path.basename(filename, '.tar.bz2').replace(/\.tar\.bz2$/i, '') || filename
  const ext = path.extname(lower)
  return path.basename(filename, ext)
}

router.post('/extract', async (req, res) => {
  const { path: archivePath, mount = 'internal', destination } = req.body
  if (!archivePath) return res.status(400).json({ error: 'Ruta requerida' })
  const base = getBaseDir(mount)
  if (!base) return res.status(404).json({ error: 'Montaje no encontrado' })
  const targetPath = safeJoin(base, archivePath)
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'No se puede extraer un directorio' })
  }
  if (!isArchive(path.basename(targetPath))) {
    return res.status(400).json({ error: 'Formato no soportado. Formatos validos: .zip, .tar, .tar.gz, .tgz, .rar, .7z, .gz' })
  }

  const lowerName = path.basename(targetPath).toLowerCase()
  const archiveDir = path.dirname(targetPath)
  const cleanName = getArchiveBaseName(path.basename(targetPath))
  const destDir = destination ? safeJoin(base, destination) : archiveDir
  if (!destDir) return res.status(400).json({ error: 'Destino invalido' })
  const extractDir = path.join(destDir, cleanName)

  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true })
  }
  fs.mkdirSync(extractDir, { recursive: true })

  try {
    if (lowerName.endsWith('.zip')) {
      const zip = new AdmZip(targetPath)
      zip.extractAllTo(extractDir, true)
    } else if (lowerName.endsWith('.tar') || lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) {
      await tar.x({ file: targetPath, cwd: extractDir, strip: 0 })
    } else if (lowerName.endsWith('.gz') && !lowerName.endsWith('.tar.gz')) {
      const zlib = await import('zlib')
      const compressed = fs.readFileSync(targetPath)
      const decompressed = zlib.gunzipSync(compressed)
      const outputName = path.basename(targetPath, path.extname(targetPath))
      fs.writeFileSync(path.join(extractDir, outputName), decompressed)
    } else if (lowerName.endsWith('.rar')) {
      let extracted = false
      try {
        execSync(`unrar x -o+ "${targetPath}" "${extractDir}\\"`, { stdio: 'pipe', timeout: 120000 })
        extracted = true
      } catch {}
      if (!extracted) {
        try {
          execSync(`7z x -o"${extractDir}" -y "${targetPath}"`, { stdio: 'pipe', timeout: 120000 })
          extracted = true
        } catch {}
      }
      if (!extracted) {
        fs.rmSync(extractDir, { recursive: true })
        return res.status(500).json({ error: 'No se pudo extraer RAR. Instala WinRAR o 7-Zip en el sistema.' })
      }
    } else if (lowerName.endsWith('.7z')) {
      try {
        execSync(`7z x -o"${extractDir}" -y "${targetPath}"`, { stdio: 'pipe', timeout: 120000 })
      } catch {
        fs.rmSync(extractDir, { recursive: true })
        return res.status(500).json({ error: 'No se pudo extraer 7z. Instala 7-Zip en el sistema.' })
      }
    } else if (lowerName.endsWith('.tar.bz2') || lowerName.endsWith('.bz2')) {
      await tar.x({ file: targetPath, cwd: extractDir, strip: 0 })
    } else {
      fs.rmSync(extractDir, { recursive: true })
      return res.status(400).json({ error: 'Formato no soportado' })
    }

    const relativeExtractPath = path.relative(base, extractDir).replace(/\\/g, '/')
    res.json({ success: true, extractedTo: relativeExtractPath })
  } catch (err) {
    try { fs.rmSync(extractDir, { recursive: true }) } catch {}
    res.status(500).json({ error: `Error al extraer: ${err.message}` })
  }
})

export default router
