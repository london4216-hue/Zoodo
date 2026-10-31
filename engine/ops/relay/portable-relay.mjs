/** ZOO event-driven relay: one bounded invocation, never an in-memory queue or polling loop.
 * All ticket data/leases live in a private Supabase project. */
import {timingSafeEqual} from 'node:crypto';
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const SHA=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9-]{36}$/i;
const WORKER=/^[A-Za-z0-9_-]{1,64}$/;
const https=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash}catch{return false}};
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function makeStore({origin,serviceRoleKey,fetchImpl=fetch}){
 if(!https(origin)||new URL(origin).pathname!=='/'||new URL(origin).search)throw Error('HTTPS Supabase origin required');
 if(typeof serviceRoleKey!=='string'||serviceRoleKey.length<24)throw Error('Server-only service key required');
 async function rpc(name,args){
  const res=await fetchImpl(new URL('/rest/v1/rpc/zoo_ops_'+name,origin),{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(7000),
   headers:{apikey:serviceRoleKey,authorization:'Bearer '+serviceRoleKey,'content-type':'application/json','cache-control':'no-store'},
   body:JSON.stringify(args)});
  if(!res.ok){await res.body?.cancel?.();throw Error('RPC '+name+' HTTP '+res.status)}
  const raw=await res.text();if(raw.length>32768)throw Error('Oversized RPC result');
  return JSON.parse(raw);
 }
 return {
  claim:async(worker)=>{const r=await rpc('claim',{p_worker:worker});if(!Array.isArray(r)||r.length>1)throw Error('Invalid claim');return r[0]??null},
  complete:x=>rpc('complete',{p_id:x.ticket_id,p_worker:x.worker,p_token:x.lease_token,p_commit:x.commit_sha,p_test_url:x.test_url}),
  notStarted:x=>rpc('not_started',{p_id:x.ticket_id,p_worker:x.worker,p_token:x.lease_token,p_evidence:x.evidence_url}),
  record:x=>rpc('dispatch_recorded',{p_id:x.ticket_id,p_worker:x.worker,p_token:x.lease_token,p_receipt:x.receipt_url}),
  quarantine:()=>rpc('quarantine_expired',{})
 };
}
export function makeRelay({store,workers,fetchImpl=fetch,now=()=>Date.now()}){
 if(!store||!Array.isArray(workers)||!workers.length)throw Error('Durable store and worker pool required');
 const pool=new Map();
 for(const w of workers){
  if(!WORKER.test(w?.id??'')||!https(w?.url)||typeof w.token!=='string'||w.token.length<24||pool.has(w.id))throw Error('Invalid authorized worker');
  pool.set(w.id,w);
 }
 async function delegate(worker,allowReplacement,result){
  if(!allowReplacement)return result;
  // One bounded pass, no timers and no repeat of a leased/uncertain ticket.
  for(const alternate of pool.keys()){
   if(alternate===worker)continue;
   try{
    const replacement=await next(alternate,false);
    if(replacement.state==='dispatched')return result.state==='idle'
     ? {state:'delegated',worker,replacement}:{...result,replacement};
   }catch{ /* The original result remains durable and truthful. */ }
  }
  return result;
 }
 async function next(worker,allowReplacement=true){
  const w=pool.get(worker);if(!w)throw Error('Unknown worker');
  const t=await store.claim(worker);if(!t)return delegate(worker,allowReplacement,{state:'idle'});
  if(!ID.test(t.id??'')||!UUID.test(t.lease_token??'')||t.lease_owner!==worker)throw Error('Invalid atomic lease');
  const key='zoo:'+t.id+':'+t.lease_token;
  let result;
  try{
   const res=await fetchImpl(w.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),
    headers:{authorization:'Bearer '+w.token,'content-type':'application/json','x-zoo-idempotency-key':key},
    body:JSON.stringify({ticket_id:t.id,worker,lease_token:t.lease_token,idempotency_key:key,asset:t.asset,intent:t.intent})});
   if(res.status!==202){await res.body?.cancel?.();result={state:'uncertain',ticket:t.id,reason:'worker HTTP '+res.status}}
   else {
    const raw=await res.text();if(raw.length>4096)throw Error('Oversized acceptance');
    const ack=JSON.parse(raw);
    if(ack.accepted!==true||ack.ticket_id!==t.id||ack.idempotency_key!==key||!https(ack.receipt_url))
     result={state:'uncertain',ticket:t.id,reason:'Invalid worker acceptance'};
    else {
     if(await store.record({ticket_id:t.id,worker,lease_token:t.lease_token,receipt_url:ack.receipt_url})!==true)
      throw Error('Dispatch receipt not durably recorded');
     return {state:'dispatched',ticket:t.id,worker,receipt_url:ack.receipt_url};
    }
   }
  }catch(e){result={state:'uncertain',ticket:t.id,reason:String(e.message||e).slice(0,160)}}
  // The uncertain task stays leased/quarantined; only independent tickets may advance.
  return delegate(worker,allowReplacement,result);
 }
 async function completed(x){
  if(!ID.test(x?.ticket_id??'')||!WORKER.test(x?.worker??'')||!UUID.test(x?.lease_token??'')||
     !SHA.test(x?.commit_sha??'')||!https(x?.test_url)||!pool.has(x.worker))throw Error('Invalid completion');
  if(await store.complete(x)!==true)throw Error('Completion not durably confirmed');
  // NEXT is triggered by the authenticated completion callback, not an hourly tick.
  return {state:'completed',ticket:x.ticket_id,next:await next(x.worker),completed_at:new Date(now()).toISOString()};
 }
 async function notStarted(x){
  if(!ID.test(x?.ticket_id??'')||!WORKER.test(x?.worker??'')||!UUID.test(x?.lease_token??'')||
     !https(x?.evidence_url)||!pool.has(x.worker))throw Error('Native non-execution receipt required');
  if(await store.notStarted(x)!==true)throw Error('Non-execution not durably confirmed');
  return {state:'requeued',ticket:x.ticket_id,next:await next(x.worker)};
 }
 return {next,completed,notStarted,quarantine:()=>store.quarantine()};
}
export function makeHandler({relay,callbackSecret}){
 if(typeof callbackSecret!=='string'||callbackSecret.length<24)throw Error('Callback secret required');
 const send=(statusCode,data)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(data)});
 return async({method,headers={},body})=>{
  if(method!=='POST')return send(405,{error:'method not allowed'});
  if(!equal(headers.authorization??headers.Authorization??'','Bearer '+callbackSecret))return send(401,{error:'unauthorized'});
  if(typeof body!=='string'||Buffer.byteLength(body)>8192)return send(413,{error:'invalid payload'});
  let x;try{x=JSON.parse(body)}catch{return send(400,{error:'invalid JSON'})}
  try{
   if(x.type==='kick')return send(200,await relay.next(x.worker));
   if(x.type==='completed')return send(200,await relay.completed(x));
   if(x.type==='not_started')return send(200,await relay.notStarted(x));
   if(x.type==='reconcile')return send(200,{state:'reconciled',count:await relay.quarantine()});
   return send(422,{error:'unsupported event'});
  }catch(e){return send(409,{error:String(e.message||e).slice(0,160)})}
 };
}
