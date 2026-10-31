import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuild } from '../dashboard/scripts/build-proof.mjs';

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zoo-build-contract-'));
  const dashboardDir = join(root, 'dashboard'), testsDir = join(root, 'test');
  mkdirSync(dashboardDir); mkdirSync(testsDir);
  try { return fn({dashboardDir, testsDir}); }
  finally { rmSync(root, {recursive:true, force:true}); }
}

test('Netlify proof build executes real Node tests and writes source-scoped receipt', () => fixture(({dashboardDir, testsDir}) => {
  writeFileSync(join(testsDir,'pass.test.mjs'), "import test from 'node:test'; test('pass', () => {});\n");
  const sha='a'.repeat(40);
  const receipt=runBuild({dashboardDir,testsDir,env:{COMMIT_REF:sha,CONTEXT:'deploy-preview',BRANCH:'sandbox'}});
  assert.equal(receipt.build_tests,'PASSED');
  assert.equal(receipt.source_commit,sha);
  assert.equal(receipt.production_release_verified,false);
  assert.equal(receipt.independent_worker_heartbeat_verified,false);
  assert.equal(receipt.hosted_two_ticket_recovery_verified,false);
  assert.equal(JSON.parse(readFileSync(join(dashboardDir,'build-proof.json'),'utf8')).source_commit,sha);
}));

test('failed source test blocks build and does not publish a passing receipt', () => fixture(({dashboardDir,testsDir}) => {
  writeFileSync(join(testsDir,'fail.test.mjs'), "import test from 'node:test'; test('fail', () => { throw Error('intentional'); });\n");
  assert.throws(() => runBuild({dashboardDir,testsDir,env:{}}), /contract tests failed/);
  assert.equal(existsSync(join(dashboardDir,'build-proof.json')),false);
}));

test('missing tests and conflicting provider SHAs fail closed', () => fixture(({dashboardDir,testsDir}) => {
  assert.throws(() => runBuild({dashboardDir,testsDir,env:{}}), /no source tests/);
  writeFileSync(join(testsDir,'pass.test.mjs'), "import test from 'node:test'; test('pass', () => {});\n");
  assert.throws(() => runBuild({dashboardDir,testsDir,env:{COMMIT_REF:'a'.repeat(40),VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}}), /conflicting provider commit/);
  assert.equal(existsSync(join(dashboardDir,'build-proof.json')),false);
}));

test('Netlify build config references a script that exists and is scoped to Zoodo dashboard', () => {
  const here=resolve(fileURLToPath(import.meta.url),'..');
  const config=readFileSync(new URL('../dashboard/netlify.toml',import.meta.url),'utf8');
  assert.match(config,/command\s*=\s*"node scripts\/build-proof\.mjs"/);
  assert.ok(existsSync(new URL('../dashboard/scripts/build-proof.mjs',import.meta.url)));
});
