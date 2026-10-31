// My Block isolated synthetic lab. No network, accounts, tracking, payments or signatures.
export const INVITE_CODE = 'demo-nova';
export const VERSION = 1;
export function freshState() {
  return {
    version: VERSION,
    creator: { slug: 'nova-vale', name: 'Nova Vale', tagline: 'A place to make things together.' },
    features: { posts: true, notes: true },
    licences: { name: true, image: false, likeness: false },
    members: [],
    stats: { visits: 24, joins: 0 },
    posts: [
      { id: 'p1', date: '2026-10-22T12:00:00Z', title: 'The first sketch', body: 'Every good idea starts with a conversation.' },
      { id: 'p2', date: '2026-10-27T15:00:00Z', title: 'Building in public', body: 'This block belongs to the people creating it.' }
    ]
  };
}
export function normalizeState(raw) {
  const base = freshState();
  if (!raw || raw.version !== VERSION || raw.creator?.slug !== base.creator.slug) return base;
  const members = Array.isArray(raw.members) && raw.members.includes('sample-member') ? ['sample-member'] : [];
  const flag = (record, key, fallback) => typeof record?.[key] === 'boolean' ? record[key] : fallback;
  return {
    ...base,
    features: Object.fromEntries(Object.entries(base.features).map(([key, fallback]) => [key, flag(raw.features, key, fallback)])),
    licences: Object.fromEntries(Object.entries(base.licences).map(([key, fallback]) => [key, flag(raw.licences, key, fallback)])),
    members,
    posts: (() => {
      const accepted = base.posts.slice();
      const ids = new Set(accepted.map(p => p.id));
      for (const p of Array.isArray(raw.posts) ? raw.posts : []) {
        if (accepted.length >= 20) break;
        if (!p || !/^post-[1-9][0-9]*$/.test(p.id) || ids.has(p.id)) continue;
        if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 100) continue;
        if (typeof p.body !== 'string' || !p.body.trim() || p.body.length > 600) continue;
        if (typeof p.date !== 'string' || !Number.isFinite(Date.parse(p.date))) continue;
        accepted.push({ id: p.id, title: p.title.trim(), body: p.body.trim(), date: new Date(p.date).toISOString() });
        ids.add(p.id);
      }
      return accepted;
    })(),
    stats: {
      visits: Number.isSafeInteger(raw.stats?.visits) && raw.stats.visits >= 0 ? Math.min(raw.stats.visits, 999999) : base.stats.visits,
      joins: members.length
    }
  };
}
export function toggleFeature(state, feature) {
  if (!Object.hasOwn(state.features, feature)) throw Error('Unknown feature');
  return { ...state, features: { ...state.features, [feature]: !state.features[feature] } };
}
export function toggleLicence(state, licence) {
  if (!Object.hasOwn(state.licences, licence)) throw Error('Unknown licence');
  return { ...state, licences: { ...state.licences, [licence]: !state.licences[licence] } };
}
export function joinBlock(state, inviteCode) {
  if (inviteCode !== INVITE_CODE) throw Error('Invite not recognized');
  if (state.members.includes('sample-member')) return state;
  return { ...state, members: ['sample-member'], stats: { ...state.stats, joins: 1 } };
}
export function memberAccess(state) {
  return { posts: state.features.posts, notes: state.features.notes, joined: state.members.includes('sample-member') };
}
export function chronologicalPosts(state) {
  return [...state.posts].sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
}
export function deedRecord(state) {
  return {
    issuer: 'My Block synthetic lab',
    status: 'UNSIGNED DEMO — not a legal instrument or blockchain record',
    creatorSlug: state.creator.slug,
    licences: { ...state.licences },
    version: state.version
  };
}
export function inviteUrl(locationLike) {
  const u = new URL(locationLike.href);
  u.search = '';
  u.searchParams.set('block', 'nova-vale');
  u.searchParams.set('invite', INVITE_CODE);
  u.searchParams.set('mode', 'visitor');
  return u.toString();
}

// Local-only creator publishing. No uploads, external requests, accounts or payment flows.
export function publishPost(state, draft, now = new Date().toISOString()) {
  const title = typeof draft?.title === 'string' ? draft.title.trim() : '';
  const body = typeof draft?.body === 'string' ? draft.body.trim() : '';
  if (!title || title.length > 100 || !body || body.length > 600) throw Error('Post must have a title (1–100) and body (1–600)');
  if (!Number.isFinite(Date.parse(now))) throw Error('Invalid publish time');
  if (state.posts.length >= 20) throw Error('Synthetic lab post limit reached');
  const ids = state.posts.map(p => /^post-(\d+)$/.exec(p.id)).filter(Boolean).map(m => Number(m[1]));
  const id = 'post-' + (Math.max(0, ...ids) + 1);
  return { ...state, posts: [...state.posts, { id, title, body, date: new Date(now).toISOString() }] };
}
