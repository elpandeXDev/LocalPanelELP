import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import fileRoutes from './routes/files.js'
import minecraftRoutes from './routes/minecraft.js'
import botRoutes from './routes/bots.js'
import linkedRoutes from './routes/linked.js'
import { authMiddleware } from './middleware/auth.js'
import { stopAllBots, stopAllProcesses } from './processes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5173

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, '..', 'storage')))

app.use('/api/auth', authRoutes)
app.use('/api/files', authMiddleware, fileRoutes)
app.use('/api/minecraft', authMiddleware, minecraftRoutes)
app.use('/api/bots', authMiddleware, botRoutes)
app.use('/api/linked', authMiddleware, linkedRoutes)

if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
}

app.listen(PORT, () => {
  console.log(`\n  LocalPanelELP running at http://localhost:${PORT}\n`)
})

process.on('SIGINT', () => {
  stopAllProcesses()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopAllProcesses()
  process.exit(0)
})
