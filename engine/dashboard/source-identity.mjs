// Select GitHub source evidence using a build-time receipt when present.
// This is not an authenticated Netlify deployment mapping or worker proof.
const SHA=/^[a-f0-9]{40}$/i;
const BRANCH=/^(?!\/)(?!.*\.\.)(?!.*\/\/)[a-zA-Z0-9_.\/-]{1,130}$/;
export function selectSourceIdentity(receipt,fallbackBranch){
 if(!BRANCH.test(fallbackBranch))throw Error('Invalid fallback branch');
 const valid=receipt?.schema_version===1&&receipt?.build_tests==='PASSED'&&
  SHA.test(receipt?.source_commit??'')&&BRANCH.test(receipt?.branch??'')&&
  receipt.branch!=='unknown';
 return valid?
  {branch:receipt.branch,ref:receipt.source_commit,sourceCommit:receipt.source_commit,providerBuildClaim:true}:
  {branch:fallbackBranch,ref:fallbackBranch,sourceCommit:null,providerBuildClaim:false};
}
