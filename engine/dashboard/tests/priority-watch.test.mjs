import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const script = read('priority-watch.mjs');
const feed = JSON.parse(read('priority-watch.json'));

test('P0 priority row is additive and mobile responsive', () => {
  assert.match(html, /id="zoo-p0"/);
  assert.match(html, /src="\.\/priority-watch\.mjs"/);
  assert.match(html, /@media\(max-width:680px\)/);
  assert.match(html, /TransendIQ\/pull\/787/);
  assert.match(html, /TransendIQ\/pull\/782/);
  assert.match(html, /TransendIQ\/pull\/788/);
  assert.match(html, /Zoodo\/issues\/24/);
  assert.match(html, /id="accountability"/);
  assert.match(html, /id="handoff-ledger"/);
  assert.match(html, /id="queue-panel"/);
});

test('priority feed is source-linked and does not manufacture work or Sara URL', () => {
  assert.equal(feed.schema_version, 1);
  assert.equal(feed.source, 'authenticated_github_connector_read');
  assert.equal(feed.priority.stage, 'DRAFT_PR_OPEN');
  assert.equal(feed.priority.source_head_sha.length, 40);
  assert.equal(feed.priority.last_test.state, 'UNKNOWN');
  assert.equal(feed.sara.url, null);
  assert.equal(feed.sara.state, 'UNKNOWN');
  assert.equal(feed.dashboard.production_verified, false);
  assert.ok(Number.isFinite(Date.parse(feed.observed_at)));
});

test('snapshot rendering retains stale warning; 403 enters recovery without erasing last receipt', async () => {
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, {textContent:'',addEventListener(){}});
    return elements.get(id);
  }};
  let response = {ok:true, json:async()=>feed};
  const ctx = vm.createContext({document, fetch:async()=>response, setInterval() {}, Date, String, Error, Number, Math});
  vm.runInContext(script, ctx);
  await vm.runInContext('refreshPriority()', ctx);
  assert.equal(elements.get('zoo787stage').textContent, 'DRAFT_PR_OPEN');
  assert.equal(elements.get('zooSaraState').textContent, 'UNKNOWN');
  assert.match(elements.get('zoo787drift').textContent, /Last VERIFIED meaningful task movement: UNKNOWN/);
  response = {ok:false,status:403};
  await vm.runInContext('refreshPriority()', ctx);
  assert.equal(elements.get('zoo787stage').textContent, 'RECOVERING');
  assert.match(elements.get('zooPriorityReceipt').textContent, /last valid snapshot/);
  assert.match(elements.get('zooPriorityReceipt').textContent, /HTTP 403/);
});
