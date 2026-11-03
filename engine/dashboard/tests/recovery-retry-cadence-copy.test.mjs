import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GITHUB_SOURCE_POLL_MS,AUTOMATION_PROOF_POLL_MS} from '../refresh-policy.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('recovery copy does not promise 30-second GitHub source retry',()=>{
 assert.doesNotMatch(html,/Automatic retry every 30 seconds/);
 assert.match(html,/GitHub source retry every/);
 assert.match(html,/scheduler-proof retry every/);
});

test('recovery copy renders actual configured independent polling intervals',()=>{
 const line=html.split('\n').find(s=>s.includes("$('accountabilityNext').textContent='GitHub source retry every '"));
 assert.ok(line,'recovery assignment must exist');
 let rendered=null;
 const context={
  GITHUB_SOURCE_POLL_MS,AUTOMATION_PROOF_POLL_MS,Math,
  $:id=>({set textContent(value){assert.equal(id,'accountabilityNext');rendered=value;}})
 };
 vm.runInNewContext(line,context);
 assert.equal(rendered,'GitHub source retry every 10 minutes; scheduler-proof retry every 30 seconds; Dashboard Worker investigates actual source, Agent Hunter is backup, Keeper owns deployment integration.');
});

test('source polling and scheduler polling retain separate timers',()=>{
 assert.match(html,/setInterval\(update,GITHUB_SOURCE_POLL_MS\)/);
 assert.match(html,/setInterval\(refreshAutomationProof,AUTOMATION_PROOF_POLL_MS\)/);
 assert.match(html,/id="accountability"/);
 assert.match(html,/id="refresh"/);
 assert.match(html,/Zoodo\/issues\/17/);
});
