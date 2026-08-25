import CryptoJS from 'crypto-js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CONFIG_FILE = path.join(__dirname, '..', 'config', 'auth.json')
const SECRET_KEY = 'localpanelelp-secret-2024'

function loadConfig() {
  const configDir = path.join(__dirname, '..', 'config')
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      username: 'admin',
      password: CryptoJS.SHA256('admin').toString(),
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2))
    return defaultConfig
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
}

function generateToken(username) {
  const payload = { username, exp: Date.now() + 24 * 60 * 60 * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = CryptoJS.HmacSHA256(encoded, SECRET_KEY).toString()
  return `${encoded}.${signature}`
}

function verifyToken(token) {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  const expectedSig = CryptoJS.HmacSHA256(encoded, SECRET_KEY).toString()
  if (signature !== expectedSig) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  req.user = payload
  next()
}

export { loadConfig, generateToken, verifyToken, SECRET_KEY }
