import express from 'express'
import CryptoJS from 'crypto-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadConfig, generateToken, verifyToken } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'auth.json')

const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const config = loadConfig()
  const hashedPassword = CryptoJS.SHA256(password).toString()

  if (username === config.username && hashedPassword === config.password) {
    const token = generateToken(username)
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    })
    return res.json({ success: true, username })
  }

  return res.status(401).json({ error: 'Credenciales incorrectas' })
})

router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ success: true })
})

router.get('/check', (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.json({ authenticated: false })
  const payload = verifyToken(token)
  if (!payload) return res.json({ authenticated: false })
  res.json({ authenticated: true, username: payload.username })
})

router.post('/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body
  const config = loadConfig()
  const hashedCurrent = CryptoJS.SHA256(currentPassword).toString()

  if (hashedCurrent !== config.password) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' })
  }

  config.password = CryptoJS.SHA256(newPassword).toString()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  res.json({ success: true })
})

export default router
