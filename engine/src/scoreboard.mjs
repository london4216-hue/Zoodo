// Evidence-only scoring: never convert missing proof into a passing grade.
export function scoreTask(run,{assetId,baseline=null}={}){
 if(!assetId)throw Error('assetId required for isolation');
 const events=run?.events??[];
 const build=events.find(e=>e.kind==='built'&&e.commit===run.commit);
 // Positive review must be later, for the same task and exact commit,
 // from a provider different from the builder.
 const reviewed=Boolean(build&&events.some(e=>e.kind==='reviewed'&&e.taskId===build.taskId&&e.commit===run.commit&&e.reviewedCommit===run.commit&&e.approved===true&&e.provider&&build.provider&&e.provider!==build.provider&&Date.parse(e.timestamp)>=Date.parse(build.timestamp)));
 const completed=Boolean(build);
 const failed=events.filter(e=>['failed','review_failed'].includes(e.kind)).length;
 const costEvents=events.filter(e=>['built','reviewed'].includes(e.kind));
 const known=costEvents.filter(e=>typeof e.costUsd==='number'&&Number.isFinite(e.costUsd));
 const knownCostUsd=known.reduce((sum,e)=>sum+e.costUsd,0);
 const costComplete=known.length===costEvents.length&&costEvents.length>0;
 const start=Date.parse(events[0]?.timestamp??'');
 const end=Date.parse(events.at(-1)?.timestamp??'');
 const elapsedMs=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,end-start):null;
 const outcome=completed&&reviewed&&run.status==='agreed'?'independently_verified':run?.status==='rejected'?'needs_repair':'unverified';
 return {assetId,taskId:events[0]?.taskId??null,commit:run?.commit??null,outcome,
  built:completed,independentlyApproved:reviewed,failures:failed,recoveryAttempts:events.filter(e=>e.kind==='review_started').length,
  costUsd:costComplete?knownCostUsd:null,partialKnownCostUsd:knownCostUsd,elapsedMs,
  baseline,grade:null,readinessPercent:null,scoreDelta:null,
  evidenceEvents:events.length};
}
export function scoreAssets(runs){
 const output={};
 for(const {assetId,run,baseline} of runs){
  (output[assetId]??=[]).push(scoreTask(run,{assetId,baseline}));
 }
 return output;
}
