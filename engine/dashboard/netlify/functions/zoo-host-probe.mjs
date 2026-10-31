/** Bounded Netlify runtime qualification only. No real tickets or credentials leave this function.
 * A provider-native HTTP receipt is required before claiming this host is operational. */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const SHA = /^[a-f0-9]{40}$/;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  body: JSON.stringify(body),
});
const equal = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function makeHostProbe({ token, commitRef = null, clock = () => new Date(), id = randomUUID } = {}) {
  return async (event) => {
    if (event?.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (typeof token !== 'string' || token.length < 32) return json(503, { error: 'probe_not_configured' });
    if (!equal(event.headers?.authorization ?? event.headers?.Authorization, `Bearer ${token}`))
      return json(401, { error: 'unauthorized' });
    if (typeof event.body !== 'string' || Buffer.byteLength(event.body) > 1024)
      return json(413, { error: 'invalid_payload' });
    let payload;
    try { payload = JSON.parse(event.body); } catch { return json(400, { error: 'invalid_json' }); }
    if (payload?.task !== 'synthetic-hash' || !NONCE.test(payload?.nonce ?? ''))
      return json(422, { error: 'invalid_task' });
    return json(200, {
      schema_version: 1,
      execution_type: 'synthetic-only',
      provider_runtime: 'netlify-functions-node',
      invocation_id: id(),
      observed_at: clock().toISOString(),
      source_commit_sha: SHA.test(commitRef ?? '') ? commitRef : null,
      output_sha256: createHash('sha256').update(`zoo-host-probe-v1:${payload.nonce}`).digest('hex'),
      durable_queue_verified: false,
      external_ai_invoked: false,
    });
  };
}

export const handler = makeHostProbe({ token: process.env.ZOO_HOST_PROBE_TOKEN, commitRef: process.env.COMMIT_REF });
