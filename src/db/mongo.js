// ─── MongoDB (OPTIONAL persistence) ──────────────────────────────────────────
// If MONGO_URI is set we persist raw issues + computed snapshots to Atlas.
// If not, every function is a graceful no-op so the server runs with zero setup.
import { config } from '../config.js'
import { log } from '../lib/log.js'

let client = null
let db = null

export async function connectMongo() {
  if (!config.mongo.enabled) {
    log.info('mongo: disabled (no MONGO_URI) — running in-memory')
    return null
  }
  try {
    const { MongoClient } = await import('mongodb')
    client = new MongoClient(config.mongo.uri, { serverSelectionTimeoutMS: 6000 })
    await client.connect()
    db = client.db(config.mongo.db)
    await ensureIndexes(db)
    log.info(`mongo: connected db=${config.mongo.db}`)
    return db
  } catch (err) {
    log.warn('mongo: connect failed — continuing in-memory:', err.message)
    client = null; db = null
    return null
  }
}

async function ensureIndexes(database) {
  await database.collection('raw_issues').createIndex({ teamId: 1, statusCategory: 1 }).catch(() => {})
  await database.collection('raw_issues').createIndex({ epicKey: 1 }).catch(() => {})
  // TTL: drop raw issues after 30 days to stay under the free 512MB cap.
  await database.collection('raw_issues').createIndex({ ingestedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }).catch(() => {})
  await database.collection('team_snapshots').createIndex({ sprintNumber: 1, teamId: 1, computedAt: -1 }).catch(() => {})
  await database.collection('sprint_snapshot').createIndex({ computedAt: -1 }).catch(() => {})
}

/** Persist a computed snapshot (split into team/sprint/initiative docs). No-op without Mongo. */
export async function persistSnapshot(snapshot) {
  if (!db) return
  const computedAt = new Date()
  const sprintNumber = snapshot.sprint.number
  const teamOps = snapshot.teams.map(t => ({
    insertOne: { document: { ...t, sprintNumber, computedAt, source: snapshot.source } },
  }))
  if (teamOps.length) await db.collection('team_snapshots').bulkWrite(teamOps, { ordered: false })
  await db.collection('sprint_snapshot').insertOne({ ...snapshot.sprint, sprintNumber, hash: snapshot.hash, source: snapshot.source, computedAt })
  if (snapshot.initiatives?.length) {
    const ops = snapshot.initiatives.map(i => ({
      updateOne: { filter: { _id: i.id }, update: { $set: { ...i, computedAt } }, upsert: true },
    }))
    await db.collection('initiatives').bulkWrite(ops, { ordered: false }).catch(() => {})
  }
}

/** Persist raw mapped issues (called by the Jira path). No-op without Mongo. */
export async function persistRawIssues(issues = []) {
  if (!db || !issues.length) return
  const ingestedAt = new Date()
  const ops = issues.map(i => ({
    updateOne: { filter: { _id: i.key }, update: { $set: { ...i, _id: i.key, ingestedAt } }, upsert: true },
  }))
  await db.collection('raw_issues').bulkWrite(ops, { ordered: false }).catch(err => log.warn('raw upsert:', err.message))
}

export async function closeMongo() {
  if (client) await client.close().catch(() => {})
}
