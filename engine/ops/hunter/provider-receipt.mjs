/** ZOO provider-native invocation gate. No API call is implied by parsing JSON.
 * A caller must supply a trusted authenticated provider adapter for readback. */
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:\/-]{0,127}$/;
const NAME=/^[a-z][a-z0-9_-]{1,63}$/;
// In-process provenance: JSON carrying qualified:true is not itself proof.
const verifiedObjects=new WeakSet();
const https=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.hostname.includes('.')&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(u.hostname)}catch{return false}};
const time=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)?Date.parse(x):NaN;
const reject=(reason,state='INVALID')=>({state,qualified:false,reason});
export async function assessProviderReceipt(r,{now=new Date().toISOString(),expectedTaskId,expectedSourceSha,verifyProvider,maxAgeMs=3600000}={}){
 if(!r||typeof r!=='object'||Array.isArray(r))return reject('invalid_envelope');
 if(r.schema!=='zoo.provider-invocation.v1'||!NAME.test(r.provider||'')||!['model','execution_host'].includes(r.provider_kind)||
    !ID.test(r.provider_request_id||'')||!ID.test(r.agent_id||'')||!ID.test(r.task_id||'')||!NAME.test(r.role||'')||
    (r.provider_kind==='model'&&!ID.test(r.model_id||''))||!SHA.test(r.source_sha||'')||!SHA.test(r.artifact_sha||'')||
    r.status!=='completed'||!https(r.evidence_url))return reject('invalid_or_nonproductive_receipt');
 if(expectedTaskId!==undefined&&r.task_id!==expectedTaskId)return reject('assignment_mismatch');
 if(expectedSourceSha!==undefined&&r.source_sha!==expectedSourceSha)return reject('source_mismatch');
 const start=time(r.started_at),end=time(r.finished_at),clock=time(now);
 if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(clock)||end<start||end>clock+30000||clock-end>maxAgeMs||start>clock+30000)return reject('invalid_or_stale_clock');
 if(r.cost_usd!==null&&r.cost_usd!==undefined&&(!Number.isFinite(r.cost_usd)||r.cost_usd<0))return reject('invalid_cost');
 const base={provider:r.provider,provider_kind:r.provider_kind,provider_request_id:r.provider_request_id,role:r.role,latency_ms:end-start,source_sha:r.source_sha,artifact_sha:r.artifact_sha};
 if(typeof verifyProvider!=='function')return {...base,...reject('authenticated_provider_readback_required','UNVERIFIED')};
 let native;try{native=await verifyProvider({provider:r.provider,request_id:r.provider_request_id,kind:r.provider_kind});}catch{return {...base,...reject('provider_adapter_unavailable','RECOVERING')}}
 const fields=['provider','provider_kind','provider_request_id','source_sha','artifact_sha','status','evidence_url'];
 if(!native||native.authenticated!==true||fields.some(k=>native[k]!==r[k])||(r.provider_kind==='model'&&native.model_id!==r.model_id))return {...base,...reject('native_receipt_mismatch_or_untrusted','RECOVERING')};
 const qualified={...base,state:'QUALIFIED',qualified:true,reason:'authenticated_native_readback_matched'};
 verifiedObjects.add(qualified);return qualified;
}
export function capabilityCounts(receipts){
 const unique=new Set(),roles={},providers={};
 for(const r of receipts||[]){
  if(!r||!verifiedObjects.has(r)||r.qualified!==true||!NAME.test(r.role||'')||!NAME.test(r.provider||'')||!ID.test(r.provider_request_id||''))continue;
  const key=r.provider+':'+r.provider_request_id;if(unique.has(key))continue;unique.add(key);
  roles[r.role]=(roles[r.role]||0)+1;(providers[r.role]??=new Set()).add(r.provider);
 }
 return {productive_invocations:unique.size,roles,qualified_alternatives:Object.fromEntries(Object.entries(providers).map(([k,v])=>[k,v.size]))};
}
