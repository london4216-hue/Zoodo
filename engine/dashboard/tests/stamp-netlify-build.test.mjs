import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBuildMeta } from '../scripts/stamp-netlify-build.mjs';

test('records exact Git source SHA at build time', () => {
  const sha = 'abcdef0123456789'.repeat(2) + 'abcdef01';
  assert.match(renderBuildMeta(sha), new RegExp(`BUILD_COMMIT_SHA = "${sha}";`));
});
test('missing COMMIT_REF never fabricates source SHA', () => {
  assert.match(renderBuildMeta(undefined), /BUILD_COMMIT_SHA = null;/);
});
test('malformed COMMIT_REF never reaches generated source', () => {
  const malicious = 'a'.repeat(40) + '\nprocess.exit(1)';
  assert.match(renderBuildMeta(malicious), /BUILD_COMMIT_SHA = null;/);
  assert.doesNotMatch(renderBuildMeta(malicious), /process.exit/);
});
test('does not accept abbreviated SHA', () => {
  assert.match(renderBuildMeta('ed6e8294'), /BUILD_COMMIT_SHA = null;/);
});
