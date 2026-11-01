// Bounded, complete GitHub list traversal. Never present a first-page sample as a total.
export async function fetchOpenQueue(api, endpoint, maxPages=5) {
  if (!['/issues', '/pulls'].includes(endpoint)) throw Error('Unsupported queue endpoint');
  const items=[];
  for (let page=1;page<=maxPages;page++) {
    const batch=await api(endpoint+'?state=open&per_page=100&page='+page);
    if (!Array.isArray(batch)) throw Error('Malformed GitHub queue response');
    items.push(...batch);
    if (batch.length<100) return {items,complete:true};
  }
  return {items,complete:false};
}
