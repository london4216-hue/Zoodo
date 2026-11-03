import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, diagnose} from '../ops/ci-diagnose.mjs';
test('billing annotation explains a zero-step failure', () => {
  assert.equal(classify([{conclusion:'failure', steps:[]}], [{message:'The job was not started because your account is locked due to a billing issue.'}]), 'ACCOUNT_BILLING_LOCK');
});
test('missing steps alone do not imply billing failure', () => {
  assert.equal(classify([{conclusion:'failure'}], []), 'FAILED_BEFORE_STEPS');
  assert.equal(classify([], []), 'NO_JOBS_RECORDED');
  assert.equal(classify([{conclusion:null}], []), 'NOT_SUCCESSFUL');
});
test('API errors fail observation rather than return success', async () => {
  await assert.rejects(diagnose('owner/repo', 1, {fetcher:async()=>({ok:false,status:403})}), /403/);
});
test('collects annotations even when a job never starts', async () => {
  const fetcher = async url => ({ok:true,json:async()=>url.includes('/annotations') ? [{message:'The job was not started because your account is locked due to a billing issue.'}] : {jobs:[{id:12,conclusion:'failure',steps:[]}]}});
  const report = await diagnose('owner/repo', 1, {fetcher});
  assert.equal(report.status,'ACCOUNT_BILLING_LOCK');
  assert.equal(report.repository_write_verified,false);
});
