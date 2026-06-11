// ─── Sprint-level rollup + ceremonies ────────────────────────────────────────
import { config } from '../config.js'
import { parseClockToMinutes, nowMinutesInTz } from '../lib/time.js'

/** Aggregate scored teams + flattened blockers into the sprint summary row. */
export function computeSprint(teams, infraBlockers, kpi, prevTotalShipped) {
  const totalShipped = teams.reduce((s, t) => s + (t.shipped || 0), 0)
  const activeBlockers = infraBlockers.length
  const blockersPastSla = infraBlockers.filter(b => b.escalate).length
  const openInfraAges = infraBlockers.map(b => b.age).filter(n => Number.isFinite(n))
  const infraAvgResponse = openInfraAges.length
    ? Math.round(openInfraAges.reduce((a, b) => a + b, 0) / openInfraAges.length)
    : 0

  const prev = prevTotalShipped ?? teams.reduce((s, t) => s + (t.shippedPrev ?? t.shipped ?? 0), 0)
  const delta = totalShipped - prev
  const trend = `${delta >= 0 ? '+' : ''}${delta}`

  return {
    number: config.sprint.number,
    week: config.sprint.week,
    totalShipped,
    totalShippedPrev: prev,
    trend,
    activeBlockers,
    blockersPastSla,
    infraAvgResponse,
    achSuccessRate: kpi?.achSuccessRate ?? 98.4,
    narrative: '', // filled by narrative agent if enabled
  }
}

/** Derive today's ceremony list with done/next/upcoming state from standup times. */
export function computeCeremonies(teams) {
  const nowMin = nowMinutesInTz()
  const items = []
  for (const t of teams) {
    const mins = parseClockToMinutes(t.standup)
    if (mins == null) continue
    items.push({ name: `Daily Standup — ${t.name}`, team: t.id, time: clockLabel(t.standup), _min: mins })
  }
  // sort by time, mark the first future one "next", earlier "done", rest "upcoming"
  items.sort((a, b) => a._min - b._min)
  let markedNext = false
  for (const it of items) {
    if (it._min + 15 < nowMin) it.state = 'done'
    else if (!markedNext) { it.state = 'next'; markedNext = true }
    else it.state = 'upcoming'
    delete it._min
  }
  return items
}

const clockLabel = (s) => {
  const m = String(s).match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i)
  return m ? m[1].toUpperCase() : s
}
