import {randomUUID} from 'node:crypto';
export async function runTask({task,builders,reviewers,emit=()=>{}}) {
 const events=[]; const log=(kind,agent,detail={})=>{const e={id:randomUUID(),timestamp:new Date().toISOString(),taskId:task.id,kind,agentId:agent?.id??null,provider:agent?.provider??null,...detail};events.push(e);emit(e);return e};
 let built=null;
 for(const agent of builders){log('started',agent);try{const result=await agent.build(task);if(!result?.commit)throw Error('No commit evidence');built={agent,result};log('built',agent,{commit:result.commit,costUsd:result.costUsd??null});break}catch(e){log('failed',agent,{reason:String(e),costUsd:null})}}
 if(!built)return {status:'blocked',events};
 const eligible=reviewers.filter(x=>x.provider!==built.agent.provider);
 if(!eligible.length){log('blocked',null,{reason:'No independent provider reviewer'});return {status:'blocked',commit:built.result.commit,events}};
 for(const reviewer of eligible){
  log('review_started',reviewer,{commit:built.result.commit});
  try{
   const verdict=await reviewer.review({task,commit:built.result.commit});
   if(typeof verdict?.approved!=='boolean')throw Error('Reviewer returned no explicit verdict');
   // Approval must bind to the exact built commit. Mismatch is a negative
   // verdict, not permission to shop for a more permissive reviewer.
   const exactCommit=verdict.commit===built.result.commit;
   const approved=verdict.approved===true&&exactCommit;
   log('reviewed',reviewer,{commit:built.result.commit,reviewedCommit:verdict.commit??null,approved,costUsd:verdict.costUsd??null,...(verdict.approved&&!exactCommit?{reason:'Approval lacks exact-commit evidence'}:{})});
   return {status:approved?'agreed':'rejected',commit:built.result.commit,events};
  }catch(e){log('review_failed',reviewer,{reason:String(e)})}
 }
 log('blocked',null,{reason:'All independent reviewers unavailable'});
 return {status:'blocked',commit:built.result.commit,events};
}
export function summarize(events){const agents={};for(const e of events){if(!e.agentId)continue;const a=agents[e.agentId]??={events:0,failures:0,verifiedReviews:0,knownCostUsd:0,unknownCostEvents:0};a.events++;if(e.kind==='failed'||e.kind==='review_failed')a.failures++;if(e.kind==='reviewed'&&e.approved)a.verifiedReviews++;if(typeof e.costUsd==='number')a.knownCostUsd+=e.costUsd;else if(['built','reviewed','failed'].includes(e.kind))a.unknownCostEvents++}return agents}
