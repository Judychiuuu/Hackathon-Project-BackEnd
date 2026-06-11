// ─── OPTIONAL LLM narrative agent ────────────────────────────────────────────
// Writes a 2–3 sentence exec summary from the COMPUTED snapshot (numbers only —
// no ticket bodies/PII). NEVER produces the health score. Fully optional: a
// no-op unless ENABLE_NARRATIVE=true and ANTHROPIC_API_KEY is set.
import { config } from '../config.js'

export async function generateNarrative(snapshot) {
  if (!config.narrative.enabled) return snapshot.sprint.narrative || ''

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: config.narrative.apiKey })

  // Build a numbers-only digest — explicitly strips titles/assignees.
  const digest = {
    sprint: {
      number: snapshot.sprint.number, totalShipped: snapshot.sprint.totalShipped,
      trend: snapshot.sprint.trend, activeBlockers: snapshot.sprint.activeBlockers,
      blockersPastSla: snapshot.sprint.blockersPastSla, infraAvgResponse: snapshot.sprint.infraAvgResponse,
    },
    teams: snapshot.teams.map(t => ({
      name: t.name, health: t.health, healthScore: t.healthScore,
      shipped: t.shipped, inFlight: t.inFlight, stalled: t.stalled,
      breaches: t.blockers.filter(b => b.escalate).map(b => ({ ticketId: b.ticketId, infraTicket: b.infraTicket, age: b.age })),
    })),
  }

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 220,
    messages: [{
      role: 'user',
      content:
        'You are an engineering chief-of-staff. Given this sprint snapshot JSON, write exactly 3 sentences: ' +
        '(1) what shipped and overall momentum, (2) the single biggest risk with the specific ticket IDs and hours, ' +
        '(3) the one escalation to make today. Be specific. Do NOT invent numbers not present.\n\n' +
        JSON.stringify(digest),
    }],
  })
  return (msg.content?.[0]?.text || '').trim()
}
