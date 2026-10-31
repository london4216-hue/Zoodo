/** Bound authenticated kick callbacks like completion-triggered NEXT.
 * A timed-out claim can still own a durable lease; the abort signal fences
 * late worker invocation. Reconciliation remains the source of truth.
 */
import {nextWithDeadline} from './next-deadline.mjs';

export function kickWithDeadline(relay, worker, {timeoutMs=7500}={}) {
  if (!relay || typeof relay.next !== 'function') throw Error('NEXT relay required');
  return nextWithDeadline(signal=>relay.next(worker,true,signal),{timeoutMs});
}
