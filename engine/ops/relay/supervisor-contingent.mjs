/**
 * Active-active supervisor contingent for the existing durable outbox.
 *
 * Run independent instances on failure-isolated hosts. They share the SAME
 * transactional store; claimOutbox/recoverOutbox must be atomic and lease-fenced.
 * This module neither creates a second queue nor certifies external workers.
 * A process manager must restart crashed instances. An independent database
 * recovery plan is still required for host/database outages.
 */
const bounded = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

function wait(ms, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(finish, ms);
    function finish() { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); }
    signal.addEventListener('abort', finish, {once:true});
    if (signal.aborted) finish();
  });
}

/**
 * One independent supervisor. Its peers run the same function, not a leader
 * election. Atomic DB claims and lease expiry provide handoff after a crash.
 * All callbacks are bounded by their own store/relay transport timeouts.
 */
export async function runSupervisorContingent({
  store, relay, workerIds, drainOne, signal,
  intervalMs=2000, recoveryIntervalMs=30000,
  now=()=>Date.now(), sleep=wait, onCycle=()=>{}
}) {
  if (!store || typeof store.claimOutbox !== 'function' ||
      typeof store.ackOutbox !== 'function' ||
      typeof store.recoverOutbox !== 'function' ||
      !relay || typeof relay.next !== 'function' ||
      typeof drainOne !== 'function' || !Array.isArray(workerIds) ||
      !bounded(workerIds.length,1,64) ||
      !Array.from({length:workerIds.length},(_,i)=>i).every(i =>
        Object.hasOwn(workerIds,i) && typeof workerIds[i] === 'string' &&
        workerIds[i].length > 0 && workerIds[i].length <= 128 &&
        workerIds[i] === workerIds[i].trim()) ||
      new Set(workerIds).size !== workerIds.length ||
      !signal || typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' ||
      !bounded(intervalMs,1,60000) || !bounded(recoveryIntervalMs,1,3600000) ||
      typeof now !== 'function' || typeof sleep !== 'function' || typeof onCycle !== 'function')
    throw Error('Qualified shared store, relay, signal and bounded cadence required');

  // Fix the dispatch roster at startup: callers must not change active routing.
  const roster = Object.freeze([...workerIds]);
  let nextRecoveryAt = -Infinity;
  let cycles = 0;
  let recoveryAttempts = 0;
  const emit = event => {
    try { onCycle(event); } catch { /* telemetry must never stop the relay */ }
  };
  while (!signal.aborted) {
    // Recovery is independent of dispatch: any surviving peer may reclaim
    // expired leases, but only the database can decide which leases expired.
    // Invalid clocks must not bypass recovery and allow unfenced dispatch.
    // Sample once so a changing clock cannot corrupt the recovery deadline.
    let tick;
    try { tick = now(); } catch { /* handled below */ }
    if (!bounded(tick, 0, Number.MAX_SAFE_INTEGER)) {
      emit({type:'clock_error'});
      await sleep(intervalMs, signal);
      continue;
    }
    if (tick >= nextRecoveryAt) {
      try {
        const recovered = await store.recoverOutbox();
        if (!Number.isSafeInteger(recovered) || recovered < 0)
          throw Error('Invalid recovery count');
        const deadline = tick + recoveryIntervalMs;
        if (!Number.isSafeInteger(deadline)) throw Error('Invalid recovery deadline');
        nextRecoveryAt = deadline;
        recoveryAttempts++;
        emit({type:'recovered',count:recovered});
      } catch {
        emit({type:'recovery_error'});
        // Do not dispatch while recovery status is unknown.
        await sleep(intervalMs, signal);
        continue;
      }
    }
    if (signal.aborted) break;
    try {
      const outcome = await drainOne({store,relay,workerIds:roster});
      cycles++;
      // Emit only the state and event ID, never raw provider diagnostics.
      emit({type:'cycle',state:outcome?.state ?? 'unknown',eventId:outcome?.eventId ?? null});
    } catch {
      emit({type:'drain_error'});
    }
    await sleep(intervalMs, signal);
  }
  return {state:'stopped',cycles,recoveryAttempts};
}
