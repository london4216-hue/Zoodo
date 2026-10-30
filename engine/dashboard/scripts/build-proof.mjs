#!/usr/bin/env node
// Netlify's independent automatic fallback when GitHub Actions cannot start jobs.
// A successful deploy status for this commit now requires source contract tests.
// This is a build-time receipt ONLY, never a browser test or agent heartbeat.
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const testFiles = readdirSync('tests').filter(x => x.endsWith('.test.mjs')).sort();
if (!testFiles.length) {
  console.error('ZOO BUILD BLOCKED: no contract tests registered');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...testFiles.map(x => join('tests', x))], {
  stdio: 'inherit', timeout: 180000, env: process.env
});
if (result.error || result.status !== 0) {
  console.error('ZOO BUILD BLOCKED: contract tests failed, timed out, or could not run');
  process.exit(1);
}
const raw = process.env.COMMIT_REF || '';
const sha = /^[a-f0-9]{40}$/.test(raw) ? raw : null;
const context = ['production', 'deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT)
  ? process.env.CONTEXT : 'unknown';
const verified = {
  schema_version: 1,
  build_tests: 'PASSED',
  test_suite: testFiles,
  source_commit: sha,
  deployment_context: context,
  branch: String(process.env.BRANCH || 'unknown').slice(0, 130),
  verified_at: new Date().toISOString(),
  verified_scope: 'Netlify build-time source contract tests only',
  browser_functionality_verified: false,
  independent_worker_heartbeat_verified: false,
  production_release_verified: false
};
writeFileSync('build-proof.json', JSON.stringify(verified,null,2)+'\n');
console.log('ZOO AUTOMATIC BUILD RECEIPT '+JSON.stringify(verified));
