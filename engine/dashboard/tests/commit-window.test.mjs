import test from 'node:test';
import assert from 'node:assert/strict';
import {countRecentCommits} from '../commit-window.mjs';

const now=Date.parse('2026-10-31T16:53:00Z');
const commit=(ms)=>({commit:{committer:{date:new Date(now+ms).toISOString()}}});

test('counts only completed commits in the previous 60 minutes',()=>{
 assert.equal(countRecentCommits([commit(-1),commit(-3599999),commit(-3600000),commit(-7200000)],now),2);
});
test('future-dated commits cannot inflate the last-hour count',()=>{
 assert.equal(countRecentCommits([commit(3600000),commit(1),commit(-120000)],now),1);
});
test('malformed and missing timestamps cannot count as activity',()=>{
 assert.equal(countRecentCommits([{},null,{commit:{committer:{date:'not-a-date'}}},commit(-30000)],now),1);
});
test('missing source data cannot fabricate a positive count',()=>{
 assert.equal(countRecentCommits(null,now),0);
});
