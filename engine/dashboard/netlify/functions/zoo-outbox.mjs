/** One bounded authorized event invocation; a successful deploy is NOT execution proof. */
import {makeStore,makeRelay} from '../../../ops/relay/portable-relay.mjs';
import {drainOutboxOnce} from '../../../ops/relay/outbox-store.mjs';
import {makeOutboxHttpHandler} from '../../../ops/relay/outbox-http.mjs';
export function createHandler(env=process.env,fetchImpl=fetch){
 const workers=JSON.parse(env.ZOO_WORKERS_JSON||'[]');
 if(!Array.isArray(workers)||workers.length<1||workers.length>2)
  throw Error('One or two authorized workers required for bounded probe');
 const origin=env.ZOO_SUPABASE_URL,serviceRoleKey=env.ZOO_SUPABASE_SERVICE_ROLE_KEY;
 const relay=makeRelay({store:makeStore({origin,serviceRoleKey,fetchImpl}),workers,fetchImpl});
 return makeOutboxHttpHandler({callbackSecret:env.ZOO_CALLBACK_SECRET,
  drain:()=>drainOutboxOnce({origin,serviceRoleKey,fetchImpl,relay,workerIds:workers.map(w=>w.id)})});
}
export async function handler(event){
 try{return await createHandler()({method:event.httpMethod,headers:event.headers,body:event.body})}
 catch{return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},
  body:JSON.stringify({error:'ZOO outbox unavailable or not configured'})}}
}
