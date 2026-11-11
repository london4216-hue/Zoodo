// Count only GitHub commit timestamps within the past hour.
// A future-dated commit is not evidence of work completed in that hour.
// This is a source activity counter, not proof of a productive worker or deployment.
export function countRecentCommits(commits, now=Date.now()) {
  if (!Array.isArray(commits) || !Number.isFinite(now)) return 0;
  const windowMs=60*60*1000;
  return commits.filter(c=>{
    const date=c?.commit?.committer?.date;
    if (typeof date!=='string') return false;
    const time=Date.parse(date);
    return Number.isFinite(time) && time<=now && now-time<windowMs;
  }).length;
}
