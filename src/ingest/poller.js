// ─── Poller — runs an ingest on boot + on a cron schedule ────────────────────
import cron from 'node-cron'
import { config } from '../config.js'
import { log } from '../lib/log.js'
import { runIngest } from './runIngest.js'

/**
 * @param {(snap:object)=>void} onSnapshot called with every fresh snapshot
 * @returns {() => void} stop function
 */
export function startPoller(onSnapshot) {
  const tick = async () => {
    try {
      const snap = await runIngest()
      onSnapshot(snap)
    } catch (err) {
      log.error('poll tick failed:', err.message)
    }
  }

  // Immediate first run so the dashboard has data instantly.
  tick()

  let task = null
  if (cron.validate(config.poll.cron)) {
    task = cron.schedule(config.poll.cron, tick)
    log.info(`poller scheduled "${config.poll.cron}"`)
  } else {
    log.warn(`invalid POLL_CRON "${config.poll.cron}" — running once only`)
  }
  return () => task?.stop()
}
