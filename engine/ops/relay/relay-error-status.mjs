/** Distinguish retryable provider outages from invalid/stale lease callbacks.
 * No side effects: the durable database/outbox owns all recovery decisions.
 */
export function classifyRelayError(error) {
  const message=String(error?.message??error??'unknown relay error').slice(0,160);
  const code=String(error?.code??error?.cause?.code??'');
  const retryable=/^RPC [a-z_]+ HTTP (?:408|425|429|5\d\d)$/.test(message)
    || /^(?:fetch failed|network error)$/i.test(message)
    || ['AbortError','TimeoutError'].includes(error?.name)
    || ['ECONNRESET','ETIMEDOUT','EAI_AGAIN','ECONNREFUSED'].includes(code);
  return {statusCode:retryable?503:409,message};
}
