/**
 * ZOO durable outbox consumer, designed for an independently hosted event hook.
 * This module does not start a scheduler or claim any hosted deployment.
 * It acknowledges an event only after the bounded relay confirms an accepted
 * dispatch or that there is no eligible ticket. Uncertain dispatches remain
 * leased for database recovery; never blindly replay a possibly-started job.
 */
export async function drainOne({store,relay,workerIds}) {
  if (!store || !relay || !Array.isArray(workerIds) || !workerIds.length ||
      workerIds.some(w => typeof w !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(w)))
    throw Error('Qualified worker roster and durable store required');
  const event = await store.outboxClaim();
  if (!event) return {state:'empty'};
  if (!Number.isSafeInteger(event.id) || event.id < 1 ||
      !/^[a-f0-9-]{36}$/i.test(event.lease_token || ''))
    throw Error('Invalid durable outbox lease');
  const attempts = [];
  for (const worker of workerIds) {
    try {
      const r = await relay.next(worker);
      attempts.push({worker,state:r.state});
      if (r.state === 'dispatched' || r.state === 'delegated' || r.state === 'idle') {
        if (await store.outboxAck(event.id,event.lease_token) !== true)
          return {state:'recovery_required',reason:'outbox ack not confirmed',eventId:event.id,attempts};
        return {state:'acknowledged',eventId:event.id,dispatch:r,attempts};
      }
      // Uncertain response may have started the claimed job; never replay that
      // job. The relay's own worker-lease checks prevent same-worker duplicates.
      if (r.state === 'uncertain' && r.replacement?.state === 'dispatched') {
        // Independent replacement task ran, but the original remains uncertain.
        return {state:'recovery_required',eventId:event.id,attempts,
          reason:'original worker dispatch uncertain; await native non-started receipt'};
      }
    } catch (error) {
      attempts.push({worker,state:'error',reason:String(error?.message||error).slice(0,120)});
    }
  }
  // Do not ack. Durable SQL outbox lease expires and is retried with a cap.
  return {state:'recovery_required',eventId:event.id,attempts,reason:'no confirmed eligible dispatch'};
}
