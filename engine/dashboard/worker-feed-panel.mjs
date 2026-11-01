import {evaluateWorkerFeed} from './worker-feed.mjs';
const known = [
  ['aider-local','Aider / Ollama (local)'],
  ['copilot','GitHub Copilot'],
  ['deepseek','DeepSeek'],
  ['gemini','Gemini'],
  ['claude','Claude'],
  ['coderabbit','CodeRabbit'],
  ['perplexity','Perplexity'],
];
const status = document.getElementById('worker-feed-status');
const table = document.getElementById('worker-feed-rows');
function render(result){
  status.textContent = result.state+' · '+result.reason+(result.observed_at?' · published '+result.observed_at:'');
  const map = new Map(result.workers.map(w=>[w.worker_id,w]));
  const ids = [...known,...result.workers.filter(w=>!known.some(k=>k[0]===w.worker_id)).map(w=>[w.worker_id,w.worker_id])];
  table.replaceChildren();
  for(const [id,name] of ids){
    const w=map.get(id); const tr=document.createElement('tr');
    const cells=[name, w?.state?.toUpperCase()??'UNKNOWN',w?.proof??'NO NATIVE RECEIPT',w?.task_id??'—',w?.observed_at??'—',w?.last_result??'—'];
    for(const value of cells){const td=document.createElement('td');td.textContent=value;tr.append(td)}
    table.append(tr);
  }
}
let lastObservedAt = null;
let refreshInFlight = false;
async function refresh(){
  if(refreshInFlight)return;
  refreshInFlight = true;
  try{
    const res=await fetch('./worker-feed.json?read='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw Error('HTTP '+res.status);
    const result=evaluateWorkerFeed(await res.json());
    if(result.state==='UNKNOWN')throw Error(result.reason);
    const observed=Date.parse(result.observed_at);
    if(!Number.isFinite(observed))throw Error('Invalid worker feed timestamp');
    if(lastObservedAt!==null && observed<lastObservedAt)throw Error('Worker feed timestamp regressed');
    lastObservedAt=observed;
    render(result);
  }catch(e){
    // A failed or replayed read cannot establish that a worker remains running.
    render({state:'RECOVERY REQUIRED',reason:'Worker feed unverified: '+String(e?.message||e).slice(0,100),
      observed_at:lastObservedAt===null?null:new Date(lastObservedAt).toISOString(),workers:[]});
  }finally{refreshInFlight=false}
}
refresh();setInterval(refresh,30000);
