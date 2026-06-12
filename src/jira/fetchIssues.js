// ─── Jira ingest → internal team shape ───────────────────────────────────────
// Privacy: only `summary` (ticket titles) is stored. description and comments
// are never requested, stored, or forwarded to the browser or any LLM.
import { config } from '../config.js'
import { log } from '../lib/log.js'
import { searchAll, resolveCustomFields } from './client.js'
import { allIssues, activeEpics } from './jql.js'
import { BOARDS, ALL_CROSS_LABELS } from './boards.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STALL_HOURS = 72   // hours without update → stalled
const BREACH_HOURS = 32  // hours → SLA breach

// ─── helpers ─────────────────────────────────────────────────────────────────

function msAgo(isoDate) { return Date.now() - new Date(isoDate).getTime() }
function hoursAgo(isoDate) { return Math.floor(msAgo(isoDate) / 3_600_000) }
function daysAgo(isoDate)  { return Math.floor(msAgo(isoDate) / 86_400_000) }
function weekday(isoDate)  { return WEEKDAYS[new Date(isoDate).getDay()] }

function isDone(issue) {
  return issue.fields.status?.statusCategory?.key === 'done'
}

function hasCrossLabel(issue, labels) {
  const issueLabels = issue.fields.labels || []
  return labels.some(l => issueLabels.includes(l))
}

function hasAnyCrossLabel(issue) {
  return (issue.fields.labels || []).some(l => ALL_CROSS_LABELS.includes(l))
}

function isBlockedStatus(issue) {
  return /^(blocked|on hold)$/i.test(issue.fields.status?.name || '')
}

function getInfraLink(issue) {
  for (const link of issue.fields.issuelinks || []) {
    if (link.inwardIssue?.key?.startsWith('INFRA-'))  return link.inwardIssue.key
    if (link.outwardIssue?.key?.startsWith('INFRA-')) return link.outwardIssue.key
  }
  return null
}

function getCrossLabel(issue, boardCrossLabels) {
  const labels = issue.fields.labels || []
  return (
    labels.find(l => boardCrossLabels.includes(l)) ||
    labels.find(l => ALL_CROSS_LABELS.includes(l)) ||
    null
  )
}

function getEpicKey(issue, epicLinkField) {
  // Next-gen projects: parent IS the epic
  const parentKey = issue.fields.parent?.key
  if (parentKey) return parentKey
  // Classic projects: custom epicLink field
  if (epicLinkField && issue.fields[epicLinkField]) return issue.fields[epicLinkField]
  return null
}

function mapStatus(statusName = '') {
  const STATUS_MAP = {
    'To Do': 'Backlog', 'Backlog': 'Backlog', 'Open': 'In Dev',
    'In Progress': 'In Progress', 'In Development': 'In Dev', 'In Dev': 'In Dev',
    'Code Review': 'In Code Review', 'In Code Review': 'In Code Review', 'In Review': 'In Code Review',
    'Ready for QA': 'Ready for QA', 'In QA': 'In QA', 'QA': 'In QA', 'Testing': 'In QA',
    'Awaiting QA': 'Awaiting QA',
    'Ready to Deploy': 'Ready to Deploy', 'Ready for Deploy': 'Ready to Deploy',
    'Blocked': 'Blocked', 'On Hold': 'Blocked',
    'Analysis': 'Analysis Done', 'Analysis Done': 'Analysis Done',
    'Done': 'Done', 'Resolved': 'Done', 'Closed': 'Done',
  }
  return STATUS_MAP[statusName] || statusName
}

// ─── per-board builder ────────────────────────────────────────────────────────

const CUTOFF_14D = () => Date.now() - 14 * 86_400_000
const CUTOFF_28D = () => Date.now() - 28 * 86_400_000

