// Public GitHub Search counts, distinct from the first page of REST issue/PR listings.
// Search returns an exact total_count only when incomplete_results is false.
// Never display a truncated first page as the repository-wide count.
export function openSearchUrl(owner,repo,kind){
 if(!/^[A-Za-z0-9_.-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo)||
    !['issue','pr'].includes(kind))throw Error('Invalid repository or GitHub search kind');
 return 'https://api.github.com/search/issues?q='+
   encodeURIComponent('repo:'+owner+'/'+repo+' is:open is:'+kind)+'&per_page=1';
}
export function verifiedOpenCount(payload){
 if(!payload||payload.incomplete_results!==false||
    !Number.isSafeInteger(payload.total_count)||payload.total_count<0)return null;
 return payload.total_count;
}
