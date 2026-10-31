import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const match=html.match(/const fmt=([\\s\\S]*?);\\nconst escapeHtml=/);
assert.ok(match,'dashboard source must expose the evidence age formatter');
const fmt=runInNewContext('('+match[1]+')');
const now=Date.parse('2026-10-31T19:45:00Z');
const iso=ms=>new Date(ms).toISOString();

test('future source time cannot display as just now',()=>{
 assert.equal(fmt(iso(now+3600000),now),'INVALID FUTURE TIMESTAMP');
 assert.equal(fmt(iso(now+30000),now),'CLOCK SKEW · source timestamp ahead');
});
test('invalid source time is unknown, not fresh',()=>{
 assert.equal(fmt('not-a-date',now),'UNKNOWN · invalid source timestamp');
 assert.equal(fmt(null,now),'UNKNOWN · invalid source timestamp');
});
test('valid historical timestamps retain truthful elapsed age',()=>{
 assert.equal(fmt(iso(now),now),'under 1m old');
 assert.equal(fmt(iso(now-120000),now),'2m ago');
 assert.equal(fmt(iso(now-3660000),now),'1h 1m ago');
});
test('owner dashboard and source links remain present',()=>{
 assert.match(html,/id="accountability"/);
 assert.match(html,/id="refresh"/);
 assert.match(html,/https:\/\/github.com\/london4216-hue\/Zoodo\/issues\/18/);
});
