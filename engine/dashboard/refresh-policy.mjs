// Separate GitHub REST source polling from same-origin scheduler-proof polling.
// A public browser may have only 60 unauthenticated GitHub API requests/hour;
// the previous 30-second source refresh could exceed that limit.
// Manual refresh still fetches both immediately. Neither feed proves a live worker.
export const GITHUB_SOURCE_POLL_MS=10*60*1000;
export const AUTOMATION_PROOF_POLL_MS=30*1000;
