// Public, sanitized priority snapshot. This is NOT an authenticated live private-repo feed.
const validTime = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const https = x => { try { return new URL(x).protocol === 'https:'; } catch { return false; } };
export function evaluatePriorityFeed(feed, now = Date.now(), staleMs = 3600000) {
 if (feed?.schema_version !== 1 || !Array.isArray(feed.rows)) throw Error('Invalid priority feed');
 const sourceAgeMs = validTime(feed.source_observed_at) ? Math.max(0, now - Date.parse(feed.source_observed_at)) : null;
 return {
  sourceAgeMs, sourceStale: sourceAgeMs === null || sourceAgeMs > staleMs,
  rows: feed.rows.map(r => {
   if (!r.id || !https(r.source_url)) throw Error('Priority row needs a source URL');
   const meaningfulAgeMs = validTime(r.last_verified_meaningful_at)
    ? Math.max(0, now - Date.parse(r.last_verified_meaningful_at)) : null;
   const landingVerified = validTime(r.landing_verified_at) && https(r.verified_live_url);
   return {...r, meaningfulAgeMs,
    stale: meaningfulAgeMs === null || meaningfulAgeMs > staleMs,
    verified_live_url: landingVerified ? r.verified_live_url : null,
    evidence_label: meaningfulAgeMs === null ? 'NO VERIFIED MOVEMENT' :
     meaningfulAgeMs > staleMs ? 'STALE VERIFIED MOVEMENT' : 'VERIFIED MOVEMENT RECENT'};
  })
 };
}
export function renderPriorityFeed(target, feed, now = Date.now()) {
 const evaluated = evaluatePriorityFeed(feed, now);
 target.replaceChildren();
 const meta = document.createElement('p');
 meta.className = 'time';
 meta.textContent = 'GitHub snapshot: ' + (feed.source_observed_at || 'UNKNOWN') +
  ' · Source feed ' + (evaluated.sourceStale ? 'STALE' : 'RECENT') +
  ' · Not proof of live Netlify deployment';
 target.append(meta);
 for (const r of evaluated.rows) {
  const row = document.createElement('div'); row.className = 'row';
  const strong = document.createElement('strong'); strong.textContent = r.title;
  const line = document.createElement('div'); line.className = 'time';
  line.textContent = r.evidence_label + ' · Stage ' + r.stage +
   ' · Worker ' + (r.worker || 'UNKNOWN') +
   ' · Exact SHA ' + (r.commit_sha || 'UNKNOWN') +
   ' · Tests ' + (r.tests || 'UNKNOWN');
  const next = document.createElement('div'); next.textContent = r.next_action;
  const source = document.createElement('a'); source.href = r.source_url;
  source.target = '_blank'; source.rel = 'noopener'; source.textContent = 'Source evidence';
  row.append(strong,line,next,source);
  if (r.verified_live_url) {
   const live = document.createElement('a'); live.href = r.verified_live_url;
   live.target = '_blank'; live.rel = 'noopener'; live.textContent = ' · Verified live UI';
   row.append(live);
  }
  target.append(row);
 }
 return evaluated;
}
export async function refreshPriorityFeed(target, fetchImpl = fetch) {
 try {
  const res = await fetchImpl('./priority-feed.json', {cache:'no-store'});
  if (!res.ok) throw Error('HTTP '+res.status);
  return renderPriorityFeed(target, await res.json());
 } catch {
  target.textContent = 'Priority evidence unavailable. Existing source tickets remain open; no green status inferred.';
  return null;
 }
}
