/** Only durable, documented relay outcomes may be acknowledged to a webhook sender.
 * Unrecognized, missing and uncertain outcomes must remain retryable, otherwise
 * the upstream provider may discard a wake-up while work is still leased.
 * Completion/requeue callbacks stay acknowledged once their DB transition
 * committed, even when the subsequent NEXT attempt is unconfirmed.
 */
const ACKNOWLEDGED = Object.freeze({
  kick: new Set(['dispatched', 'delegated', 'idle']),
  replay: new Set(['acked', 'empty', 'idle-settled']),
  reconcile: new Set(['reconciled']),
  completed: new Set(['completed']),
  not_started: new Set(['requeued'])
});

export function relayResponseStatus(type, result) {
  return ACKNOWLEDGED[type]?.has(result?.state) ? 200 : 503;
}
