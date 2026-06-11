// ─── runIngest — one ingest→score cycle, with mock fallback ──────────────────
import { config } from '../config.js'
import { log } from '../lib/log.js'
import { getMockIngest } from './mockSource.js'
import { buildSnapshot } from '../score/buildSnapshot.js'
import { generateNarrative } from '../narrative/llm.js'
import { persistSnapshot } from '../db/mongo.js'

/**
 * Pull → map → score → (narrative) → (persist). Always returns a complete
 * snapshot; on ANY failure of the live path it falls back to the mock so the
 * dashboard is never empty.
 */
export async function runIngest() {
  let ingest
  try {
    if (config.dataSource === 'jira') {
      const { getJiraIngest } = await import('../jira/fetchIssues.js')
      ingest = await getJiraIngest()
      if (!ingest?.teams?.length) throw new Error('jira returned no teams')
    } else {
      ingest = getMockIngest()
    }
  } catch (err) {
    log.warn('ingest: live path failed — falling back to mock:', err.message)
    ingest = getMockIngest()
    ingest.source = 'mock'
  }

  const snapshot = buildSnapshot(ingest)

  // Optional LLM narrative (numbers only; never blocks the pipeline).
  if (config.narrative.enabled) {
    try {
      snapshot.sprint.narrative = await generateNarrative(snapshot)
      snapshot.hash = snapshot.hash // narrative excluded from hash by design
    } catch (err) {
      log.warn('narrative skipped:', err.message)
    }
  }

  await persistSnapshot(snapshot).catch(err => log.warn('persist skipped:', err.message))

  log.info(`ingest ok — source=${snapshot.source} teams=${snapshot.teams.length} blockers=${snapshot.infraBlockers.length} hash=${snapshot.hash}`)
  return snapshot
}
