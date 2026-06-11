// ─── Entrypoint ──────────────────────────────────────────────────────────────
// Boot order: load config → connect Mongo (optional) → seed from disk (instant)
// → start Express → start poller (ingest on boot + cron) → push to SSE.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config, logConfigBanner } from './config.js'
import { log } from './lib/log.js'
import { connectMongo, closeMongo } from './db/mongo.js'
import { createServer } from './server.js'
import { startPoller } from './ingest/poller.js'
import { runIngest } from './ingest/runIngest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = join(__dirname, '..', 'data', 'seed.json')

async function main() {
  log.info('─── Hive Pulse server starting ───')
  logConfigBanner(log)

  await connectMongo()

  const { app, setSnapshot } = createServer({
    onManualIngest: async () => { const s = await runIngest(); setSnapshot(s); return s },
  })

  // Instant cold-boot data from a frozen seed (if present) so /api/snapshot
  // never 503s while the first live ingest runs.
  try {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'))
    setSnapshot(seed)
    log.info(`seed loaded (hash=${seed.hash})`)
  } catch { log.info('no seed.json — waiting for first ingest') }

  const server = app.listen(config.server.port, () => {
    log.info(`API listening on http://localhost:${config.server.port}`)
  })

  const stopPoller = startPoller(setSnapshot)

  const shutdown = async () => {
    log.info('shutting down…')
    stopPoller(); server.close(); await closeMongo(); process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => { log.error('fatal:', err.message); process.exit(1) })
