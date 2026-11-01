// Sanitized, receipt-based worker feed for the existing ZOO dashboard.
// Reading a static JSON snapshot is NOT an authenticated worker heartbeat.
const STATES = new Set(['available', 'running', 'blocked', 'quota_exhausted', 'needs_owner_reactivation', 'unknown']);
const ISO = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const URL = s => typeof s === 'string' && /^https:\/\/[^\s]+$/.test(s);
const SHA = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
const text = (s, max=160) => typeof s === 'string' ? s.slice(0,max) : null;

export function normalizeAiderReceipt(raw) {
  if (!raw || raw.route !== 'local-ollama') throw Error('Not a local Aider receipt');
  const at = raw.finished_at ?? raw.started_at;
  if (!Number.isFinite(at) || at <= 0) throw Error('Receipt timestamp missing');
  const state = raw.status === 'RUNNING' ? 'running' : raw.status === 'BLOCKED' ? 'blocked' : 'unknown';
  return {
    worker_id: 'aider-local', provider: 'ollama-local', route: 'local-ollama',
    status: state, observed_at: new Date(at * 1000).toISOString(),
    last_result: ['TEST_PASSED','TEST_FAILED','BLOCKED','RUNNING','STARTING'].includes(raw.status) ? raw.status : 'UNKNOWN',
    model: text(raw.model,80), task_id: text(raw.task_id,100),
    test_exit: Number.isInteger(raw.test_exit) ? raw.test_exit : null,
    worker_exit: Number.isInteger(raw.worker_exit) ? raw.worker_exit : null,
    commit_sha: SHA(raw.commit_sha) ? raw.commit_sha : null,
    native_run_id: text(raw.native_run_id,120),
    receipt_url: URL(raw.receipt_url) ? raw.receipt_url : null,
    retry_count: Number.isSafeInteger(raw.retry_count) && raw.retry_count >= 0 ? raw.retry_count : null,
    // Never copy environment, task content, tokens, private paths or error messages.
  };
}

export function evaluateWorkerFeed(feed, now=Date.now(), maxAgeMs=15*60*1000) {
  const missing = reason => ({state:'UNKNOWN', reason, observed_at:null, workers:[]});
  if (feed?.schema_version !== 1 || feed?.source !== 'zoo-worker-receipts' || !ISO(feed.observed_at) || !Array.isArray(feed.workers))
    return missing('No valid published worker receipt feed');
  const observed = Date.parse(feed.observed_at);
  if (observed > now + 60000) return missing('Feed timestamp is in the future');
  if (feed.workers.length === 0) return missing('No worker receipts published');
  const stale = now - observed > maxAgeMs;
  const ids = new Set();
  const workers = [];
  for (const raw of feed.workers) {
    if (!raw || typeof raw.worker_id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(raw.worker_id) || ids.has(raw.worker_id))
      return missing('Malformed or duplicate worker identity');
    ids.add(raw.worker_id);
    const timestampOK = ISO(raw.observed_at) && Date.parse(raw.observed_at) <= now + 60000 && Date.parse(raw.observed_at) <= observed + 60000;
    const recent = timestampOK && now - Date.parse(raw.observed_at) <= maxAgeMs;
    const claimed = STATES.has(raw.status) ? raw.status : 'unknown';
    // A local receipt is not a provider-native authenticated invocation.
    const native = Boolean(URL(raw.receipt_url) && raw.native_run_id && recent);
    const state = stale || !recent || !native ? 'unknown' : claimed;
    workers.push({
      worker_id:raw.worker_id, provider:text(raw.provider), route:text(raw.route),
      state, reported_status:claimed, proof:native?'NATIVE_RECEIPT_REPORTED':'UNVERIFIED',
      observed_at:timestampOK?raw.observed_at:null, receipt_url:URL(raw.receipt_url)?raw.receipt_url:null,
      native_run_id:text(raw.native_run_id), task_id:text(raw.task_id), commit_sha:SHA(raw.commit_sha)?raw.commit_sha:null,
      test_exit:Number.isInteger(raw.test_exit)?raw.test_exit:null,
      retry_count:Number.isSafeInteger(raw.retry_count)&&raw.retry_count>=0?raw.retry_count:null,
      last_result:text(raw.last_result),
      refill_at:claimed==='quota_exhausted' && raw.refill_verified===true && ISO(raw.refill_at) && Date.parse(raw.refill_at)>now ? raw.refill_at : null,
    });
  }
  return {state:stale?'STALE':'RECEIPTS REPORTED',reason:stale?'Published worker feed is overdue':'Receipt claims require independent native readback',observed_at:feed.observed_at,workers};
}
