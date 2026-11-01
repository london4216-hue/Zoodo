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
async function refresh(){
  try{
    const res=await fetch('./worker-feed.json?read='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw Error('Worker feed unavailable');
    render(evaluateWorkerFeed(await res.json()));
  }catch{render(evaluateWorkerFeed(null))}
}
refresh();setInterval(refresh,30000);
