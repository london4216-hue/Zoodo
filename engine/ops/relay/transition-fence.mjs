/** Bound a durable transition before triggering NEXT.
 * The private outbox remains authoritative when a database commit finishes
 * after the callback deadline. Never infer a late commit failed or start a
 * worker from its late result.
 */
export async function confirmTransitionWithinDeadline(commit, {timeoutMs = 6000} = {}) {
  if (typeof commit !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
    throw Error('Valid transition and bounded deadline required');
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({confirmed:false,state:'transition-unconfirmed',reason:'Durable transition deadline; outbox reconciliation required'}),timeoutMs);
  });
  try {
    const attempt = Promise.resolve().then(commit).then(result => {
      if (result !== true) throw Error('Transition not durably confirmed');
      return {confirmed:true};
    });
    return await Promise.race([attempt,timeout]);
  } finally {
    clearTimeout(timer);
  }
}
