/** Authenticated, one-shot HTTP boundary for a durable outbox drain. No timer or worker is created here. */
import {timingSafeEqual} from 'node:crypto';
const response=(statusCode,data)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(data)});
function equal(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export function makeOutboxHttpHandler({callbackSecret,drain}){
 if(typeof callbackSecret!=='string'||callbackSecret.length<24||typeof drain!=='function')
  throw Error('Authenticated outbox drain required');
 return async({method,headers={},body})=>{
  if(method!=='POST')return response(405,{error:'method not allowed'});
  if(!equal(headers.authorization??headers.Authorization??'','Bearer '+callbackSecret))
   return response(401,{error:'unauthorized'});
  if(typeof body!=='string'||Buffer.byteLength(body)>1024)
   return response(413,{error:'invalid payload'});
  let event;try{event=JSON.parse(body)}catch{return response(400,{error:'invalid JSON'})}
  if(!event||Array.isArray(event)||typeof event!=='object'||
     Object.keys(event).length!==1||event.type!=='drain')
   return response(400,{error:'unsupported event'});
  try{
   const result=await drain();
   if(!result||typeof result.state!=='string')throw Error('invalid drain result');
   return response(200,result);
  }catch{return response(503,{error:'outbox drain not confirmed'})}
 };
}
