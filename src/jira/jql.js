// ─── JQL query builders ───────────────────────────────────────────────────────

/**
 * All non-epic tickets: open/in-progress + done in the last 28 days.
 * 28 days covers this sprint (14d) AND the previous one (14d) for velocity.
 */
export function allIssues(boardKey) {
  return (
    `project = ${boardKey} AND issuetype not in (Epic) AND ` +
    `(statusCategory != Done OR resolutiondate >= -28d) ` +
    `ORDER BY updated DESC`
  )
}

/** Active epics (not Done) — used to get epic names for initiative progress bars. */
export function activeEpics(boardKey) {
  return (
    `project = ${boardKey} AND issuetype = Epic AND ` +
    `statusCategory != Done ORDER BY updated DESC`
  )
}
