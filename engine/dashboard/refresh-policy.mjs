// Separate browser polling of authenticated scheduler snapshots from unauthenticated
// GitHub REST source queries. 5-6 GitHub calls every 30s exhausted the shared
// 60-request/hour unauthenticated GitHub API budget and produced false UNKNOWNs.
// Proof snapshots are static same-origin files, not GitHub API calls.
export const GITHUB_SOURCE_POLL_MS=10*60*1000;
export const AUTOMATION_PROOF_POLL_MS=30*1000;
