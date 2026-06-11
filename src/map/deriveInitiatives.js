// ─── Initiatives / epics → progress bars (NEW) ───────────────────────────────
// progressPct = done children ÷ total children. Status compares actual progress
// to the expected pace given how far through the sprint we are.
import { config } from '../config.js'

/**
 * @param {Array} epics [{ id, teamId, name, doneChildren, totalChildren, blockedChildren }]
 * @returns initiatives with progressPct + status (on-track | at-risk | blocked)
 */
export function deriveInitiatives(epics = []) {
  const f = clamp(config.sprint.elapsedDays / Math.max(config.sprint.lengthDays, 1), 0, 1)
  const expectedPct = Math.round(f * 100)

  return epics.map(e => {
    const total = Math.max(e.totalChildren || 0, 0)
    const done = Math.max(e.doneChildren || 0, 0)
    const blocked = Math.max(e.blockedChildren || 0, 0)
    const progressPct = total > 0 ? Math.round((100 * done) / total) : 0

    let status = 'on-track'
    if (blocked > 0) status = 'blocked'
    else if (progressPct < expectedPct - 10) status = 'at-risk'

    return {
      id: e.id,
      teamId: e.teamId,
      name: e.name,
      progressPct,
      doneChildren: done,
      totalChildren: total,
      blockedChildren: blocked,
      status,
      expectedPct,
    }
  })
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
