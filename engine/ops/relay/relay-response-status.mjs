/** Map bounded relay recovery outcomes to HTTP retry semantics.
 * Durable leases and the outbox, not an HTTP response, own task recovery.
 * A completed transition remains acknowledged even if NEXT is unconfirmed.
 */
const RETRYABLE = new Set([
  'next-unconfirmed',
  'replay-unconfirmed',
  'retry-after-lease',
  'ack-unconfirmed',
  'reconcile-unconfirmed',
  'recovery_required'
]);
export function relayResponseStatus(type, result) {
  if (!['kick', 'replay', 'reconcile'].includes(type)) return 200;
  return RETRYABLE.has(result?.state) ? 503 : 200;
}
