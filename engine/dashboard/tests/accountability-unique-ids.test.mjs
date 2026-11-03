import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../index.html'),'utf8');
const markup=html.split('<script')[0];
const ids=[...markup.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
test('dashboard DOM IDs are unique, including the two accountability panels',()=>{
 assert.equal(new Set(ids).size,ids.length,'duplicate DOM id makes anchors and selectors ambiguous');
 assert.equal(ids.filter(id=>id==='accountability').length,1);
 assert.equal(ids.filter(id=>id==='accountability-status').length,1);
 assert.match(markup,/<section class="panel" id="accountability" aria-label="Agent accountability and ticket queue"/);
 assert.match(markup,/<section class="accountability" id="accountability-status" aria-label="ZOO accountability status"/);
});
test('accountability anchor fix retains owner navigation and core product links',()=>{
 const hrefs=[...markup.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(hrefs.length,43,'unexpected change to link count');
 for(const u of ['https://github.com/london4216-hue/Zoodo','https://github.com/london4216-hue/TransendIQ','https://beautypaths.io/tour','https://ez-move-transcendiq.netlify.app/demo','https://app.netlify.com/projects/zoo-live-dashboard/overview'])assert.ok(hrefs.includes(u),u);
 assert.match(markup,/Integration authority:<\/b> Sole ZOO Keeper/);
 assert.match(markup,/Independent backup:<\/b> ZOO Agent Hunter/);
});
