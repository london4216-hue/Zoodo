// Single-process event-driven webhook ingress pilot. Not a production distributed worker.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {DurableQueue} from './durable-queue.mjs';
const MAX_BYTES=65536;
export function verifySignature(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||typeof secret!=='string'||secret.length<16||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
 const actual=Buffer.from(signature.slice(7),'hex'),expected=createHmac('sha256',secret).update(raw).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function ingestIssue(queue,payload,{repos,maintainers}){
 if(payload?.action!=='labeled'||payload?.label?.name!=='zoo-ready')return {accepted:false,reason:'Not a ready-label event'};
 const repo=payload?.repository?.full_name;
 if(!Array.isArray(repos)||!repos.includes(repo)||!Array.isArray(maintainers)||!maintainers.includes(payload?.sender?.login))return {accepted:false,reason:'Unauthorized repository or labeler'};
 const issue=payload?.issue;
 if(!Number.isSafeInteger(issue?.number)||issue.number<1||issue.pull_request)return {accepted:false,reason:'Invalid issue'};
 const acceptance=typeof issue.body==='string'?issue.body.match(/(?:^|\n)## Acceptance\s*\n([^#]{10,1000})/i)?.[1]?.trim():null;
 if(!acceptance)return {accepted:false,reason:'No bounded acceptance criteria'};
 const description=String(issue.title??'').trim().slice(0,240);
 if(!description)return {accepted:false,reason:'Missing ticket title'};
 const id=`${repo}#${issue.number}`,before=queue.get(id);
 const ticket=queue.create({id,repo,description});
 return {accepted:true,created:!before,id,status:ticket.status};
}
export function createIngressServer({queue,secret,repos,maintainers}){
 if(!(queue instanceof DurableQueue)||typeof secret!=='string'||secret.length<16)throw Error('Durable queue and webhook secret required');
 return createServer(async(req,res)=>{
  const respond=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data))};
  if(req.method==='GET'&&req.url==='/health')return respond(200,{status:'ingress-ready',dispatch:'not-configured'});
  if(req.method!=='POST'||req.url!=='/github')return respond(404,{error:'not found'});
  if(req.headers['x-github-event']!=='issues')return respond(202,{accepted:false,reason:'Event ignored'});
  const parts=[];let size=0;
  try{
   for await(const chunk of req){size+=chunk.length;if(size>MAX_BYTES){respond(413,{error:'Payload too large'});return}parts.push(chunk)}
   const raw=Buffer.concat(parts);
   if(!verifySignature(raw,req.headers['x-hub-signature-256'],secret))return respond(401,{error:'Invalid signature'});
   let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch{return respond(400,{error:'Invalid JSON'})}
   const result=ingestIssue(queue,payload,{repos,maintainers});
   return respond(result.accepted?202:422,result);
  }catch(e){return respond(500,{error:'Ingress failed; no job dispatched'})}
 });
}
