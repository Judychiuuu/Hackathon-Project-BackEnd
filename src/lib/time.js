// ─── Time helpers ────────────────────────────────────────────────────────────
// All AGE math is done in UTC milliseconds. Only DISPLAY values (weekday names,
// ceremony "done/next/upcoming") are converted to the configured display TZ.
import { config } from '../config.js'

export const HOUR_MS = 3600_000

/** Whole hours between an ISO/Date and now (never negative). */
export function hoursSince(input, now = Date.now()) {
  if (!input) return 0
  const t = input instanceof Date ? input.getTime() : Date.parse(input)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now - t) / HOUR_MS))
}

export const daysSince = (input, now = Date.now()) =>
  Math.max(0, Math.floor(hoursSince(input, now) / 24))

/** Short weekday ("Mon".."Sun") in the display timezone. */
export function weekdayShort(input, tz = config.tzDisplay) {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(d)
}

/** Minutes-since-midnight "now" in the display timezone (for ceremony state). */
export function nowMinutesInTz(tz = config.tzDisplay, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).formatToParts(now)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return (h % 24) * 60 + m
}

/** Parse a "8:30 AM" / "9:00 AM EST" style time → minutes since midnight. */
export function parseClockToMinutes(str) {
  if (!str) return null
  const m = String(str).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + min
}
