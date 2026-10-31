import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GITHUB_SOURCE_POLL_MS,AUTOMATION_PROOF_POLL_MS} from '../refresh-policy.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('GitHub REST polling stays below 60/hour at six requests per refresh',()=>{
 assert.ok(GITHUB_SOURCE_POLL_MS>=10*60*1000);
 assert.ok(Math.ceil(3600000/GITHUB_SOURCE_POLL_MS)*6<=60);
});
test('scheduler proof continues independently at least every minute',()=>{
 assert.ok(AUTOMATION_PROOF_POLL_MS<=60000);
 assert.match(html,/setInterval\(\(\)=>refreshAutomationProof\(\)\.catch\(/);
 assert.match(html,/setInterval\(update,GITHUB_SOURCE_POLL_MS\)/);
});
test('manual refresh still invokes source update and current proof',()=>{
 assert.match(html,/addEventListener\('click',update\)/);
 assert.match(html,/refreshAutomationProof\(\)\.catch\(/);
});
test('source rate-limit fix retains dashboard and owner navigation',()=>{
 for(const id of ['accountability','queue-panel','labs','refresh','state'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(!html.includes('setInterval(update,30000)'));
});

test('recovery copy reports the actual independent polling intervals',()=>{
 assert.match(html,/GITHUB_SOURCE_POLL_MS\s*\/\s*60000/);
 assert.match(html,/AUTOMATION_PROOF_POLL_MS\s*\/\s*1000/);
 assert.doesNotMatch(html,/Automatic retry every 30 seconds/);
});
