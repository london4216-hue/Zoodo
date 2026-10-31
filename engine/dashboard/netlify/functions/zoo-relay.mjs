/** Netlify HTTP adapter for the private ZOO relay.
 * Stateless invocation; durable leases and completion receipts are held in Supabase.
 * Source-only until a provider-native deployment and two-ticket probe exist.
 */
import { makeStore, makeRelay, makeHandler } from '../../../ops/relay/portable-relay.mjs';

const reply = (statusCode, error) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  body: JSON.stringify({ error }),
});

export function makeNetlifyRelayHandler({
  env = process.env,
  storeFactory = makeStore,
  relayFactory = makeRelay,
  handlerFactory = makeHandler,
} = {}) {
  return async (event) => {
    if (!event || event.isBase64Encoded || typeof event.httpMethod !== 'string')
      return reply(400, 'unsupported_request');
    if (event.httpMethod !== 'POST') return reply(405, 'method_not_allowed');

    // Preserve existing Netlify environment variable names and fail closed.
    const origin = env.ZOO_SUPABASE_URL;
    const serviceRoleKey = env.ZOO_SUPABASE_SERVICE_ROLE_KEY;
    const callbackSecret = env.ZOO_CALLBACK_SECRET;
    const routes = env.ZOO_WORKERS_JSON;
    if (![origin, serviceRoleKey, callbackSecret, routes].every(x => typeof x === 'string' && x.length))
      return reply(503, 'relay_not_configured');

    try {
      const workers = JSON.parse(routes);
      if (!Array.isArray(workers) || workers.length < 1 || workers.length > 16)
        return reply(503, 'relay_not_configured');
      const store = storeFactory({ origin, serviceRoleKey });
      const relay = relayFactory({ store, workers });
      const handle = handlerFactory({ relay, callbackSecret });
      const response = await handle({ method: event.httpMethod, headers: event.headers ?? {}, body: event.body });
      return {
        ...response,
        headers: { ...response.headers, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      };
    } catch {
      // Do not leak upstream errors, credentials, or claim hosted execution proof.
      return reply(503, 'relay_unavailable');
    }
  };
}

export const handler = makeNetlifyRelayHandler();
