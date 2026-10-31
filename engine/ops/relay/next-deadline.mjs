/** Bound an event-triggered NEXT attempt without claiming it failed or was cancelled.
 * A timed-out dispatch can still be in flight: durable leases/outbox must reconcile. */
export async function nextWithDeadline(run, {timeoutMs = 7500} = {}) {
  if (typeof run !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw Error('Valid NEXT callback and bounded deadline required');
  }
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve({
      state: 'next-unconfirmed',
      reason: 'NEXT deadline exceeded; durable outbox reconciliation required'
    }), timeoutMs);
  });
  try {
    const attempt = Promise.resolve().then(run).catch(() => ({
      state: 'recovery_required',
      reason: 'NEXT dispatch failed; durable outbox retry required'
    }));
    return await Promise.race([attempt, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
