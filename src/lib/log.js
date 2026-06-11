// ─── PII-redacting logger ────────────────────────────────────────────────────
// Financial-data hygiene: we log Jira KEYS and COUNTS, never ticket bodies,
// assignee names, or anything that could carry PII. redact() scrubs common shapes.
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const AT_MENTION_RE = /@[\w.\-]+/g

export function redact(value) {
  if (value == null) return value
  if (typeof value === 'string') {
    return value.replace(EMAIL_RE, '[email]').replace(AT_MENTION_RE, '@[user]')
  }
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      // Drop fields that may carry free text / PII outright.
      if (/^(summary|title|description|assignee|pm|narrative|body|comment)/i.test(k)) {
        out[k] = typeof v === 'string' ? `[${k}:${v.length}c]` : '[redacted]'
      } else {
        out[k] = redact(v)
      }
    }
    return out
  }
  return value
}

const fmt = (args) =>
  args.map(a => (typeof a === 'object' ? JSON.stringify(redact(a)) : a)).join(' ')

export const log = {
  info: (...a) => console.log(`[${ts()}] [pulse]`, fmt(a)),
  warn: (...a) => console.warn(`[${ts()}] [pulse] WARN`, fmt(a)),
  error: (...a) => console.error(`[${ts()}] [pulse] ERR`, fmt(a)),
}
