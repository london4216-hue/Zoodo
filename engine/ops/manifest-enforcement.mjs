/**
 * Agent-wide manifest enforcement.
 * Checks timestamps, admission, and basic ledger consistency.
 * Local/simulated only. No live Hatchet/Inngest/Trigger.dev activation claimed.
 */
export function enforceManifest(manifest, now = Date.now()) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, reason: 'Missing or invalid manifest' };
  }
  const required = ['agent_id', 'timestamp', 'action', 'evidence_hash'];
  for (const key of required) {
    if (!(key in manifest)) {
      return { ok: false, reason: `Missing required field: ${key}` };
    }
  }
  const ts = Date.parse(manifest.timestamp);
  if (!Number.isFinite(ts) || ts > now + 60000) {
    return { ok: false, reason: 'Invalid or future timestamp' };
  }
  if (now - ts > 7 * 24 * 60 * 60 * 1000) {
    return { ok: false, reason: 'Timestamp older than 7 days (admission gate)' };
  }
  if (typeof manifest.evidence_hash !== 'string' || manifest.evidence_hash.length < 8) {
    return { ok: false, reason: 'Invalid evidence hash' };
  }
  return { ok: true, reason: 'Manifest passes basic enforcement', age_ms: now - ts };
}

export function enforceAll(manifests, now = Date.now()) {
  if (!Array.isArray(manifests)) return { ok: false, reason: 'Expected array of manifests' };
  const results = manifests.map(m => ({ manifest: m.agent_id, ...enforceManifest(m, now) }));
  const failed = results.filter(r => !r.ok);
  return {
    ok: failed.length === 0,
    total: results.length,
    failed: failed.length,
    results
  };
}
