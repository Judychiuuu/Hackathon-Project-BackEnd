// ─── Vercel serverless handler ───────────────────────────────────────────────
// Vercel runs Node as stateless functions — no persistent process, no app.listen.
// This file exports the Express app as a request handler.
//
// Cold-start:  init() connects Mongo, loads seed.json, wires routes.
// Warm requests: the cached app promise is reused (no re-init).
// Cron:        node-cron is NOT used here; Vercel calls POST /api/ingest on its
//              own schedule (see vercel.json → "crons").
// SSE:         Works until Vercel's 30-second free-tier timeout; the dashboard
//              auto-falls back to 30-second polling if the stream drops.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from './config.js'
import { log } from './lib/log.js'
import { connectMongo, getLatestSnapshot } from './db/mongo.js'
import { createServer } from './server.js'
import { runIngest } from './ingest/runIngest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = join(__dirname, '..', 'data', 'seed.json')

let _appPromise = null

function getApp() {
  if (_appPromise) return _appPromise
  _appPromise = (async () => {
    log.info('─── Hive Pulse handler init (Vercel cold start) ───')
    log.info(`source=${config.dataSource}  mongo=${config.mongo.enabled ? 'enabled' : 'off'}`)
    await connectMongo()
    const { app, setSnapshot } = createServer({
      onManualIngest: async () => {
        const s = await runIngest()
        setSnapshot(s)
        return s
      },
    })
    // Bootstrap order: MongoDB latest → seed.json fallback → live ingest.
    // MongoDB survives across Vercel instances; seed.json is the static backstop.
    const mongoSnap = await getLatestSnapshot()
    if (mongoSnap) {
      setSnapshot(mongoSnap)
      log.info(`mongo snapshot loaded hash=${mongoSnap.hash} source=${mongoSnap.source}`)
    } else {
      try {
        const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'))
        setSnapshot(seed)
        log.info(`seed loaded hash=${seed.hash}`)
      } catch {
        try { const s = await runIngest(); setSnapshot(s) } catch (e) { log.warn('ingest on init failed:', e.message) }
      }
    }
    return app
  })().catch(err => {
    log.error('handler init failed:', err.message)
    _appPromise = null   // reset so next request retries init
    throw err
  })
  return _appPromise
}

export default async function handler(req, res) {
  const app = await getApp()
  app(req, res)
}
