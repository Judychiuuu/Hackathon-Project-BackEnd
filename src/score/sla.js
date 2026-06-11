// ─── SLA breach detection ────────────────────────────────────────────────────
// Infra cross-team response window is 24–32h. Past 32h = breach (escalate).
import { SLA } from './weights.js'

/** Classify a blocker age (hours) → { slaState, escalate }.
 *  ok | approaching | warning | breach
 */
export function classifySla(ageHours) {
  if (ageHours >= SLA.MAX) return { slaState: 'breach', escalate: true }
  if (ageHours >= SLA.MIN) return { slaState: 'warning', escalate: false }
  if (ageHours >= SLA.APPROACHING) return { slaState: 'approaching', escalate: false }
  return { slaState: 'ok', escalate: false }
}

/** UI color band for an age (matches dashboard .b-age red/amber). */
export function slaColor(ageHours) {
  const { slaState } = classifySla(ageHours)
  if (slaState === 'breach') return 'red'
  if (slaState === 'warning' || slaState === 'approaching') return 'amber'
  return 'normal'
}
