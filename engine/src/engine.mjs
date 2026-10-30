import {randomUUID} from 'node:crypto';
export async function runTask({task,builders,reviewers,emit=()=>{}}) {
 const events=[]; const log=(kind,agent,detail={})=>{const e={id:randomUUID(),timestamp:new Date().toISOString(),taskId:task.id,kind,agentId:agent?.id??null,provider:agent?.provider??null,...detail};events.push(e);emit(e);return e};
 let built=null;
 for(const agent of builders){log('started',agent);try{const result=await agent.build(task);if(!result?.commit)throw Error('No commit evidence');built={agent,result};log('built',agent,{commit:result.commit,costUsd:result.costUsd??null});break}catch(e){log('failed',agent,{reason:String(e),costUsd:null})}}
 if(!built)return {status:'blocked',events};
 const reviewer=reviewers.find(x=>x.provider!==built.agent.provider);
 if(!reviewer){log('blocked',null,{reason:'No independent provider reviewer'});return {status:'blocked',events}};
 try{const verdict=await reviewer.review({task,commit:built.result.commit});log('reviewed',reviewer,{commit:built.result.commit,approved:verdict.approved===true,costUsd:verdict.costUsd??null});return {status:verdict.approved===true?'agreed':'rejected',commit:built.result.commit,events}}catch(e){log('review_failed',reviewer,{reason:String(e)});return {status:'blocked',events}}
}
export function summarize(events){const agents={};for(const e of events){if(!e.agentId)continue;const a=agents[e.agentId]??={events:0,failures:0,verifiedReviews:0,knownCostUsd:0,unknownCostEvents:0};a.events++;if(e.kind==='failed'||e.kind==='review_failed')a.failures++;if(e.kind==='reviewed'&&e.approved)a.verifiedReviews++;if(typeof e.costUsd==='number')a.knownCostUsd+=e.costUsd;else if(['built','reviewed','failed'].includes(e.kind))a.unknownCostEvents++}return agents}
