// Pure evidence classifier. GitHub PR reviewer login is not proof of independent provider.
const SHA=/^[a-f0-9]{40}$/;
const CODE=/^(?:engine\/src\/|engine\/dashboard\/|apps\/|src\/|packages\/)/;
const EXT=/\.(?:mjs|cjs|js|jsx|ts|tsx|html|css|py|go|rs|java|rb|sh)$/;
const validDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
// Permit 60s of provider clock skew, not arbitrary future evidence freshness.
const credibleDate=(s,now)=>validDate(s)&&Date.parse(s)<=now+60000;
export function substantiveFiles(files){
 if(!Array.isArray(files))return [];
 return files.filter(f=>typeof f?.filename==='string'&&CODE.test(f.filename)&&EXT.test(f.filename)&&
 !/(?:^|\/)(?:docs?|evidence|verification)\//i.test(f.filename)&&f.status!=='removed'&&
 (f.additions>0||f.deletions>0));
}
export function evaluateEvidence({head,detail,runs,review,deployment,heartbeat,now=Date.now()}={}){
 const sha=head?.sha,exact=SHA.test(sha??'')&&detail?.sha===sha;
 const changed=exact?substantiveFiles(detail.files):[];
 const code=changed.length>0;
 const linkedTicket=exact&&/(?:^|\s)(?:[\w-]+\/[\w-]+)?#\d+\b/.test(detail.commit?.message??'');
 const ci=Array.isArray(runs)?runs.find(r=>r?.head_sha===sha&&r?.status==='completed'&&r?.conclusion==='success'&&credibleDate(r.updated_at,now)):null;
 // Only accept review from a separately authenticated verifier, never raw GitHub comments.
 const independent=Boolean(code&&review?.trustedVerifier===true&&review?.providerIndependent===true&&
 review?.decision==='approved'&&review?.commit===sha&&credibleDate(review?.at,now)&&
 typeof review?.receiptUrl==='string'&&/^https:\/\//.test(review.receiptUrl));
 const verified=Boolean(code&&linkedTicket&&ci&&independent);
 const receiptAt=verified?new Date(Math.max(Date.parse(ci.updated_at),Date.parse(review.at))).toISOString():null;
 const ageMs=receiptAt?Math.max(0,now-Date.parse(receiptAt)):null;
 const liveDeployment=Boolean(deployment?.httpVerified===true&&deployment?.functionalVerified===true&&deployment?.sha===sha&&credibleDate(deployment?.checkedAt,now));
 return {headSha:SHA.test(sha??'')?sha:null,
 lastCommitAt:credibleDate(head?.commit?.committer?.date,now)?head.commit.committer.date:null,
 lastCodeAt:code&&credibleDate(detail.commit?.committer?.date,now)?detail.commit.committer.date:null,
 changedCodePaths:changed.map(f=>f.filename),
 exactHeadCiAt:ci?.updated_at??null,independentReviewAt:independent?review.at:null,
 lastVerifiedCodeAt:receiptAt,lastVerifiedDeploymentAt:liveDeployment?deployment.checkedAt:null,
 lastAuthenticatedHeartbeatAt:heartbeat?.authenticated===true&&credibleDate(heartbeat?.at,now)?heartbeat.at:null,
 state:!verified?'UNKNOWN — VERIFIED MOVEMENT NOT ESTABLISHED':ageMs>=300000?'ESCALATION DUE — VERIFIED MOVEMENT STALE':'VERIFIED WITHIN 5 MINUTES',
 verified,missing:[!exact&&'exact commit detail',!code&&'substantive code diff',!linkedTicket&&'linked ticket',!ci&&'exact-head passing CI',!independent&&'authenticated independent-provider review'].filter(Boolean)};
}
