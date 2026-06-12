// ─── Static board → team metadata ────────────────────────────────────────────
// Dynamic fields (shipped, inFlight, stalled, blockers, tickets) are populated
// by fetchIssues.js. Only the non-Jira facts live here.

export const BOARDS = [
  {
    id: 'infra',
    boardKey: 'INFRA',
    name: 'Infrastructure',
    shortName: 'INFRA',
    board: 'INFRA Board · Azure',
    pm: 'Shwetha P. (DevOps)',
    systems: ['Azure', 'GitHub Actions', 'SQL Server', 'MongoDB'],
    color: '#F5A623',
    hexColor: 0xF5A623,
    isCenter: true,
    standup: 'Mon–Fri · 9:30 AM',
    sprintPlanning: 'Every other Monday · 1:30 PM',
    crossTeamLabels: [],
  },
  {
    id: 'lo',
    boardKey: 'LO',
    name: 'Lending Ops',
    shortName: 'LO',
    board: 'LO Board · HCM',
    pm: 'Shruthi Chanthati',
    systems: ['HCM (Hive Config Manager)', 'LMS (Loan Management System)'],
    color: '#F5A623',
    hexColor: 0xF5A623,
    isCenter: false,
    standup: 'Mon/Tue/Wed/Fri · 9:00 AM',
    sprintPlanning: 'Every Thursday · 10:00 AM',
    crossTeamLabels: ['LOX'],
  },
  {
    id: 'pay',
    boardKey: 'PAY',
    name: 'Payments',
    shortName: 'PAY',
    board: 'PAY Board · Explore Credit',
    pm: "Mike O'Leary",
    systems: ['Explore Credit', 'MoneyComb', 'USIO/NACHA ACH'],
    color: '#22C55E',
    hexColor: 0x22C55E,
    isCenter: false,
    standup: 'Mon–Wed · 8:30 AM',
    sprintPlanning: 'Every 2nd Friday · 8:30 AM',
    crossTeamLabels: ['PMX'],
  },
  {
    id: 'uw',
    boardKey: 'UL',
    name: 'UW / Lead Gen',
    shortName: 'UL',
    board: 'UL Board · VWF · UWDE',
    pm: 'Sanjana Umashankar',
    systems: ['VWF (Verification Workflow)', 'UWDE (Underwriting Data Engine)', 'Ping Tree'],
    color: '#EF4444',
    hexColor: 0xEF4444,
    isCenter: false,
    standup: 'Mon–Fri · 9:15 AM',
    sprintPlanning: 'Every 2nd Friday · 10:30 AM',
    crossTeamLabels: ['UWX', 'LGX'],
  },
  {
    id: 'analytics',
    boardKey: 'ANA',
    name: 'Analytics',
    shortName: 'ANA',
    board: 'MS Fabric · ExploreLMS',
    pm: 'Ben Lull (Principal Architect)',
    systems: ['MS Fabric', 'ExploreLMSReplica', 'Azure DevOps', 'SQL Server'],
    color: '#F5A623',
    hexColor: 0xF5A623,
    isCenter: false,
    standup: 'Mon–Fri · 9:00 AM EST',
    sprintPlanning: 'Every 2nd Thursday · 11:00 AM',
    crossTeamLabels: ['AKX'],
  },
]

// All cross-team blocking labels across every board
export const ALL_CROSS_LABELS = ['LOX', 'PMX', 'UWX', 'LGX', 'AKX']

export const BOARD_BY_KEY = Object.fromEntries(BOARDS.map(b => [b.boardKey, b]))
export const BOARD_BY_ID  = Object.fromEntries(BOARDS.map(b => [b.id, b]))
