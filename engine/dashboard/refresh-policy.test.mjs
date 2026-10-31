import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GITHUB_SOURCE_POLL_MS,AUTOMATION_PROOF_POLL_MS} from './refresh-policy.mjs';
const source=readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('GitHub REST source polling is rate bounded',()=>{
 assert.equal(GITHUB_SOURCE_POLL_MS,600000);
 assert.ok(source.includes('setInterval(update,GITHUB_SOURCE_POLL_MS)'));
 assert.ok(!source.includes('setInterval(update,30000)'));
});
test('scheduler proof remains fresh and independent',()=>{
 assert.equal(AUTOMATION_PROOF_POLL_MS,30000);
 assert.ok(source.includes('setInterval(refreshAutomationProof,AUTOMATION_PROOF_POLL_MS)'));
 assert.ok(source.includes('proof_read='));
});
test('manual refresh and original home remain intact',()=>{
 assert.ok(source.includes("addEventListener('click',update)"));
 assert.ok(source.includes('YOUR HOME / QUICK LINKS'));
 assert.ok(source.includes('Needs verification / repair'));
});
test('footer states actual independent polling cadences',()=>{
 assert.ok(source.includes('GitHub source every 10 minutes'));
 assert.ok(source.includes('scheduler receipts every 30 seconds'));
 assert.ok(!source.includes('Polls GitHub every 30 seconds'));
});
