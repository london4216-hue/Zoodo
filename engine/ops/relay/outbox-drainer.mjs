/** Bounded durable outbox consumer; never infer a worker started from an unconfirmed receipt. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const WORKER = /^[A-Za-z0-9_-]{1,64}$/;
function validReceipt(r, worker) {
  if (!r || !TICKET.test(r.ticket ?? '') || r.worker !== worker ||
      typeof r.receipt_url !== 'string') return false;
  try {
    const url = new URL(r.receipt_url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}
function confirmedDispatch(r, worker) {
  if (r?.state === 'dispatched') return validReceipt(r, worker);
  if (r?.state !== 'delegated' || r.worker !== worker) return false;
  const replacement = r.replacement;
  return replacement?.state === 'dispatched' &&
    WORKER.test(replacement.worker ?? '') && replacement.worker !== worker &&
    validReceipt(replacement, replacement.worker);
}
export async function drainOne({store,relay,workerIds}) {
  if (!store || typeof store.claimOutbox !== 'function' || typeof store.ackOutbox !== 'function' ||
      !relay || typeof relay.next !== 'function' || !Array.isArray(workerIds) || !workerIds.length ||
      workerIds.some(w => typeof w !== 'string' || !WORKER.test(w)) ||
      new Set(workerIds).size !== workerIds.length)
    throw Error('Qualified worker roster and durable store required');
  const event = await store.claimOutbox();
  if (event === null) return {state:'empty'};
  if (!event || !Number.isSafeInteger(event.id) || event.id < 1 ||
      !TICKET.test(event.ticket_id ?? '') || !UUID.test(event.lease_token ?? ''))
    throw Error('Invalid durable outbox lease');
  const attempts = [];
  for (const worker of workerIds) {
    try {
      const r = await relay.next(worker);
      attempts.push({worker,state:r?.state ?? 'unknown'});
      if (r?.state === 'idle') {
        // An idle worker does not prove the shared queue is empty. Only a
        // transactional store check may settle the wake-up without dispatch.
        if (typeof store.settleIdleOutbox === 'function' &&
            await store.settleIdleOutbox(event.id,event.lease_token) === true)
          return {state:'idle-settled',eventId:event.id,attempts};
        continue;
      }
      if (r?.state === 'dispatched' || r?.state === 'delegated') {
        if (!confirmedDispatch(r, worker))
          return {state:'recovery_required',reason:'dispatch receipt not confirmed',eventId:event.id,attempts};
        // Once dispatch is confirmed, an ambiguous ACK is never a reason to
        // dispatch another worker. Reconciliation must inspect the durable lease.
        try {
          if (await store.ackOutbox(event.id,event.lease_token) === true)
            return {state:'acknowledged',eventId:event.id,dispatch:r,attempts};
        } catch (error) {
          attempts.push({worker,state:'ack_error',reason:String(error?.message||error).slice(0,120)});
        }
        return {state:'recovery_required',reason:'outbox ack not confirmed',eventId:event.id,attempts};
      }
      // Only a confirmed idle claim can safely try another worker. Any other
      // result, including recovery_required/failed/unknown, may hide a started
      // worker; a status string is not native proof of non-execution.
      return {state:'recovery_required',eventId:event.id,attempts,
        reason:'worker dispatch not confirmed; await native non-started receipt'};
    } catch (error) {
      attempts.push({worker,state:'error',reason:String(error?.message||error).slice(0,120)});
      // A thrown transport error cannot prove the worker did not start.
      return {state:'recovery_required',eventId:event.id,attempts,
        reason:'worker invocation outcome uncertain; await native non-started receipt'};
    }
  }
  return {state:'recovery_required',eventId:event.id,attempts,reason:'no confirmed eligible dispatch'};
}
