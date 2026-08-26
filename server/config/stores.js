import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_DIR = path.join(__dirname, '..', 'config')
const LINKED_FILE = path.join(CONFIG_DIR, 'linked-dirs.json')
const BOTS_FILE = path.join(CONFIG_DIR, 'bots.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'panel-settings.json')

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })

function loadLinkedDirs() {
  if (!fs.existsSync(LINKED_FILE)) {
    fs.writeFileSync(LINKED_FILE, JSON.stringify([], null, 2))
    return []
  }
  return JSON.parse(fs.readFileSync(LINKED_FILE, 'utf-8'))
}

function saveLinkedDirs(dirs) {
  fs.writeFileSync(LINKED_FILE, JSON.stringify(dirs, null, 2))
}

export function addLinkedDir(name, fsPath) {
  const dirs = loadLinkedDirs()
  const id = crypto.randomBytes(8).toString('hex')
  dirs.push({ id, name, path: fsPath, addedAt: new Date().toISOString() })
  saveLinkedDirs(dirs)
  return { id, name, path: fsPath }
}

export function removeLinkedDir(id) {
  const dirs = loadLinkedDirs()
  const filtered = dirs.filter((d) => d.id !== id)
  saveLinkedDirs(filtered)
  return filtered
}

export function getLinkedDir(id) {
  const dirs = loadLinkedDirs()
  return dirs.find((d) => d.id === id)
}

export function listLinkedDirs() {
  return loadLinkedDirs()
}

export function loadBots() {
  if (!fs.existsSync(BOTS_FILE)) {
    fs.writeFileSync(BOTS_FILE, JSON.stringify([], null, 2))
    return []
  }
  return JSON.parse(fs.readFileSync(BOTS_FILE, 'utf-8'))
}

export function saveBots(bots) {
  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2))
}

export function addBot(bot) {
  const bots = loadBots()
  const id = crypto.randomBytes(8).toString('hex')
  const newBot = { id, ...bot, createdAt: new Date().toISOString() }
  bots.push(newBot)
  saveBots(bots)
  return newBot
}

export function updateBot(id, updates) {
  const bots = loadBots()
  const bot = bots.find((b) => b.id === id)
  if (!bot) return null
  Object.assign(bot, updates)
  saveBots(bots)
  return bot
}

export function removeBot(id) {
  const bots = loadBots()
  const filtered = bots.filter((b) => b.id !== id)
  saveBots(filtered)
  return filtered
}

export function getBot(id) {
  const bots = loadBots()
  return bots.find((b) => b.id === id)
}

const DEFAULT_SETTINGS = {
  executionMode: 'local',
}

export function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2))
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    return { ...DEFAULT_SETTINGS, ...data }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(updates) {
  const current = loadSettings()
  const next = { ...current, ...updates }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2))
  return next
}
