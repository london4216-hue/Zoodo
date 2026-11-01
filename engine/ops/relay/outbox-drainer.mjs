/** Bounded durable outbox consumer; never infer a worker started from an unconfirmed receipt. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const WORKER = /^[A-Za-z0-9_-]{1,64}$/;
function validReceipt(r, worker) {
  if (!r || typeof r.ticket !== 'string' || !TICKET.test(r.ticket) || r.worker !== worker ||
      typeof r.receipt_url !== 'string' || r.receipt_url.length > 2048) return false;
  try {
    const url = new URL(r.receipt_url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}
// Return only verified receipt fields. Raw provider objects can contain cyclic,
// oversized, or mutable metadata that must not enter durable evidence.
function verifiedDispatch(r, worker, qualifiedWorkers) {
  if (r?.state === 'dispatched') {
    const receipt = {state:'dispatched',ticket:r.ticket,worker:r.worker,receipt_url:r.receipt_url};
    return validReceipt(receipt, worker) ? receipt : null;
  }
  if (r?.state !== 'delegated' || r.worker !== worker) return null;
  const replacement = r.replacement;
  const receipt = {state:'dispatched',ticket:replacement?.ticket,
    worker:replacement?.worker,receipt_url:replacement?.receipt_url};
  if (replacement?.state !== 'dispatched' ||
      typeof receipt.worker !== 'string' || !WORKER.test(receipt.worker) ||
      receipt.worker === worker || !qualifiedWorkers.includes(receipt.worker) ||
      !validReceipt(receipt, receipt.worker)) return null;
  return {state:'delegated',worker,replacement:receipt};
}
function safeErrorMessage(error) {
  try { return String(error?.message || error).slice(0,120); }
  catch { return 'unprintable error'; }
}
export async function drainOne({store,relay,workerIds}) {
  if (!store || typeof store.claimOutbox !== 'function' || typeof store.ackOutbox !== 'function' ||
      !relay || typeof relay.next !== 'function' || !Array.isArray(workerIds) || !workerIds.length ||
      [...workerIds].some(w => typeof w !== 'string' || !WORKER.test(w)) ||
      new Set(workerIds).size !== workerIds.length)
    throw Error('Qualified worker roster and durable store required');
  // Snapshot the validated roster before any async store/relay callback can mutate it.
  const qualifiedWorkers = [...workerIds];
  const event = await store.claimOutbox();
  if (event === null) return {state:'empty'};
  // Keep the validated lease identity stable across awaited worker callbacks.
  const claimed = event && {id:event.id,ticket_id:event.ticket_id,lease_token:event.lease_token};
  if (!claimed || !Number.isSafeInteger(claimed.id) || claimed.id < 1 ||
      typeof claimed.ticket_id !== 'string' || !TICKET.test(claimed.ticket_id) ||
      typeof claimed.lease_token !== 'string' || !UUID.test(claimed.lease_token))
    throw Error('Invalid durable outbox lease');
  const attempts = [];
  for (const worker of qualifiedWorkers) {
    try {
      const r = await relay.next(worker);
      const state = r?.state;
      attempts.push({worker,state:typeof state === 'string' && state.length > 0 && state.length <= 64 ? state : 'unknown'});
      if (r?.state === 'idle') {
        // An idle worker does not prove the shared queue is empty. Only a
        // transactional store check may settle the wake-up without dispatch.
        if (typeof store.settleIdleOutbox === 'function' &&
            await store.settleIdleOutbox(claimed.id,claimed.lease_token) === true)
          return {state:'idle-settled',eventId:claimed.id,attempts};
        continue;
      }
      if (r?.state === 'dispatched' || r?.state === 'delegated') {
        const dispatch = verifiedDispatch(r, worker, qualifiedWorkers);
        if (!dispatch)
          return {state:'recovery_required',reason:'dispatch receipt not confirmed',eventId:claimed.id,attempts};
        // Once dispatch is confirmed, an ambiguous ACK is never a reason to
        // dispatch another worker. Reconciliation must inspect the durable lease.
        try {
          if (await store.ackOutbox(claimed.id,claimed.lease_token) === true)
            return {state:'acknowledged',eventId:claimed.id,dispatch,attempts};
        } catch (error) {
          attempts.push({worker,state:'ack_error',reason:safeErrorMessage(error)});
        }
        return {state:'recovery_required',reason:'outbox ack not confirmed',eventId:claimed.id,attempts};
      }
      // Only a confirmed idle claim can safely try another worker. Any other
      // result, including recovery_required/failed/unknown, may hide a started
      // worker; a status string is not native proof of non-execution.
      return {state:'recovery_required',eventId:claimed.id,attempts,
        reason:'worker dispatch not confirmed; await native non-started receipt'};
    } catch (error) {
      attempts.push({worker,state:'error',reason:safeErrorMessage(error)});
      // A thrown transport error cannot prove the worker did not start.
      return {state:'recovery_required',eventId:claimed.id,attempts,
        reason:'worker invocation outcome uncertain; await native non-started receipt'};
    }
  }
  return {state:'recovery_required',eventId:claimed.id,attempts,reason:'no confirmed eligible dispatch'};
}
