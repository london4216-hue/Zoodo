/** Bounded durable outbox consumer; never infer a worker started from an unconfirmed receipt. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
export async function drainOne({store,relay,workerIds}) {
  if (!store || typeof store.claimOutbox !== 'function' || typeof store.ackOutbox !== 'function' ||
      !relay || typeof relay.next !== 'function' || !Array.isArray(workerIds) || !workerIds.length ||
      workerIds.some(w => typeof w !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(w)))
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
        if (await store.ackOutbox(event.id,event.lease_token) !== true)
          return {state:'recovery_required',reason:'outbox ack not confirmed',eventId:event.id,attempts};
        return {state:'acknowledged',eventId:event.id,dispatch:r,attempts};
      }
      if (r?.state === 'uncertain' && r.replacement?.state === 'dispatched')
        return {state:'recovery_required',eventId:event.id,attempts,
          reason:'original worker dispatch uncertain; await native non-started receipt'};
    } catch (error) {
      attempts.push({worker,state:'error',reason:String(error?.message||error).slice(0,120)});
    }
  }
  return {state:'recovery_required',eventId:event.id,attempts,reason:'no confirmed eligible dispatch'};
}