function buildTeam(board, issues) {
  const cut14 = CUTOFF_14D(), cut28 = CUTOFF_28D()
  const { boardKey, crossTeamLabels, ...staticMeta } = board

  const shippedIssues = [], prevIssues = [], inflightIssues = []

  for (const issue of issues) {
    if (isDone(issue)) {
      const resolvedMs = issue.fields.resolutiondate
        ? new Date(issue.fields.resolutiondate).getTime() : 0
      if (resolvedMs >= cut14)       shippedIssues.push(issue)
      else if (resolvedMs >= cut28)  prevIssues.push(issue)
      // older than 28d → ignore
    } else {
      inflightIssues.push(issue)
    }
  }

  const blockers = []
  let stalledCount = 0

  for (const issue of inflightIssues) {
    const crossLabel   = getCrossLabel(issue, crossTeamLabels)
    const blocked      = isBlockedStatus(issue) || Boolean(crossLabel)
    const updatedHours = hoursAgo(issue.fields.updated)
    const stalled      = blocked || updatedHours >= STALL_HOURS

    if (stalled) stalledCount++

    if (blocked) {
      blockers.push({
        ticketId:    issue.key,
        infraTicket: getInfraLink(issue),
        assignee:    issue.fields.assignee?.displayName || 'Unassigned',
        age:         updatedHours,
        label:       crossLabel || 'blocked',
        description: issue.fields.summary,
        escalate:    updatedHours >= BREACH_HOURS,
      })
    }
  }

  return {
    ...staticMeta,
    shipped:    shippedIssues.length,
    shippedPrev: prevIssues.length,
    inFlight:   inflightIssues.length,
    stalled:    stalledCount,
    blockers,
    inFlightTickets: inflightIssues.map(i => ({
      id:      i.key,
      title:   i.fields.summary,
      stage:   mapStatus(i.fields.status?.name),
      days:    daysAgo(i.fields.updated),
      blocked: isBlockedStatus(i) || hasCrossLabel(i, crossTeamLabels),
    })),
    shippedTickets: shippedIssues.slice(0, 12).map(i => ({
      id:    i.key,
      title: i.fields.summary,
      day:   i.fields.resolutiondate ? weekday(i.fields.resolutiondate) : '—',
    })),
  }
}

// ─── epic initiative builder ──────────────────────────────────────────────────

function buildEpics(epicResults, allIssuesByBoard, epicLinkField) {
  // Index all fetched issues by their parent/epicLink key
  const childrenByEpic = {}
  for (const { issues } of allIssuesByBoard) {
    for (const issue of issues) {
      const epicKey = getEpicKey(issue, epicLinkField)
      if (!epicKey) continue
      if (!childrenByEpic[epicKey]) childrenByEpic[epicKey] = []
      childrenByEpic[epicKey].push(issue)
    }
  }

  const epics = []
  for (const { boardId, epicIssues } of epicResults) {
    for (const epic of epicIssues) {
      const children = childrenByEpic[epic.key] || []
      if (!children.length) continue  // no known children in the 28d window → skip

      const doneChildren    = children.filter(i => isDone(i)).length
      const blockedChildren = children.filter(i =>
        isBlockedStatus(i) || hasAnyCrossLabel(i)
      ).length

      epics.push({
        id:              epic.key,
        teamId:          boardId,
        name:            epic.fields.summary,
        doneChildren,
        totalChildren:   children.length,
        blockedChildren,
      })
    }
  }

  return epics
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function getJiraIngest() {
  const { epicLink: epicLinkField } = await resolveCustomFields()

  // Filter boards to those enabled in config
  const boards = BOARDS.filter(b => config.jira.boards.includes(b.boardKey))

  log.info(`jira: fetching ${boards.length} boards: ${boards.map(b => b.boardKey).join(', ')}`)

  // Parallel: fetch all issues + active epics per board
  const [issueResults, epicResults] = await Promise.all([
    Promise.all(boards.map(async board => {
      const issues = await searchAll(allIssues(board.boardKey))
      log.info(`jira: ${board.boardKey} → ${issues.length} issues`)
      return { board, issues }
    })),
    Promise.all(boards.map(async board => {
      const epicIssues = await searchAll(activeEpics(board.boardKey))
      return { boardId: board.id, epicIssues }
    })),
  ])

  const teams = issueResults.map(({ board, issues }) => buildTeam(board, issues))
  const epics = buildEpics(
    epicResults,
    issueResults.map(r => ({ issues: r.issues })),
    epicLinkField,
  )

  log.info(`jira: done — ${teams.length} teams, ${epics.length} initiatives`)

  return {
    source: 'jira',
    teams,
    epics,
    // achSuccessRate is a Payments processor KPI not in Jira; use env var or default
    kpi: { achSuccessRate: Number(process.env.ACH_SUCCESS_RATE) || 98.4 },
  }
}
