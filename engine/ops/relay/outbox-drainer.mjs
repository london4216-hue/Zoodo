/** Bounded durable outbox consumer; never infer a worker started from an unconfirmed receipt. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const WORKER = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_STATES = new Set(['idle','dispatched','delegated','failed','uncertain','recovery_required','not_started']);
function validReceipt(r, worker) {
  if (!r || typeof r.ticket !== 'string' || !TICKET.test(r.ticket) || r.worker !== worker ||
      typeof r.receipt_url !== 'string' || r.receipt_url.length > 2048 ||
      r.receipt_url !== r.receipt_url.trim() || r.receipt_url.includes('\\') ||
      /[\p{Cc}\p{Cf}]/u.test(r.receipt_url)) return false;
  try {
    const url = new URL(r.receipt_url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}
// Snapshot only verified receipt fields; provider objects may contain cyclic,
// oversized or mutable metadata that must not enter durable ACK evidence.
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
// Never persist provider error messages: they can contain authorization headers.
function safeErrorMessage(error) {
  try {
    const name = error?.name;
    return typeof name === 'string' &&
      /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|TimeoutError|AbortError)$/.test(name)
      ? name : 'error detail redacted';
  } catch { return 'unprintable error'; }
}
// One monotonic deadline bounds the entire drain. A timed-out worker may
// have started remotely, so a timeout requires recovery, never a second dispatch.
function withinDeadline(operation, deadline) {
  const remaining = Math.ceil(deadline - performance.now());
  if (remaining <= 0) return Promise.reject(Error('Outbox operation deadline exceeded'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Outbox operation deadline exceeded')), remaining);
    Promise.resolve().then(operation).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}
export async function drainOne({store,relay,workerIds,operationTimeoutMs=12000}) {
  if (!store || typeof store.claimOutbox !== 'function' || typeof store.ackOutbox !== 'function' ||
      !relay || typeof relay.next !== 'function' || !Array.isArray(workerIds) || !workerIds.length)
    throw Error('Qualified worker roster and durable store required');
  // Capture the qualified roster exactly once before any asynchronous callbacks.
  const qualifiedWorkers = [];
  const rosterLength = workerIds.length;
  for (let i = 0; i < rosterLength; i++) {
    if (!Object.prototype.hasOwnProperty.call(workerIds, i))
      throw Error('Qualified worker roster and durable store required');
    const worker = workerIds[i];
    if (typeof worker !== 'string' || !WORKER.test(worker) || qualifiedWorkers.includes(worker))
      throw Error('Qualified worker roster and durable store required');
    qualifiedWorkers.push(worker);
  }
  if (!Number.isSafeInteger(operationTimeoutMs) || operationTimeoutMs < 1 || operationTimeoutMs > 30000)
    throw Error('Valid outbox operation timeout required');
  const deadline = performance.now() + operationTimeoutMs;
  const event = await withinDeadline(() => store.claimOutbox(), deadline);
  if (event === null) return {state:'empty'};
  if (!event || !Number.isSafeInteger(event.id) || event.id < 1 ||
      !TICKET.test(event.ticket_id ?? '') || !UUID.test(event.lease_token ?? ''))
    throw Error('Invalid durable outbox lease');
  // Freeze the validated lease identity before invoking any untrusted async callback.
  const eventId = event.id;
  const leaseToken = event.lease_token;
  const attempts = [];
  for (const worker of qualifiedWorkers) {
    try {
      const r = await withinDeadline(() => relay.next(worker), deadline);
      const state = r?.state;
      attempts.push({worker,state:typeof state === 'string' && SAFE_STATES.has(state) ? state : 'unknown'});
      if (state === 'idle') {
        // An idle worker does not prove the shared queue is empty. Only a
        // transactional store check may settle the wake-up without dispatch.
        if (typeof store.settleIdleOutbox === 'function' &&
            await withinDeadline(() => store.settleIdleOutbox(eventId,leaseToken), deadline) === true)
          return {state:'idle-settled',eventId:eventId,attempts};
        continue;
      }
      if (state === 'dispatched' || state === 'delegated') {
        const dispatch = verifiedDispatch(r, worker, qualifiedWorkers);
        if (!dispatch)
          return {state:'recovery_required',reason:'dispatch receipt not confirmed',eventId:eventId,attempts};
        // Once dispatch is confirmed, an ambiguous ACK is never a reason to
        // dispatch another worker. Reconciliation must inspect the durable lease.
        try {
          if (await withinDeadline(() => store.ackOutbox(eventId,leaseToken), deadline) === true)
            return {state:'acknowledged',eventId:eventId,dispatch,attempts};
        } catch (error) {
          attempts.push({worker,state:'ack_error',reason:safeErrorMessage(error)});
        }
        return {state:'recovery_required',reason:'outbox ack not confirmed',eventId:eventId,attempts};
      }
      // Only confirmed idle proves that another worker can be tried.
      // Any other state can conceal a started worker; do not dispatch NEXT.
      return {state:'recovery_required',eventId:eventId,attempts,
        reason:'worker dispatch not confirmed; await native non-started receipt'};
    } catch (error) {
      attempts.push({worker,state:'error',reason:safeErrorMessage(error)});
      // A thrown transport error cannot prove the worker did not start.
      return {state:'recovery_required',eventId:eventId,attempts,
        reason:'worker invocation outcome uncertain; await native non-started receipt'};
    }
  }
  return {state:'recovery_required',eventId:eventId,attempts,reason:'no confirmed eligible dispatch'};
}
