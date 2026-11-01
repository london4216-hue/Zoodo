import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../../../.github/workflows/zoo-dashboard-contract.yml',import.meta.url),'utf8');
const branches=workflow.match(/^[ \t]+branches:\s*\[([^\]]+)\]/m)?.[1].split(',').map(s=>s.trim())??[];

test('dashboard contract CI runs for canonical and stacked dashboard PR bases',()=>{
 assert.ok(branches.includes('autonomous-engine-replacement-2026-10-29'),'canonical PR #16 target missing');
 assert.ok(branches.includes('fix/zoo-live-dashboard-accountability-20261030'),'stacked PR #71 target missing');
 assert.ok(branches.includes('main'),'current dashboard PRs to main must trigger contract CI');
});

test('workflow retains path trigger and Node source tests',()=>{
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/engine\/dashboard\/\*\*/);
 assert.match(workflow,/node --test engine\/dashboard\/tests\/\*\.test\.mjs/);
});

test('validation workflow remains read-only without deploy step',()=>{
 assert.match(workflow,/permissions:\s*\n\s+contents: read/);
 assert.doesNotMatch(workflow,/netlify deploy|vercel deploy|git push/i);
});
