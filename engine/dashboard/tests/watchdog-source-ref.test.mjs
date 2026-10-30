import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const yaml=readFileSync(new URL('../../../.github/workflows/zoo-proof-watchdog.yml',import.meta.url),'utf8');
test('scheduled watchdog explicitly reads canonical Zoodo dashboard branch, not default main',()=>{
 assert.match(yaml,/PROOF_REF:\s*autonomous-engine-replacement-2026-10-29/);
 assert.doesNotMatch(yaml,/PROOF_REF:\s*(?:main|fix\/)/);
 assert.match(yaml,/cron:\s*'\*\/5 \* \* \* \*'/);
});
test('no production deployment or user-controlled secret introduced',()=>{
 assert.match(yaml,/contents: read/);
 assert.match(yaml,/issues: write/);
 assert.doesNotMatch(yaml,/deploy|netlify-cli|vercel-cli|wrangler/i);
});
