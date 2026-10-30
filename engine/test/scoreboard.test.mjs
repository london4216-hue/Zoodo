import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTask,scoreAssets} from '../src/scoreboard.mjs';
const stamp='2026-10-29T00:00:00.000Z';
const e=(kind,taskId,extra={})=>({kind,taskId,timestamp:stamp,...extra});
test('same task id in separate assets never combines scores',()=>{
 const a={status:'agreed',commit:'a',events:[e('built','same',{commit:'a',costUsd:2}),e('reviewed','same',{commit:'a',approved:true,costUsd:1})]};
 const b={status:'rejected',commit:'b',events:[e('built','same',{commit:'b',costUsd:4}),e('reviewed','same',{commit:'b',approved:false,costUsd:1})]};
 const s=scoreAssets([{assetId:'My Block',run:a},{assetId:'YB3',run:b}]);
 assert.equal(s['My Block'][0].outcome,'independently_verified');
 assert.equal(s.YB3[0].outcome,'needs_repair');
 assert.equal(s['My Block'][0].costUsd,3);
 assert.equal(s.YB3[0].costUsd,5);
});
test('unknown grade, percent, cost and delta remain unknown',()=>{
 const s=scoreTask({status:'blocked',events:[e('failed','1')]},{assetId:'Movement'});
 assert.equal(s.grade,null);assert.equal(s.readinessPercent,null);assert.equal(s.scoreDelta,null);assert.equal(s.costUsd,null);
});
test('claimed agreement without exact commit approval is unverified',()=>{
 const s=scoreTask({status:'agreed',commit:'a',events:[e('built','1',{commit:'a'}),e('reviewed','1',{commit:'different',approved:true})]},{assetId:'YB3'});
 assert.equal(s.outcome,'unverified');
});
test('asset isolation identifier is mandatory',()=>assert.throws(()=>scoreTask({events:[]}),/assetId/));
