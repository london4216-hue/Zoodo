import test from 'node:test';
import assert from 'node:assert/strict';
import {openSearchUrl,verifiedOpenCount} from '../queue-counts.mjs';
test('complete GitHub Search response provides exact open count',()=>{
 assert.equal(verifiedOpenCount({total_count:47,incomplete_results:false}),47);
 assert.equal(verifiedOpenCount({total_count:0,incomplete_results:false}),0);
});
test('incomplete, absent and malformed counts remain UNKNOWN',()=>{
 for(const payload of [null,{}, {total_count:30},
  {total_count:99,incomplete_results:true},
  {total_count:-1,incomplete_results:false},
  {total_count:1.5,incomplete_results:false},
  {total_count:'12',incomplete_results:false}])
  assert.equal(verifiedOpenCount(payload),null);
});
test('issue and PR counts use distinct GitHub repository-wide searches',()=>{
 const issues=openSearchUrl('london4216-hue','Zoodo','issue');
 const prs=openSearchUrl('london4216-hue','Zoodo','pr');
 assert.ok(issues.includes('is%3Aissue'));
 assert.ok(prs.includes('is%3Apr'));
 assert.ok(issues.includes('repo%3Alondon4216-hue%2FZoodo'));
 assert.notEqual(issues,prs);
 assert.throws(()=>openSearchUrl('london4216-hue','Zoodo','both'));
});
