/** Authenticated Supabase RPC adapter for ZOO's durable outbox.
 * An external authorized event host must invoke drainOutboxOnce; this module
 * does not claim to deploy a scheduler, worker, or continuous runtime.
 */
import {drainOne} from './outbox-drainer.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
function originUrl(origin) {
  let url;
  try { url = new URL(origin); } catch { throw Error('HTTPS root origin required'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('HTTPS root origin required');
  return url;
}
function leaseArgs(id, token) {
  if (!Number.isSafeInteger(id) || id < 1 || typeof token !== 'string' || !UUID.test(token))
    throw Error('Valid outbox lease ID and token required');
  return {p_id: id, p_token: token};
}
function booleanResult(value) {
  if (typeof value !== 'boolean') throw Error('Malformed boolean RPC response');
  return value;
}
export function makeOutboxStore({origin, serviceRoleKey, fetchImpl = fetch}) {
  const base = originUrl(origin);
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length < 24)
    throw Error('Server-only service role key required');
  if (typeof fetchImpl !== 'function') throw Error('Fetch implementation required');
  async function rpc(name, args) {
    const response = await fetchImpl(new URL('/rest/v1/rpc/zoo_ops_' + name, base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(7000),
      headers: {apikey: serviceRoleKey, authorization: 'Bearer ' + serviceRoleKey,
        'content-type': 'application/json', 'cache-control': 'no-store'},
      body: JSON.stringify(args)
    });
    if (!response.ok) {
      await response.body?.cancel?.();
      throw Error('Outbox RPC ' + name + ' HTTP ' + response.status);
    }
    const raw = await response.text();
    if (raw.length > 32768) throw Error('Oversized outbox RPC response');
    try { return JSON.parse(raw); }
    catch { throw Error('Malformed outbox RPC JSON'); }
  }
  return {
    async claimOutbox() {
      const rows = await rpc('outbox_claim', {});
      if (!Array.isArray(rows) || rows.length > 1) throw Error('Malformed outbox claim');
      const item = rows[0];
      if (!item) return null;
      if (!Number.isSafeInteger(item.id) || item.id < 1 ||
          typeof item.ticket_id !== 'string' || !TICKET.test(item.ticket_id) ||
          typeof item.lease_token !== 'string' || !UUID.test(item.lease_token))
        throw Error('Malformed outbox lease');
      return {id: item.id, ticket_id: item.ticket_id, lease_token: item.lease_token};
    },
    async ackOutbox(id, token) {
      return booleanResult(await rpc('outbox_ack', leaseArgs(id, token)));
    },
    async settleIdleOutbox(id, token) {
      return booleanResult(await rpc('outbox_settle_idle', leaseArgs(id, token)));
    },
    async recoverOutbox() {
      const count = await rpc('outbox_recover', {});
      if (!Number.isSafeInteger(count) || count < 0) throw Error('Malformed outbox recovery count');
      return count;
    }
  };
}

/** One bounded event-triggered attempt. Never interprets a timer as execution. */
export function drainOutboxOnce({origin, serviceRoleKey, fetchImpl, relay, workerIds}) {
  const store = makeOutboxStore({origin, serviceRoleKey, fetchImpl});
  return drainOne({store, relay, workerIds});
}
