// ─── Ticket lifecycle chips ──────────────────────────────────────────────────
// Maps a Jira status name → canonical lifecycle index, then builds the chip
// row the dashboard renders (.lc-stage done|active|blocked|pending).
import { LIFECYCLE, STATUS_ALIASES } from '../score/weights.js'

/** Resolve any status string → canonical lifecycle index (0..9). */
export function stageIndexOf(stage = '') {
  const key = String(stage).toLowerCase().trim()
  if (key in STATUS_ALIASES) return STATUS_ALIASES[key]
  // loose contains-match fallback
  for (const [alias, idx] of Object.entries(STATUS_ALIASES)) {
    if (key.includes(alias)) return idx
  }
  return 0
}

/** Build the chip row for one ticket. Stages before current = done,
 *  current = active (or blocked), later = pending. */
export function buildStages(stage, blocked = false) {
  const cur = stageIndexOf(stage)
  return LIFECYCLE.map((label, i) => {
    let state = 'pending'
    if (i < cur) state = 'done'
    else if (i === cur) state = blocked ? 'blocked' : 'active'
    return { label, state }
  })
}

/** Turn a team's notable in-flight tickets into lifecycle rows for the panel. */
export function buildLifecycle(teams, limit = 3) {
  const rows = []
  for (const t of teams) {
    for (const tk of t.inFlightTickets || []) {
      rows.push({
        id: tk.id,
        teamId: t.id,
        title: tk.title,
        stage: tk.stage,
        stageIndex: stageIndexOf(tk.stage),
        days: tk.days,
        blocked: Boolean(tk.blocked),
        stages: buildStages(tk.stage, tk.blocked),
      })
    }
  }
  // Surface the most interesting first: blocked, then longest in WIP.
  rows.sort((a, b) => (Number(b.blocked) - Number(a.blocked)) || (b.days - a.days))
  return rows.slice(0, limit)
}
