/**
 * Bounded independent Netlify host qualification. Does not use GitHub Actions.
 * A local test response or application-generated UUID is NOT provider-native proof.
 * Never log authorization tokens or private payloads.
 */
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const HOST = /^[a-z0-9-]+\.netlify\.app$/i;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const iso = (date) => date.toISOString();

export async function qualifyNetlifyHost({ endpoint, token, expectedSha, allowedHosts = [], fetchImpl = fetch,
  now = () => new Date(), nonce = randomBytes(18).toString('base64url'), timeoutMs = 8000 } = {}) {
  const start = now();
  const result = { schema_version: 1, task: 'zoo-independent-host-qualification',
    host: 'netlify', status: 'BLOCKED', host_execution_verified: false,
    runner_qualified: false, durable_queue_verified: false,
    provider_request_id: null, application_invocation_id: null,
    expected_source_sha: SHA.test(expectedSha ?? '') ? expectedSha : null,
    observed_source_sha: null, started_at: iso(start), completed_at: null,
    duration_ms: null, reason: null };
  const finish = (status, reason) => {
    result.status = status; result.reason = reason;
    const end = now(); result.completed_at = iso(end);
    result.duration_ms = Math.max(0, end.getTime() - start.getTime());
    return result;
  };
  let url;
  try { url = new URL(endpoint); } catch { return finish('BLOCKED', 'invalid_endpoint'); }
  if (url.protocol !== 'https:' || !HOST.test(url.hostname) || url.port || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/.netlify/functions/zoo-host-probe')
    return finish('BLOCKED', 'endpoint_not_allowlisted');
  // A generic *.netlify.app hostname is not a safe destination for a bearer token.
  if (!Array.isArray(allowedHosts) || !allowedHosts.some(h => typeof h === 'string' &&
      HOST.test(h) && h.toLowerCase() === url.hostname.toLowerCase()))
    return finish('BLOCKED', 'host_not_explicitly_allowlisted');
  if (typeof token !== 'string' || token.length < 32) return finish('BLOCKED', 'credential_unavailable');
  if (!SHA.test(expectedSha ?? '')) return finish('BLOCKED', 'expected_source_sha_missing');
  if (!NONCE.test(nonce)) return finish('BLOCKED', 'invalid_nonce');
  result.endpoint = url.toString();
  let response;
  try {
    response = await fetchImpl(result.endpoint, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'synthetic-hash', nonce }),
      redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    });
  } catch { return finish('RECOVERING', 'provider_request_failed_or_timed_out'); }
  // The provider response header is separately attributable; the body UUID is only application-generated.
  const nativeId = response.headers?.get?.('x-nf-request-id') ?? null;
  result.provider_request_id = typeof nativeId === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(nativeId) ? nativeId : null;
  if (response.status !== 200) return finish('RECOVERING', 'provider_http_' + response.status);
  let body;
  try { body = await response.json(); } catch { return finish('RECOVERING', 'invalid_provider_response_json'); }
  result.application_invocation_id = typeof body?.invocation_id === 'string' ? body.invocation_id : null;
  result.observed_source_sha = SHA.test(body?.source_commit_sha ?? '') ? body.source_commit_sha : null;
  const correctHash = sha256('zoo-host-probe-v1:' + nonce);
  if (body?.schema_version !== 1 || body?.execution_type !== 'synthetic-only' ||
      body?.provider_runtime !== 'netlify-functions-node' || body?.output_sha256 !== correctHash ||
      body?.durable_queue_verified !== false || body?.external_ai_invoked !== false)
    return finish('RECOVERING', 'invalid_synthetic_execution_result');
  if (result.observed_source_sha !== expectedSha)
    return finish('RECOVERING', 'source_sha_mismatch');
  if (!result.provider_request_id)
    return finish('UNKNOWN', 'provider_native_request_header_missing');
  result.host_execution_verified = true;
  return finish('HOST_PROBE_PASS', 'native_request_header_and_exact_sha_synthetic_execution_verified_only');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = await qualifyNetlifyHost({ endpoint: process.env.ZOO_HOST_PROBE_URL,
    token: process.env.ZOO_HOST_PROBE_TOKEN, expectedSha: process.env.ZOO_EXPECTED_SOURCE_SHA,
    allowedHosts: (process.env.ZOO_HOST_PROBE_ALLOWED_HOSTS ?? '').split(',').map(x => x.trim()).filter(Boolean) });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  if (receipt.status !== 'HOST_PROBE_PASS') process.exitCode = 2;
}
