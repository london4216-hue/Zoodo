/** Bound the complete reconciliation callback, not merely each individual RPC.
 * A timed-out stage may finish in the database; never start a later worker stage
 * after the response deadline. The private queue/outbox remains authoritative. */
export async function reconcileWithDeadline({quarantine, recover, replay, timeoutMs = 9000}) {
  if ([quarantine, recover, replay].some(fn => typeof fn !== 'function') ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw Error('Valid reconciliation stages and bounded deadline required');
  }
  const controller = new AbortController();
  let timer, phase = 'quarantine';
  const unconfirmed = (where, reason) => ({state:'reconcile-unconfirmed', phase:where, reason});
  // Both database RPCs return nonnegative integer counts; a null, false or
  // malformed response must never be mistaken for a successful recovery.
  const validCount = value => Number.isSafeInteger(value) && value >= 0;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(unconfirmed('deadline', 'Reconcile deadline; durable checkpoint requires replay'));
    }, timeoutMs);
  });
  const attempt = (async () => {
    try {
      const quarantined = await quarantine();
      if (controller.signal.aborted) return unconfirmed(phase, 'Reconcile deadline after quarantine');
      if (!validCount(quarantined)) return unconfirmed(phase, 'Invalid quarantine RPC receipt; retry required');
      phase = 'recover';
      const recovered = await recover();
      if (controller.signal.aborted) return unconfirmed(phase, 'Reconcile deadline after outbox recovery');
      if (!validCount(recovered)) return unconfirmed(phase, 'Invalid outbox recovery RPC receipt; retry required');
      phase = 'replay';
      const wakeup = await replay(controller.signal);
      if (controller.signal.aborted || !['acked', 'empty', 'idle-settled'].includes(wakeup?.state))
        return unconfirmed(phase, 'Outbox replay requires durable reconciliation');
      return {state:'reconciled', quarantined, recovered, wakeup};
    } catch {
      return unconfirmed(phase, 'Reconciliation stage failed; durable retry required');
    }
  })();
  try { return await Promise.race([attempt, deadline]); }
  finally { clearTimeout(timer); }
}
