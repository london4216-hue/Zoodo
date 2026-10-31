/** Persist a provider acceptance receipt before reporting dispatch success.
 * If the HTTP deadline expires while the durable write is pending, the
 * checkpoint is still allowed to finish, but the callback cannot claim GO.
 * The outbox/lease remains authoritative for subsequent reconciliation.
 */
export async function confirmDispatchReceipt({record,ticket,worker,leaseToken,receiptUrl,signal}) {
  if (typeof record !== 'function') throw Error('Durable dispatch recorder required');
  const confirmed = await record({ticket_id:ticket,worker,lease_token:leaseToken,receipt_url:receiptUrl});
  if (confirmed !== true) throw Error('Dispatch receipt not durably recorded');
  if (signal?.aborted) return {
    state:'next-unconfirmed',ticket,
    reason:'NEXT deadline elapsed during durable receipt write; reconciliation required'
  };
  return {state:'dispatched',ticket,worker,receipt_url:receiptUrl};
}
