// Public, sanitized design comparison; original and experimental lanes never merge.
export const REQUIRED_LANES = Object.freeze([
  'myblock-original', 'myblock-gold', 'yb3-original', 'yb3-gold',
  'prestige-baseline', 'prestige-gold'
]);
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
export function verifiedPreview(lane, now = Date.now()) {
  if (!lane || lane.state !== 'HOSTED_VERIFIED' || !lane.preview_url || !lane.verification) return null;
  const v = lane.verification;
  const at = Date.parse(v.checked_at || '');
  if (!Number.isFinite(at) || at > now || now - at > MAX_AGE_MS ||
      v.http_status !== 200 || v.expected_route_ok !== true ||
      !/^[a-f0-9]{40}$/.test(v.exact_commit_sha || '') ||
      v.deployed_commit_sha !== v.exact_commit_sha || v.checked_url !== lane.preview_url) return null;
  try {
    const u = new URL(lane.preview_url);
    if (u.protocol !== 'https:' || u.username || u.password ||
        !u.hostname.endsWith('.netlify.app')) return null;
    return u.href;
  } catch { return null; }
}
export function validateDesignFeed(feed) {
  if (!feed || feed.schema_version !== 1 || !Array.isArray(feed.lanes)) throw Error('invalid design feed');
  const ids = feed.lanes.map(x => x?.id);
  if (new Set(ids).size !== ids.length || REQUIRED_LANES.some(id => !ids.includes(id))) throw Error('missing or duplicate design lane');
  for (const lane of feed.lanes) {
    if (!lane.asset || !['ORIGINAL', 'EXPERIMENT', 'BASELINE'].includes(lane.kind) || !lane.issue_url) throw Error('invalid design lane');
    if ((lane.id.endsWith('original') && lane.kind !== 'ORIGINAL') ||
        (lane.id.endsWith('gold') && lane.kind !== 'EXPERIMENT')) throw Error('lane conflation');
    const issue = new URL(lane.issue_url);
    if (issue.protocol !== 'https:' || issue.hostname !== 'github.com' || !/^\/london4216-hue\/Zoodo\/issues\/\d+$/.test(issue.pathname)) throw Error('invalid issue source');
  }
  return feed.lanes;
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = String(text);
  if (className) el.className = className;
  return el;
}
export function mountDesignLanes(feed, target = document.body) {
  const lanes = validateDesignFeed(feed);
  const previous = document.getElementById('zooDesignLanes');
  if (previous) previous.remove();
  const section = node('section'); section.id = 'zooDesignLanes'; section.className = 'panel';
  section.setAttribute('aria-label', 'Original versus experimental design lanes');
  section.append(node('h2', 'ORIGINAL ASSETS / SEPARATE DESIGN EXPERIMENTS'));
  section.append(node('p', 'Original Figma fidelity is not interchangeable with a Gold Standard redesign. UNKNOWN means no verified deployment or measurement.', 'muted'));
  for (const lane of lanes) {
    const row = node('div', undefined, 'row');
    row.append(node('strong', `${lane.asset} · ${lane.kind === 'ORIGINAL' ? 'Figma original' : lane.kind === 'EXPERIMENT' ? 'SORA × ZOO Gold Standard experiment' : 'Existing baseline'}`));
    row.append(node('p', `${lane.state || 'UNKNOWN'} · source ${lane.source_state || 'UNKNOWN'} · functional parity ${lane.metrics?.functional_parity ?? 'UNKNOWN'} · accessibility ${lane.metrics?.accessibility ?? 'UNKNOWN'} · performance ${lane.metrics?.performance ?? 'UNKNOWN'}`, 'muted'));
    const url = verifiedPreview(lane);
    if (url) {
      const a = node('a', 'Verified working preview'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; row.append(a);
    } else row.append(node('span', 'Preview UNKNOWN — no independently verified live URL', 'warn'));
    const issue = node('a', ' · Source ticket'); issue.href = lane.issue_url; issue.rel = 'noopener noreferrer'; issue.target = '_blank'; row.append(issue);
    row.append(node('p', lane.next_action || 'Next action UNKNOWN', 'time'));
    section.append(row);
  }
  target.append(section);
  return section;
}
export async function refreshDesignLanes() {
  const response = await fetch('./design-lanes.json?read=' + Date.now(), {cache:'no-store'});
  if (!response.ok) throw Error('design feed HTTP ' + response.status);
  return mountDesignLanes(await response.json());
}
if (typeof document !== 'undefined') {
  const run = () => refreshDesignLanes().catch(error => {
    const old = document.getElementById('zooDesignLanes');
    if (old) old.setAttribute('data-feed-stale', 'true');
    else {
      const section = node('section'); section.id = 'zooDesignLanes'; section.className = 'panel';
      section.append(node('h2', 'DESIGN LANES · SOURCE FEED UNAVAILABLE'));
      section.append(node('p', String(error.message || error) + ' · No preview claimed verified.'));
      document.body.append(section);
    }
  });
  run(); setInterval(run, 60000);
}
