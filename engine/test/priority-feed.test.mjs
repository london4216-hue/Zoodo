import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePriorityFeed} from '../dashboard/priority-feed.mjs';
const now=Date.parse('2026-10-30T23:40:00Z');
const feed={schema_version:1,source_observed_at:'2026-10-30T23:39:00Z',rows:[
 {id:'PR-787',title:'PR 787',source_url:'https://github.com/example/private/pull/787',stage:'OPEN DRAFT',last_verified_meaningful_at:null,landing_verified_at:null,verified_live_url:'https://example.org/unverified'},
 {id:'SARA',title:'Sara',source_url:'https://github.com/example/public/issues/1',stage:'DISCOVERY',last_verified_meaningful_at:'2026-10-30T21:00:00Z',landing_verified_at:null,verified_live_url:null}
]};
test('PR and Sara remain separate; unverified live link is suppressed',()=>{
 const x=evaluatePriorityFeed(feed,now);
 assert.equal(x.rows.length,2);
 assert.equal(x.rows[0].evidence_label,'NO VERIFIED MOVEMENT');
 assert.equal(x.rows[0].verified_live_url,null);
 assert.equal(x.rows[1].evidence_label,'STALE VERIFIED MOVEMENT');
 assert.equal(x.sourceStale,false);
});
test('refresh time cannot reset meaningful-work freshness',()=>{
 const x=evaluatePriorityFeed({...feed,source_observed_at:'2026-10-30T23:40:00Z'},now);
 assert.equal(x.rows[0].meaningfulAgeMs,null);
 assert.equal(x.rows[1].stale,true);
});
test('invalid source provenance fails closed',()=>{
 assert.throws(()=>evaluatePriorityFeed({...feed,rows:[{id:'bad',source_url:'javascript:alert(1)'}]},now),/source URL/);
});
