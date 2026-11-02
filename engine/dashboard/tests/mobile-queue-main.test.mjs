import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('phone-first queue summary is on canonical home with UNKNOWN defaults',()=>{
  assert.match(html,/id="mobile-queue-summary"/);
  for(const id of ['total','queued','running','blocked','completed24','oldest'])
    assert.match(html,new RegExp('id="mq-'+id+'">UNKNOWN'));
  assert.match(html,/id="mq-refresh"/);
  assert.match(html,/source_run_id/);
  assert.match(html,/900000/); // 15-minute source freshness ceiling
});
test('queue script parses and preserves native worker and product links',()=>{
  const matches=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(matches.length>0);
  const queue=matches.find(m=>m[1].includes("board.json?read="));
  assert.ok(queue,'missing queue fetch implementation');
  new Script(queue[1],{filename:'mobile-queue-inline.js'});
  assert.match(html,/src="\.\/worker-feed-panel\.mjs"/);
  assert.match(html,/https:\/\/beautypaths\.io\/app/);
  assert.match(html,/https:\/\/ez-move-transcendiq\.netlify\.app\/demo/);
});
test('queue does not infer execution from page refresh',()=>{
  assert.match(html,/SOURCE-REPORTED/);
  assert.match(html,/Two-ticket automatic NEXT and production readback remain separate/);
  assert.match(html,/queue totals invalid/);
});