/** Netlify event intake for ZOO operations. Bounded; no always-on process implied. */
import {makeStore,makeRelay,makeHandler} from '../../../ops/relay/portable-relay.mjs';
export function createHandler(env=process.env,fetchImpl=fetch){
 const workers=JSON.parse(env.ZOO_WORKERS_JSON||'[]');
 const store=makeStore({origin:env.ZOO_SUPABASE_URL,serviceRoleKey:env.ZOO_SUPABASE_SERVICE_ROLE_KEY,fetchImpl});
 return makeHandler({relay:makeRelay({store,workers,fetchImpl}),callbackSecret:env.ZOO_CALLBACK_SECRET});
}
export async function handler(event){
 try{return await createHandler()({method:event.httpMethod,headers:event.headers,body:event.body})}
 catch{return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},
  body:JSON.stringify({error:'ZOO relay unavailable or not configured'})}}
}
