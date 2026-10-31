// Bounded, cache-bypassing public scheduler-proof retrieval.
// A successful fetch is not a successful worker run or a deployment receipt.
export async function fetchPublishedProof({fetcher, url, evaluate, previous = null, timeoutMs = 8000}) {
  if (typeof fetcher !== 'function' || typeof evaluate !== 'function') throw new TypeError('Proof fetch dependencies missing');
  const response = await fetcher(url, {cache: 'no-store', signal: AbortSignal.timeout(timeoutMs)});
  if (!response?.ok) throw new Error('HTTP ' + (response?.status ?? 'UNKNOWN'));
  const next = await response.json();
  const classification = evaluate(next);
  if (classification.state === 'UNKNOWN') throw new Error(classification.reason);
  if (previous && Date.parse(next.observed_at) < Date.parse(previous.observed_at))
    throw new Error('Published proof snapshot regressed');
  return {feed: next, classification};
}
