// ─── Express API + SSE ───────────────────────────────────────────────────────
import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { log } from './lib/log.js'
import { mongoStatus } from './db/mongo.js'

export function createServer({ onManualIngest }) {
  const app = express()
  app.use(express.json())
  // CORS_ORIGIN can be "*" or comma-separated URLs: "https://app.vercel.app,https://custom.com"
  const corsOrigin = config.server.corsOrigin === '*'
    ? '*'
    : [...config.server.corsOrigin.split(',').map(s => s.trim()).filter(Boolean), /^http:\/\/localhost:\d+$/]
  app.use(cors({ origin: corsOrigin, credentials: false }))

  // In-memory latest snapshot + connected SSE clients.
  let snapshot = null
  let lastIngestAt = null
  const clients = new Set()

  function setSnapshot(next) {
    const changed = !snapshot || snapshot.hash !== next.hash
    snapshot = next
    lastIngestAt = new Date().toISOString()
    if (changed) {
      const frame = `event: snapshot\ndata: ${JSON.stringify(next)}\n\n`
      for (const res of clients) res.write(frame)
      log.info(`snapshot pushed to ${clients.size} client(s) hash=${next.hash}`)
    }
  }
  const getSnapshot = () => snapshot

  // ── Routes ──
  app.get('/api/health', (_req, res) => {
    const ms = mongoStatus()
    res.json({ ok: true, source: snapshot?.source ?? config.dataSource, lastIngestAt, hash: snapshot?.hash ?? null, clients: clients.size, mongo: ms })
  })


  app.get('/api/snapshot', (_req, res) => {
    if (!snapshot) return res.status(503).json({ error: 'warming up' })
    res.json(snapshot)
  })

  app.get('/api/team/:id', (req, res) => {
    const team = snapshot?.teams.find(t => t.id === req.params.id)
    if (!team) return res.status(404).json({ error: 'team not found' })
    res.json(team)
  })

  app.post('/api/ingest', async (_req, res) => {
    try {
      const snap = await onManualIngest()
      res.json({ ok: true, hash: snap.hash, source: snap.source })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  })

  // Server-Sent Events — the "never sleeps" live feed.
  app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write('retry: 3000\n\n')
    if (snapshot) res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
    clients.add(res)
    log.info(`SSE client connected (${clients.size} total)`)

    const beat = setInterval(() => res.write(': ping\n\n'), 20_000)
    req.on('close', () => { clearInterval(beat); clients.delete(res) })
  })

  return { app, setSnapshot, getSnapshot }
}
