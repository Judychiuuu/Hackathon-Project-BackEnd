// ─── writeSeed — build the snapshot from mock data, verify, freeze to disk ───
// Run with `npm run seed`. Does three things:
//   1. Builds the deterministic snapshot from the mock source.
//   2. Prints the computed scores so we can eyeball them against the §4 design.
//   3. Writes data/seed.json — the instant cold-boot snapshot index.js loads.
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getMockIngest } from '../ingest/mockSource.js'
import { buildSnapshot } from '../score/buildSnapshot.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const SEED_PATH = join(DATA_DIR, 'seed.json')

const snap = buildSnapshot(getMockIngest())

// ── Verification table ──
const pad = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)
console.log('\n─── Computed team health (from mock ingest) ───')
console.log(`${pad('TEAM', 16)} ${padL('SCORE', 5)}  ${pad('HEALTH', 9)} ${padL('SHIP', 4)} ${padL('WIP', 4)} ${padL('STALL', 5)} ${padL('BLK', 3)} ${pad('  EFFORT', 18)}`)
for (const t of snap.teams) {
  console.log(
    `${pad(t.name, 16)} ${padL(t.healthScore, 5)}  ${pad(t.health, 9)} ${padL(t.shipped, 4)} ${padL(t.inFlight, 4)} ${padL(t.stalled, 5)} ${padL(t.blockers.length, 3)}   ${pad(t.effortLabel, 16)}`
  )
}

console.log('\n─── Sprint rollup ───')
const s = snap.sprint
console.log(`Sprint ${s.number} · ${s.week}`)
console.log(`  shipped=${s.totalShipped} (${s.trend} vs ${s.totalShippedPrev})  activeBlockers=${s.activeBlockers}  pastSLA=${s.blockersPastSla}  infraAvg=${s.infraAvgResponse}h  ach=${s.achSuccessRate}%`)

console.log('\n─── Cross-team blockers (sorted by age) ───')
for (const b of snap.infraBlockers) {
  console.log(`  ${pad(b.ticketId, 10)} → ${pad(b.infraTicket, 11)} ${padL(b.age + 'h', 4)}  ${pad(b.slaState, 11)} ${b.escalate ? 'ESCALATE' : ''}`)
}

console.log('\n─── Initiatives ───')
for (const i of snap.initiatives) {
  console.log(`  ${pad(i.name, 30)} ${padL(i.progressPct + '%', 5)}  ${pad(i.status, 10)} (${i.doneChildren}/${i.totalChildren}${i.blockedChildren ? `, ${i.blockedChildren} blocked` : ''})`)
}

console.log(`\n─── Ticker (${snap.ticker.length} items) ───`)
for (const line of snap.ticker) console.log(`  • ${line}`)

// ── Freeze to disk ──
await mkdir(DATA_DIR, { recursive: true })
await writeFile(SEED_PATH, JSON.stringify(snap, null, 2) + '\n', 'utf8')
console.log(`\n✓ seed written → ${SEED_PATH}`)
console.log(`  source=${snap.source}  hash=${snap.hash}  teams=${snap.teams.length}  bytes=${JSON.stringify(snap).length}\n`)
