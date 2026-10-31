/** Bounded replay of durable ZOO wake-up events. No in-memory queue or polling. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;

export function makeOutboxReplay({store, dispatch, worker, timeoutMs = 8000}) {
  if (!store || typeof store.claimOutbox !== 'function' ||
      typeof store.ackOutbox !== 'function' || typeof dispatch !== 'function' ||
      typeof worker !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(worker)) {
    throw Error('Durable outbox and authorized worker required');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw Error('Bounded replay deadline required');
  }
  return async function replayOne() {
    let expired = false;
    let timer;
    const attempt = async () => {
      const event = await store.claimOutbox();
      // A late claim may have acquired a lease after the HTTP response deadline.
      // Do not start a new worker invocation after that deadline.
      if (expired) return {state: 'replay-unconfirmed'};
      if (event === null) return {state: 'empty'};
      if (!event || !Number.isSafeInteger(event.id) || event.id < 1 ||
          !TICKET.test(event.ticket_id ?? '') || !UUID.test(event.lease_token ?? '')) {
        throw Error('Invalid durable outbox lease');
      }
      let result;
      try {
        result = await dispatch(worker);
      } catch (e) {
        return {state: 'retry-after-lease', event_id: event.id, reason: String(e?.message ?? e).slice(0, 120)};
      }
      // Dispatch can finish after the bounded response. Leave its outbox lease
      // untouched for fenced reconciliation; never acknowledge it as delivered.
      if (expired) return {state: 'replay-unconfirmed'};
      const dispatched = result?.state === 'dispatched' || result?.state === 'delegated' ||
        result?.replacement?.state === 'dispatched';
      if (result?.state === 'idle') {
        // A worker reporting idle may still have work leased. Only the private
        // database can atomically confirm no eligible queued tickets remain.
        if (typeof store.settleIdleOutbox === 'function' &&
            await store.settleIdleOutbox(event.id, event.lease_token) === true) {
          return {state: 'idle-settled', event_id: event.id};
        }
      }
      if (!dispatched) {
        // A busy/uncertain worker is not proof that this wake-up was delivered.
        // The outbox lease is recovered on a subsequent authenticated reconcile.
        return {state: 'retry-after-lease', event_id: event.id, dispatch_state: result?.state ?? 'unknown'};
      }
      if (expired) return {state: 'replay-unconfirmed'};
      if (await store.ackOutbox(event.id, event.lease_token) !== true) {
        return {state: 'ack-unconfirmed', event_id: event.id, dispatch_state: result.state};
      }
      return {state: 'acked', event_id: event.id, dispatch: result};
    };
    try {
      return await Promise.race([
        attempt(),
        new Promise(resolve => {
          timer = setTimeout(() => {
            expired = true;
            resolve({state: 'replay-unconfirmed', reason: 'Replay deadline; fenced outbox recovery required'});
          }, timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
