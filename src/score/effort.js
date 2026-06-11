// ─── Effort vs Output (ROI bar) ──────────────────────────────────────────────
// effortScore (0..1) = shipped ÷ capacity consumed. Drives the ROI bar width
// and the "↑ Strong / → Good / ↓ Blocked / ↓↓ Critical" verdict label.
import { EFFORT_WEIGHTS as E } from './weights.js'

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

export function computeEffort(m) {
  const shipped = m.shipped || 0
  const inFlight = m.inFlight || 0
  const stalled = m.stalled || 0
  const shippedPrev = m.shippedPrev ?? shipped

  const capacityConsumed = shipped + E.WIP_WEIGHT * inFlight + E.STALL_DRAG * stalled
  const effortScore = clamp(shipped / Math.max(capacityConsumed, 1), 0, 1)

  const velocityDelta = (shipped - shippedPrev) / Math.max(shippedPrev, 1)
  let arrow = '→'
  if (effortScore < 0.3) arrow = '↓↓'
  else if (velocityDelta > 0.1) arrow = '↑'
  else if (velocityDelta < -0.1) arrow = '↓'

  let verdict = 'Critical'
  if (effortScore >= 0.8) verdict = 'Strong'
  else if (effortScore >= 0.6) verdict = 'Good'
  else if (effortScore >= 0.4) verdict = 'Blocked'

  // "shipped/total" ratio, e.g. "6/7"
  const total = shipped + inFlight
  const ratio = `${shipped}/${total || shipped}`
  const effortLabel = `${ratio} ${arrow} ${verdict}`

  return { effortScore: Math.round(effortScore * 100) / 100, effortLabel, verdict }
}
