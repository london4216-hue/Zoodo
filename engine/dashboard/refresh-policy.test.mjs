import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GITHUB_SOURCE_POLL_MS,AUTOMATION_PROOF_POLL_MS} from './refresh-policy.mjs';
const source=readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('GitHub REST source polling is rate bounded',()=>{assert.equal(GITHUB_SOURCE_POLL_MS,600000);assert.match(source,/setInterval\\(update,GITHUB_SOURCE_POLL_MS\\)/);assert.doesNotMatch(source,/setInterval\\(update,30000\\)/)});
test('scheduler proof remains fresh and independent',()=>{assert.equal(AUTOMATION_PROOF_POLL_MS,30000);assert.match(source,/setInterval\\(refreshAutomationProof,AUTOMATION_PROOF_POLL_MS\\)/);assert.match(source,/proof_read=/)});
test('manual refresh and original home remain intact',()=>{assert.match(source,/addEventListener\\('click',update\\)/);assert.match(source,/YOUR HOME \\/ QUICK LINKS/);assert.match(source,/Needs verification \\/ repair/)});
test('footer states actual independent polling cadences',()=>{assert.match(source,/GitHub source every 10 minutes/);assert.match(source,/scheduler receipts every 30 seconds/);assert.doesNotMatch(source,/Polls GitHub every 30 seconds/)});
